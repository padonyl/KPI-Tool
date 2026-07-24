import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewTemplateForm } from "./NewTemplateForm";
import { CrystalField } from "@/components/marketing/CrystalField";

export default async function NewTemplatePage() {
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

  const { data: kpiDefinitions } = await supabase
    .from("kpi_definitions")
    .select("id, code, name, unit, is_derived")
    .order("name");

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
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
