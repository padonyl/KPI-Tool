"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Vyzvedne přihlášení z kotvy adresy (`#access_token=…`).
//
// Kotva se na server neposílá, takže tenhle krok nejde udělat jinak než
// v prohlížeči. Týká se odkazů z POZVÁNEK — Supabase je vyrábí
// administrátorským rozhraním, které tok PKCE nepoužívá.

export function DokonceniZKotvy({ kam }: { kam: string }) {
  const router = useRouter();
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
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

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setChyba(error.message);
          return;
        }
        // replace, ne push: tlačítko zpět nemá vracet na adresu, která má
        // v kotvě přihlašovací token.
        router.replace(kam);
      });
  }, [kam, router]);

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
