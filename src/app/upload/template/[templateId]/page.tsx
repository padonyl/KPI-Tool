import { notFound } from "next/navigation";
import { vyzadujProfil } from "@/lib/page-auth";
import { TemplateUploadForm } from "./TemplateUploadForm";
import { CrystalField } from "@/components/marketing/CrystalField";

export default async function TemplateUploadPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase, profil: profile, blok } = await vyzadujProfil(undefined, "2xl");
  if (blok) return blok;

  const { data: template } = await supabase
    .from("upload_templates")
    .select("id, name, date_column_name, period_type, company_id, store_rows")
    .eq("id", templateId)
    .maybeSingle();

  if (!template || template.company_id !== profile.company_id) {
    notFound();
  }

  const { data: rules } = await supabase
    .from("template_kpi_rules")
    .select(
      "id, kpi_definition_id, rule_type, config, kpi_definitions(name, code, unit, formula_spec, category)",
    )
    .eq("template_id", templateId);

  // HR pojistka na ZÁPISOVÉ cestě (čl. 9 GDPR): u šablony s KPI z „Lidé a
  // růst" (absence, úrazy) se syrové řádky NIKDY neukládají, i kdyby byl
  // store_rows omylem/podvržením zapnutý. Efektivní příznak se počítá tady
  // na serveru a formulář jen zapisuje řádky, když je true.
  const maHrKpi = (rules ?? []).some(
    // @ts-expect-error - supabase nested join typing
    (r) => r.kpi_definitions?.category === "Lidé a růst",
  );
  const storeRows = template.store_rows === true && !maHrKpi;

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Data
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Nahrát: {template.name}
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {rules?.length ?? 0} KPI se z tohoto souboru dopočítá automaticky.
        </p>
        <TemplateUploadForm
          companyId={profile.company_id}
          userId={profile.id}
          template={{
            id: template.id,
            dateColumnName: template.date_column_name,
            periodType: template.period_type,
            storeRows,
            // Oddělený příznak: „neukládat řádky" a „je to HR" nejsou totéž.
            // Šablona může mít ukládání vyplé a HR nebýt — soubor se pak
            // uchovat MÁ. Vynechává se jen u HR (čl. 9 GDPR).
            jeHr: maHrKpi,
          }}
          rules={(rules ?? []).map((r) => ({
            kpiDefinitionId: r.kpi_definition_id,
            // @ts-expect-error - supabase nested join typing
            kpiName: r.kpi_definitions?.name ?? "?",
            // @ts-expect-error - supabase nested join typing
            kpiCode: r.kpi_definitions?.code ?? "",
            // @ts-expect-error - supabase nested join typing
            kpiUnit: r.kpi_definitions?.unit ?? "",
            // @ts-expect-error - supabase nested join typing
            formulaSpec: r.kpi_definitions?.formula_spec ?? null,
            ruleType: r.rule_type,
            config: r.config,
          }))}
        />
      </div>
    </div>
  );
}
