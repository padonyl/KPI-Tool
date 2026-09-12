"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

// Dokončení přihlášení po kliknutí na odkaz z e-mailu.
//
// Běží ZÁMĚRNĚ celé v prohlížeči, i pro tok PKCE (`?code=…`), který by
// technicky zvládl i server. Důvod: výměna kódu za přihlášení musí ZAPSAT
// cookies, jenže serverová komponenta v Next.js cookies zapisovat nesmí a
// náš serverový klient ten neúspěch tiše spolkne (viz lib/supabase/server.ts,
// `catch {}` v setAll). Dřív se to dělalo na serveru a dopadalo to takhle:
// jednorázový kód z e-mailu se u Supabase spotřeboval, výměna "uspěla",
// stránka přesměrovala na /reset-password — ale relace se nikam neuložila.
// Uživatel dostal „Auth session missing!" a druhý klik na odkaz už nepomohl,
// protože kód byl pryč. Nahlásil uživatel 12. 9. 2026.
//
// Supabase posílá přihlašovací údaje dvěma způsoby a oba se řeší tady:
//   1. `?code=…` — tok PKCE. Vzniká, když si odkaz vyžádala appka
//      z prohlížeče (obnova hesla přes „Zapomenuté heslo?").
//   2. `#access_token=…` v KOTVĚ adresy — odkazy vyrobené administrátorským
//      rozhraním, tedy POZVÁNKY KOLEGŮ. Kotvu prohlížeč na server vůbec
//      neposílá, takže tenhle případ jinde než v prohlížeči vyřešit nejde.

export function DokonceniPrihlaseni({
  kam,
  pocatecniChyba = null,
}: {
  kam: string;
  /** Hláška z /auth/confirm — ten už ověřování udělal a neuspěl. */
  pocatecniChyba?: string | null;
}) {
  const router = useRouter();
  const [chyba, setChyba] = useState<string | null>(pocatecniChyba);

  useEffect(() => {
    // Když sem někdo přišel s hotovou chybou z /auth/confirm, není co zkoušet.
    if (pocatecniChyba) return;

    let zruseno = false;
    const supabase = createClient();

    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (zruseno) return;
        if (error) {
          setChyba(translateAuthError(error.message));
          return;
        }
        // replace, ne push: tlačítko zpět nemá vracet na adresu, která nese
        // přihlašovací token.
        router.replace(kam);
        return;
      }

      const kotva = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = kotva.get("access_token");
      const refresh_token = kotva.get("refresh_token");

      if (!access_token || !refresh_token) {
        // Popis chyby posílá Supabase taky v kotvě — když je odkaz starý
        // nebo už použitý, je tam vysvětlení srozumitelnější než naše.
        setChyba(
          kotva.get("error_description") ??
            "Odkaz je neplatný nebo už vypršel. Nech si poslat nový.",
        );
        return;
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (zruseno) return;
      if (error) {
        setChyba(translateAuthError(error.message));
        return;
      }
      router.replace(kam);
    })();

    return () => {
      zruseno = true;
    };
  }, [kam, router, pocatecniChyba]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        {chyba ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-black dark:text-zinc-50">
              Odkaz nefunguje
            </h1>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{chyba}</p>
            <Link href="/login" className="text-sm text-brand underline">
              Zpět na přihlášení
            </Link>
          </>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Přihlašuju…</p>
        )}
      </div>
    </div>
  );
}
