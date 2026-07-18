import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./UploadForm";

export default async function UploadPage() {
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

  const [{ data: kpiDefinitions }, { data: existingMappings }] =
    await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("id, code, name, unit, value_type")
        .eq("is_derived", false)
        .order("name"),
      supabase
        .from("column_mappings")
        .select("source_column_name, kpi_definition_id, is_date_column")
        .eq("company_id", profile.company_id),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Nahrát data</h1>
      <UploadForm
        companyId={profile.company_id}
        userId={profile.id}
        kpiDefinitions={kpiDefinitions ?? []}
        existingMappings={existingMappings ?? []}
      />
    </div>
  );
}
