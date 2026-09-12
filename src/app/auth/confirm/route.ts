import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";

// Potvrzení odkazu z e-mailu, které funguje NA JAKÉMKOLIV ZAŘÍZENÍ.
//
// Proč tohle existuje vedle /auth/callback:
// `@supabase/ssr` má `flowType: "pkce"` napevno. U toku PKCE si prohlížeč,
// který o odkaz požádal, uloží tajemství (`code_verifier`) a bez něj odkaz
// dokončit nejde. Kdo tedy požádá o obnovu hesla na počítači a e-mail
// otevře na telefonu, má smůlu — a to je úplně běžné chování, ne výjimka.
//
// `verifyOtp` s `token_hash` žádný verifier nepotřebuje: hash ověřuje server
// přímo proti Supabase. Odkaz tak jde dokončit kdekoliv.
//
// MUSÍ to být route handler, ne stránka: zakládá se tu relace, což znamená
// ZAPSAT cookies, a serverová komponenta v Next.js to nesmí (přesně tenhle
// rozdíl způsobil, že obnova hesla nefungovala vůbec — viz komentář
// v DokonceniPrihlaseni.tsx).
//
// Aby sem odkazy vedly, musí šablona e-mailu v Supabase (Authentication →
// Email Templates) místo {{ .ConfirmationURL }} používat:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
// Odkazy, které jsou už rozeslané, dál obslouží /auth/callback.

const POVOLENE_TYPY = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  // Jen relativní cesta — s cizí adresou by z toho byla otevřená
  // přesměrovací díra použitelná v podvodných e-mailech.
  const kam = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const chybnyOdkaz = (duvod: string) =>
    NextResponse.redirect(
      new URL(`/auth/callback?chyba=${encodeURIComponent(duvod)}`, request.url),
    );

  if (!token_hash || !type || !POVOLENE_TYPY.has(type)) {
    return chybnyOdkaz("Odkaz je neúplný nebo poškozený. Nech si poslat nový.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return chybnyOdkaz(translateAuthError(error.message));
  }

  return NextResponse.redirect(new URL(kam, request.url));
}
