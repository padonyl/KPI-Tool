import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendChart } from "@/components/TrendChart";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluateTarget, type KpiTarget, type Status } from "@/lib/kpi-targets";
import { CrystalField } from "@/components/marketing/CrystalField";
import { formatPeriod, formatPeriodShort } from "@/lib/format-period";
import { formatNumber, formatValue } from "@/lib/format-number";

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tento uživatel zatím není napojený na žádnou firmu.
        </p>
      </div>
    );
  }

  const [{ data: kpiDef }, { data: rows }, { data: targetRow }] =
    await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("id, name, unit, value_type")
        .eq("id", kpiId)
        .maybeSingle(),
      supabase
        .from("kpi_values")
        .select("value, period_end, period_type")
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
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
