import { vyzadujProfil } from "@/lib/page-auth";
import { CrystalField } from "@/components/marketing/CrystalField";
import { FirmaForm } from "./FirmaForm";
import { zbyvajiciZamekHodin } from "@/lib/firma-udaje";

export default async function FirmaPage() {
  // Firemní údaje mění admin firmy. Ostatní je ani nevidí — nemají co.
  const { supabase, profil: uzivatel, blok } = await vyzadujProfil("customer_admin");
  if (blok) return blok;

  const [{ data: profil }, { data: klasifikace }, { data: sektory }, { data: velikosti }] =
    await Promise.all([
      supabase
        .from("company_profile")
        .select("name, ico, dic, billing_address, billing_email, website")
        .eq("company_id", uzivatel.company_id)
        .maybeSingle(),
      supabase
        .from("company_classification")
        .select("sector_id, size_band_id, country, changed_at")
        .eq("company_id", uzivatel.company_id)
        .maybeSingle(),
      supabase.from("sectors").select("id, name").order("sort_order"),
      supabase.from("company_size_bands").select("id, label").order("sort_order"),
    ]);

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Konfigurace
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Údaje o firmě
        </h1>
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          Identifikace a fakturace se dají měnit kdykoliv. Zařazení firmy je
          jiná kategorie — vstupuje do srovnání s ostatními, takže jde měnit
          jen jednou za den.
        </p>

        <FirmaForm
          profil={profil ?? {}}
          klasifikace={klasifikace ?? {}}
          sektory={sektory ?? []}
          velikosti={velikosti ?? []}
          zamekHodin={zbyvajiciZamekHodin(klasifikace?.changed_at ?? null)}
        />
      </div>
    </div>
  );
}
