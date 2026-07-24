import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeliveriesUploadForm } from "./DeliveriesUploadForm";
import { CrystalField } from "@/components/marketing/CrystalField";

export default async function UploadDeliveriesPage() {
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

  const [
    { data: existingMappings },
    { data: tolerances },
    { data: otifKpis },
  ] = await Promise.all([
    supabase
      .from("delivery_column_mappings")
      .select("source_column_name, role")
      .eq("company_id", profile.company_id),
    supabase
      .from("delivery_tolerances")
      .select("direction, on_time_tolerance_days, in_full_tolerance_pct")
      .eq("company_id", profile.company_id),
    supabase
      .from("kpi_definitions")
      .select("id, code")
      .in("code", ["otif_dodavatele", "otif_zakaznici"]),
  ]);

  const otifKpiByDirection = {
    inbound: otifKpis?.find((k) => k.code === "otif_dodavatele")?.id ?? null,
    outbound: otifKpis?.find((k) => k.code === "otif_zakaznici")?.id ?? null,
  };

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <h1 className="font-display mb-6 text-2xl font-semibold text-brand-ink">
          Nahrát report dodávek
        </h1>
        <DeliveriesUploadForm
          companyId={profile.company_id}
          userId={profile.id}
          existingMappings={existingMappings ?? []}
          tolerances={tolerances ?? []}
          otifKpiByDirection={otifKpiByDirection}
        />
      </div>
    </div>
  );
}
