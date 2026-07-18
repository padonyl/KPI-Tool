import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToleranceForm } from "./ToleranceForm";
import { TargetsForm } from "./TargetsForm";

export default async function SettingsPage() {
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

  const [{ data: tolerances }, { data: kpiDefinitions }, { data: targets }] =
    await Promise.all([
      supabase
        .from("delivery_tolerances")
        .select("direction, on_time_tolerance_days, in_full_tolerance_pct")
        .eq("company_id", profile.company_id),
      supabase.from("kpi_definitions").select("id, name, unit").order("name"),
      supabase
        .from("kpi_targets")
        .select("kpi_definition_id, evaluation_type, min_value, max_value")
        .eq("company_id", profile.company_id),
    ]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Nastavení KPI</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Provizorní obrazovka, designově se předělá později.
      </p>

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium">Cíle pro vyhodnocení (zelená/červená)</h2>
          <TargetsForm
            companyId={profile.company_id}
            kpiDefinitions={kpiDefinitions ?? []}
            targets={targets ?? []}
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Tolerance pro OTIF</h2>
          <ToleranceForm companyId={profile.company_id} tolerances={tolerances ?? []} />
        </div>
      </div>
    </div>
  );
}
