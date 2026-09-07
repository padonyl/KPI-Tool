import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { maAspon, type Role } from "@/lib/role";
import { NedostatecnaRole } from "@/components/NedostatecnaRole";
import { BezFirmy } from "@/components/BezFirmy";

// Společná předehra chráněné stránky.
//
// Devět stránek mělo tenhle sled zkopírovaný ručně: getUser → redirect na
// přihlášení → načíst profil → hláška "nepatří k firmě" → kontrola role.
// To není jen opisování: je to bezpečnostní kontrakt roztažený do devíti
// kopií, kde se na kontrolu role dá při psaní desáté stránky prostě
// zapomenout (a přesně to se 2026-09-06 stalo — viz role.ts).
//
// Sloupce se načítají všechny tři (id, company_id, role), i když je někde
// potřeba jen company_id. Je to tentýž řádek, takže dotaz nestojí víc, a
// stránky tím přestanou řešit, co si musí vyžádat.

export type Profil = { id: string; company_id: string; role: Role };

type Klient = Awaited<ReturnType<typeof createClient>>;

/**
 * `blok` je hotový výstup k vrácení, když se dál nemá pokračovat.
 * Typ je rozlišená unie, takže po `if (blok) return blok;` TypeScript ví,
 * že `profil` už není null — volající nemusí nic přetypovávat.
 */
type Vysledek =
  | { supabase: Klient; profil: Profil; blok: null }
  | { supabase: Klient; profil: null; blok: ReactElement };

/**
 * Ověří přihlášení, načte profil a volitelně vynutí minimální roli.
 *
 * Nepřihlášený se přesměruje na /login (redirect vyhazuje, dál se nejde).
 * Přihlášený bez firmy nebo s nízkou rolí dostane `blok` k vrácení.
 *
 * @param minimum vyžadovaná role; bez ní stačí být přihlášený a mít firmu
 * @param sirka šířka bloku "nepatří k firmě" — musí sedět s okolní stránkou
 */
export async function vyzadujProfil(
  minimum?: Role,
  sirka: "2xl" | "6xl" = "6xl",
): Promise<Vysledek> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("users")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data) {
    return { supabase, profil: null, blok: <BezFirmy sirka={sirka} /> };
  }

  const profil = data as Profil;

  if (minimum && !maAspon(profil.role, minimum)) {
    return { supabase, profil: null, blok: <NedostatecnaRole minimum={minimum} /> };
  }

  return { supabase, profil, blok: null };
}
