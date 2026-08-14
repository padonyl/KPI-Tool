import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManualValueForm, type ManualKpi } from "./ManualValueForm";
import { CrystalField } from "@/components/marketing/CrystalField";

export default async function ManualEntryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, company_id")
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

  const [{ data: definitions }, { data: templates }] = await Promise.all([
    supabase
      .from("kpi_definitions")
      .select("id, code, name, category, unit, description")
      .order("category")
      .order("name"),
    // Kvůli varování "tohle KPI ti přepíše nejbližší nahrání souboru".
    supabase
      .from("upload_templates")
      .select("name, template_kpi_rules(kpi_definition_id)")
      .eq("company_id", profile.company_id),
  ]);

  const templatesByKpi = new Map<string, string[]>();
  for (const t of templates ?? []) {
    for (const rule of (t.template_kpi_rules ?? []) as { kpi_definition_id: string }[]) {
      const list = templatesByKpi.get(rule.kpi_definition_id) ?? [];
      list.push(t.name);
      templatesByKpi.set(rule.kpi_definition_id, list);
    }
  }

  const kpis: ManualKpi[] = (definitions ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    category: d.category,
    unit: d.unit,
    description: d.description,
    coveredByTemplates: templatesByKpi.get(d.id) ?? [],
  }));

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Data
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Zapsat hodnotu ručně
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pro čísla, která nemá smysl tahat ze souboru — počet úrazů za měsíc,
          výsledek dotazníku spokojenosti, investice do školení.
        </p>
        <ManualValueForm
          companyId={profile.company_id}
          userId={profile.id}
          kpis={kpis}
        />
      </div>
    </div>
  );
}
