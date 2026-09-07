import { vyzadujProfil } from "@/lib/page-auth";
import { NewTemplateForm } from "./NewTemplateForm";
import { CrystalField } from "@/components/marketing/CrystalField";

export default async function NewTemplatePage() {
  // Mapování a vzorce v šabloně nastavuje admin firmy (nález testu 2026-09-06).
  const { supabase, profil: profile, blok } = await vyzadujProfil("customer_admin");
  if (blok) return blok;

  const { data: kpiDefinitions } = await supabase
    .from("kpi_definitions")
    .select("id, code, name, category, unit, is_derived, formula_spec")
    .order("name");

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-6xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Šablony
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Nová šablona
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Namapuj vzorový soubor jednou — pak už jen vybíráš tuhle šablonu při
          každém dalším nahrání.
        </p>
        <NewTemplateForm
          companyId={profile.company_id}
          userId={profile.id}
          kpiDefinitions={kpiDefinitions ?? []}
        />
      </div>
    </div>
  );
}
