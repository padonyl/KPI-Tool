import Link from "next/link";
import { notFound } from "next/navigation";
import { vyzadujProfil } from "@/lib/page-auth";
import { TrendChart } from "@/components/TrendChart";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluateTarget, type KpiTarget, type Status } from "@/lib/kpi-targets";
import { CrystalField } from "@/components/marketing/CrystalField";
import { formatPeriod, formatPeriodShort } from "@/lib/format-period";
import { formatValue } from "@/lib/format-number";
import { RozpadPeriody } from "./RozpadPeriody";
import { isSystemSlot, type FormulaSpec, type FormulaConfig } from "@/lib/formula";

// Stejná paleta jako StatusBadge.tsx - good/critical, nikdy jinak.
const STATUS_HEX: Record<Status, string> = {
  good: "#0ca30c",
  critical: "#d03b3b",
};

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export default async function KpiDetailPage({
  params,
}: {
  params: Promise<{ kpiId: string }>;
}) {
  const { kpiId } = await params;
  const { supabase, profil: profile, blok } = await vyzadujProfil();
  if (blok) return blok;

  const [{ data: kpiDef }, { data: rows }, { data: targetRow }] =
    await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("id, name, unit, value_type, formula_spec")
        .eq("id", kpiId)
        .maybeSingle(),
      supabase
        .from("kpi_values")
        // `source_upload_id` se tu záměrně nečte — rozpad se od něj odvázal
        // (migrace 0022), protože po nahrání se shodnou hodnotou ukazoval na
        // starší soubor. Zůstává v tabulce jako auditní údaj.
        .select("value, period_end, period_type, entry_source")
        .eq("company_id", profile.company_id)
        .eq("kpi_definition_id", kpiId)
        .is("superseded_at", null)
        .order("period_end"),
      supabase
        .from("kpi_targets")
        .select("evaluation_type, min_value, max_value")
        .eq("company_id", profile.company_id)
        .eq("kpi_definition_id", kpiId)
        .maybeSingle(),
    ]);

  if (!kpiDef) {
    notFound();
  }

  const history = rows ?? [];

  // Rozpad do detailu se nabízí jen u období, která mají uložené syrové
  // řádky (šablona s opt-inem).
  //
  // Seznam období se bere z funkce `rozpad_periody` (migrace 0022), ne
  // z `kpi_values.source_upload_id`. Dvě chyby, které to odstraňuje:
  //
  //  1. Když se nahrál soubor se STEJNOU hodnotou, ale jinou skladbou,
  //     `writeKpiValues` nic nepřepsal a `source_upload_id` dál ukazoval na
  //     starší nahrání — proklik pak zobrazil starou skladbu, případně nic,
  //     když na staré nahrání mezitím dosáhla retence (nápadník 2026-09-07).
  //  2. Dřívější sonda na existenci řádků stahovala `source_rows` a dělala
  //     distinct v paměti. PostgREST vrací nejvýš 1000 řádků, takže u většího
  //     datasetu některá období ze seznamu prostě vypadla.
  //
  // Funkce vrací pro každé období to NEJNOVĚJŠÍ nahrání, které k němu má
  // řádky — což je přesně to, co má proklik ukázat.
  let periodyRozpad: {
    uploadId: string;
    periodEnd: string;
    periodType: string;
    label: string;
  }[] = [];
  let vzorec: { spec: FormulaSpec; config: FormulaConfig } | null = null;

  // Šablony téhle firmy, které tohle KPI plní. Dvě samostatné dotazy místo
  // vnořeného joinu záměrně: vnořený join 1:1 vrací OBJEKT, ne pole, a na
  // tom už se tady chybovalo.
  const { data: sablonyFirmy } = await supabase
    .from("upload_templates")
    .select("id")
    .eq("company_id", profile.company_id);

  const idSablon = (sablonyFirmy ?? []).map((s) => s.id);

  if (idSablon.length > 0) {
    const { data: pravidla } = await supabase
      .from("template_kpi_rules")
      .select("template_id, config")
      .eq("kpi_definition_id", kpiId)
      .in("template_id", idSablon);

    for (const pravidlo of pravidla ?? []) {
      const { data: obdobi } = await supabase.rpc("rozpad_periody", {
        p_template_id: pravidlo.template_id,
      });

      if (!obdobi || obdobi.length === 0) continue;

      // Funkce řeší JEN „které nahrání patří k tomuhle období" — to byla ta
      // chyba. Které období se vůbec nabídne, se dál řídí historií TOHOTO
      // KPI, jinak by panel nabízel měsíce, ke kterým KPI žádnou hodnotu nemá
      // (jedna šablona plní víc KPI a ne každé vyjde v každém měsíci).
      const kUploadu = new Map(
        (obdobi as { period_end: string; upload_id: string }[]).map((o) => [
          o.period_end,
          o.upload_id,
        ]),
      );

      const videne = new Set<string>();
      periodyRozpad = [...history]
        .reverse()
        .filter((r) => kUploadu.has(r.period_end))
        .filter((r) => {
          if (videne.has(r.period_end)) return false;
          videne.add(r.period_end);
          return true;
        })
        .map((r) => ({
          uploadId: kUploadu.get(r.period_end) as string,
          periodEnd: r.period_end,
          periodType: r.period_type,
          label: formatPeriod(r.period_end, r.period_type),
        }));

      if (periodyRozpad.length === 0) continue;

      // Mapování slotů na sloupce ze šablony. Bez něj by šel rozpad počítat
      // jen jako součet sloupce — jenže poměrové KPI (marže) se sečíst nedá,
      // musí se vyhodnotit vzorec nad každou skupinou zvlášť.
      //
      // Nabídnout se ale smí JEN tehdy, když pravidlo umí obsloužit všechny
      // sloty vzorce. Starší pravidla mají jednoduchý tvar (`value_column`)
      // bez mapování slotů — u nich vrátí `hodnotaKpiProRadky` vždycky null
      // a uživatel by v celé tabulce viděl „nelze spočítat". Nabízet volbu,
      // která nemůže uspět, je horší než ji nenabídnout (2026-09-19).
      if (kpiDef.formula_spec && pravidlo.config) {
        const spec = kpiDef.formula_spec as FormulaSpec;
        const config = pravidlo.config as FormulaConfig;
        const potrebne = (spec.slots ?? []).filter((s) => !isSystemSlot(s.key));
        const vseNamapovano =
          potrebne.length > 0 && potrebne.every((s) => config.slots?.[s.key]);
        if (vseNamapovano) vzorec = { spec, config };
      }

      // V praxi plní jedno KPI jedna šablona. Kdyby jich bylo víc, vyhrává
      // první, která má uložené řádky — míchat období z různých šablon by
      // znamenalo míchat i různé mapování sloupců na sloty.
      break;
    }
  }

  const latest = history[history.length - 1];
  const target: KpiTarget | null = targetRow ?? null;
  const status = latest ? evaluateTarget(latest.value, target) : null;

  // Appka nikde reálně nesčítá hodnoty napříč obdobími (u procentuálních
  // KPI jako OEE by to ani nedávalo smysl) - průměr je vždy smysluplnější
  // sekundární statistika než tvrdit "součet", který se nikde nepočítá.
  const average =
    history.length > 0
      ? history.reduce((sum, r) => sum + r.value, 0) / history.length
      : null;

  const accentHex = status ? STATUS_HEX[status] : undefined;

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-6xl px-8 py-16 font-sans">
        <Link
          href="/kpis"
          className="group mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand dark:hover:text-brand-light"
        >
          <ArrowLeftIcon />
          Zpět na přehled
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
              {kpiDef.value_type === "snapshot" ? "Stav k datu" : "Hodnota za období"}
            </p>
            <h1 className="font-display text-3xl font-semibold text-brand-ink">
              {kpiDef.name}
            </h1>
          </div>
          <StatusBadge status={status} />
        </div>

        {history.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Zatím žádná data pro tohle KPI.
          </p>
        )}

        {history.length > 0 && (
          <div
            style={{
              borderTopColor: accentHex,
              backgroundImage: accentHex
                ? `radial-gradient(220px circle at 100% 0%, ${accentHex}12, transparent 70%)`
                : undefined,
            }}
            className="rounded-xl border border-t-4 border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="font-display mb-1 text-4xl font-semibold text-brand-ink dark:text-zinc-50">
              {formatValue(latest.value, kpiDef.unit)}
            </p>
            <p className="mb-4 text-xs text-zinc-400">
              naposledy {formatPeriod(latest.period_end, latest.period_type)}
              {average !== null && (
                <> · průměr {formatValue(average, kpiDef.unit)}</>
              )}
            </p>

            {history.length > 1 ? (
              <TrendChart
                data={history.map((r) => ({
                  period_end: formatPeriodShort(r.period_end, r.period_type),
                  value: r.value,
                }))}
                unit={kpiDef.unit}
              />
            ) : (
              <p className="text-sm text-zinc-400">
                Zatím jen jedno období — graf trendu se ukáže od druhého.
              </p>
            )}

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="pb-2 font-normal">Období</th>
                  <th className="pb-2 font-normal">Hodnota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {[...history].reverse().map((r) => (
                  <tr
                    key={r.period_end}
                    className="even:bg-zinc-50 dark:even:bg-zinc-900/50"
                  >
                    <td className="py-2 pl-2">
                      {formatPeriod(r.period_end, r.period_type)}
                    </td>
                    <td className="py-2 pl-2 font-medium">
                      {formatValue(r.value, kpiDef.unit)}
                      {/* Ať je poznat, které číslo nepochází ze souboru. */}
                      {r.entry_source === "manual" && (
                        <span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          ručně
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {periodyRozpad.length > 0 && (
          <RozpadPeriody
            periody={periodyRozpad}
            vzorec={vzorec}
            nazevKpi={kpiDef.name}
            jednotka={kpiDef.unit}
          />
        )}
      </div>
    </div>
  );
}
