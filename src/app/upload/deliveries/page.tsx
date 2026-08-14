import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeliveriesUploadForm } from "./DeliveriesUploadForm";
import { ToleranceForm } from "@/app/settings/ToleranceForm";
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
        <h1 className="font-display mb-2 text-2xl font-semibold text-brand-ink">
          Nahrát report dodávek
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Starší přímý tok bez šablony. Novější cesta je{" "}
          <Link href="/templates" className="text-brand hover:underline">
            šablona s pravidlem pro OTIF
          </Link>{" "}
          — ta umí mít tolerance jiné pro každý zdroj dat.
        </p>

        {/* Tolerance sem přesunuty z /settings (2026-08-14): platí JEN pro tenhle
            starší tok, šablony si nesou vlastní. V nastavení KPI vypadaly, jako
            by platily všude, a přitom je nahrávání přes šablonu ignorovalo. */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-1 font-medium text-black dark:text-zinc-50">
            Tolerance pro OTIF
          </h2>
          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            Použijí se při vyhodnocení souboru nahraného tímhle tokem.
          </p>
          <ToleranceForm companyId={profile.company_id} tolerances={tolerances ?? []} />
        </div>

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
