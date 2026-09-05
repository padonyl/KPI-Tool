import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DokonceniZKotvy } from "./DokonceniZKotvy";

// ============================================================
// Přistání po kliknutí na odkaz z e-mailu.
//
// Supabase posílá přihlašovací údaje DVĚMA různými způsoby a tahle
// stránka musí umět obojí:
//
//   1. `?code=…` v adrese — tok PKCE. Vzniká, když si odkaz vyžádala
//      appka z prohlížeče (obnova hesla přes „Zapomenuté heslo?").
//      Server ho vidí a rovnou vymění za přihlášení.
//
//   2. `#access_token=…` v KOTVĚ adresy — tok, který používají odkazy
//      vyrobené administrátorským rozhraním, tedy POZVÁNKY KOLEGŮ.
//      Kotvu prohlížeč na server NEPOSÍLÁ, takže o ní tahle funkce
//      neví — musí ji vyzvednout kód běžící v prohlížeči.
//
// Původní verze uměla jen první případ a druhý mlčky posílala na
// přihlášení. Pozvaný kolega tak skončil ve slepé uličce: heslo neměl,
// takže se nemohl přihlásit, a registrace mu řekla, že e-mail už
// existuje. Nahlásil to uživatel 5. 9. 2026.
// ============================================================

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const { code, next } = await searchParams;
  // Jen relativní cesta — s cizí adresou by z toho byla otevřená
  // přesměrovací díra použitelná v podvodných e-mailech.
  const kam = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(kam);
  }

  // Bez `code` může být přihlášení schované v kotvě. Rozhodnout to umí
  // až prohlížeč.
  return <DokonceniZKotvy kam={kam} />;
}
