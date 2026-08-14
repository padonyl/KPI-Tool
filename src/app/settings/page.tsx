import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TargetsForm } from "./TargetsForm";
import { CrystalField } from "@/components/marketing/CrystalField";

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

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

  const [{ data: kpiDefinitions }, { data: targets }] = await Promise.all([
    supabase
      .from("kpi_definitions")
      .select("id, name, unit, is_derived")
      .order("name"),
    supabase
      .from("kpi_targets")
      .select("kpi_definition_id, evaluation_type, min_value, max_value")
      .eq("company_id", profile.company_id),
  ]);

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Konfigurace
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Nastavení KPI
        </h1>
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          Vyber KPI a nastav, co pro něj aplikace potřebuje vědět. Co se
          nastavuje, se liší podle toho, jak se dané KPI počítá.
        </p>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0ca30c]/15 to-[#d03b3b]/15 text-brand">
                <TargetIcon />
              </div>
              <div>
                <h2 className="font-medium text-black dark:text-zinc-50">
                  Nastavení podle KPI
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Cíl určuje, kdy je hodnota zelená a kdy červená
                </p>
              </div>
            </div>
            <TargetsForm
              companyId={profile.company_id}
              kpiDefinitions={kpiDefinitions ?? []}
              targets={targets ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
