import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";

// Skutečné ověření odkazu z e-mailu. Jen POST — viz komentář na
// ../page.tsx: kdyby to šlo přes GET, spotřebují jednorázový token
// mailové aplikace a skenery schránek dřív, než na odkaz klikne člověk.
//
// Musí to být route handler, ne stránka: zakládá se tu relace, tedy
// ZAPISUJÍ cookies, což serverová komponenta v Next.js nesmí.

const POVOLENE_TYPY = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function POST(request: NextRequest) {
  const formular = await request.formData();
  const token_hash = String(formular.get("token_hash") ?? "");
  const type = String(formular.get("type") ?? "");
  const next = String(formular.get("next") ?? "");

  // Jen relativní cesta — s cizí adresou by z toho byla otevřená
  // přesměrovací díra použitelná v podvodných e-mailech.
  const kam = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // 303: po POSTu se musí pokračovat GETem, jinak by se přesměrování
  // poslalo znovu jako POST.
  const chybnyOdkaz = (duvod: string) =>
    NextResponse.redirect(
      new URL(`/auth/callback?chyba=${encodeURIComponent(duvod)}`, request.url),
      303,
    );

  if (!token_hash || !type || !POVOLENE_TYPY.has(type)) {
    return chybnyOdkaz("Odkaz je neúplný nebo poškozený. Nech si poslat nový.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    // Do logu celou chybu i se stavem — bez toho se selhání na produkci
    // nedá diagnostikovat. Token se NELOGUJE, je to přihlašovací údaj.
    console.error("[auth/confirm] verifyOtp selhalo:", {
      status: error.status,
      message: error.message,
      type,
    });

    // Supabase umí vrátit i prázdné tělo chyby (viděno na produkci
    // 2026-09-12: hláška byla doslova „{}"). Takový text uživateli nic
    // neřekne, tak ho nahradíme použitelnou větou a stav připojíme jako
    // kód — podle něj se pozná, co se dělo, i ze screenshotu.
    const prelozeno = translateAuthError(error.message);
    const maPismeno = [...prelozeno].some((z) => z.toLowerCase() !== z.toUpperCase());
    const kPouziti = prelozeno.trim().length > 4 && maPismeno;
    const duvod = kPouziti
      ? prelozeno
      : error.status === 429
        ? "Zkusil sis poslat odkazů moc rychle po sobě. Počkej pár minut a nech si poslat nový."
        : "Odkaz se nepodařilo ověřit. Nech si prosím poslat nový.";

    return chybnyOdkaz(error.status ? `${duvod} (kód ${error.status})` : duvod);
  }

  return NextResponse.redirect(new URL(kam, request.url), 303);
}
