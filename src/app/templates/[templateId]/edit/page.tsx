import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewTemplateForm, type ExistingTemplate } from "@/app/templates/new/NewTemplateForm";
import { describeRule } from "@/lib/template-rules";
import { CrystalField } from "@/components/marketing/CrystalField";
import { BACK_LINK } from "@/lib/ui-classes";
import type { FormulaSpec } from "@/lib/formula";

type KpiDefRow = {
  name: string;
  code: string;
  unit: string;
  formula_spec: FormulaSpec | null;
};

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, company_id, role")
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

  // Mapování a šablony smí měnit jen admin firmy (stejně jako mazání).
  if (profile.role !== "customer_admin") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Upravovat šablony může jen správce firmy.
        </p>
      </div>
    );
  }

  const { data: template } = await supabase
    .from("upload_templates")
    .select("id, name, date_column_name, source_columns, company_id")
    .eq("id", templateId)
    .maybeSingle();

  if (!template || template.company_id !== profile.company_id) {
    notFound();
  }

  const [{ data: rules }, { data: kpiDefinitions }] = await Promise.all([
    supabase
      .from("template_kpi_rules")
      .select(
        "kpi_definition_id, rule_type, config, kpi_definitions(name, code, unit, formula_spec)",
      )
      .eq("template_id", templateId),
    supabase
      .from("kpi_definitions")
      .select("id, code, name, unit, is_derived, formula_spec")
      .order("name"),
  ]);

  const existing: ExistingTemplate = {
    id: template.id,
    name: template.name,
    dateColumnName: template.date_column_name,
    sourceColumns: template.source_columns ?? [],
    rules: (rules ?? []).map((r) => {
      // Supabase typuje vnořený join jako pole, i když je vztah 1:1.
      const def = r.kpi_definitions as unknown as KpiDefRow | null;
      return {
        kpiDefinitionId: r.kpi_definition_id,
        kpiName: def?.name ?? "?",
        kpiCode: def?.code ?? "",
        kpiUnit: def?.unit ?? "",
        formulaSpec: def?.formula_spec ?? null,
        ruleType: r.rule_type,
        config: r.config,
        summary: describeRule(r.rule_type, r.config, def?.formula_spec ?? null),
      };
    }),
  };

  const missingColumns = existing.sourceColumns.length === 0;

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <Link href="/templates" className={`mb-4 inline-block ${BACK_LINK}`}>
          ← Zpět na šablony
        </Link>
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Šablony
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Upravit: {template.name}
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Změny se projeví až u dalšího nahrání — už spočítané hodnoty zůstanou
          takové, jaké jsou.
        </p>

        {missingColumns && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Tahle šablona vznikla dřív, než si aplikace začala pamatovat názvy
            sloupců, takže je nemá z čeho nabídnout. Nahraj vzorový soubor níže —
            tím se doplní a zároveň se zapne živý náhled výsledku.
          </div>
        )}

        <NewTemplateForm
          companyId={profile.company_id}
          userId={profile.id}
          kpiDefinitions={kpiDefinitions ?? []}
          existing={existing}
        />
      </div>
    </div>
  );
}
