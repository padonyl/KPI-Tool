import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Ověření platformního admina (migrace 0011).
//
// DVOJITÝ ZÁMEK: e-mail musí být zapsaný v `platform_admins` V DATABÁZI
// a zároveň v proměnné ADMIN_EMAILS. Průnik do databáze sám o sobě
// admina neudělá a překlep v proměnné taky ne.
//
// HRANICE: admin vidí METADATA firem, ne jejich data. Zakázané tabulky
// se tu záměrně NEVYJMENOVÁVAJÍ - seznam by byl mrtvá deklarace, kterou
// nikdo nevynucuje. Vynucuje ji test e2e/admin-hranice.spec.ts, který
// čte zdrojové soubory admin části a spadne, když v nich takový dotaz
// najde.
//
// Přístup k číslům zákazníka bude samostatná funkce na pozvání od té
// firmy, časově omezená (rozhodnuto 2026-08-22).
// ============================================================

export type Admin = { authUserId: string; email: string };

function povoleneEmaily(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Vrátí admina, nebo null. Null znamená „tady nic není" — volající má
 * odpovědět 404, ne 403. Existenci admin sekce nemá smysl potvrzovat
 * někomu, kdo do ní nepatří.
 */
export async function overAdmina(
  jizOvereny?: { id: string; email?: string } | null,
): Promise<Admin | null> {
  // Volitelný parametr je kvůli horní liště, která se vykresluje na KAŽDÉ
  // stránce a uživatele si už ověřila sama. Bez něj by se `getUser()`
  // volal dvakrát za každé vykreslení, a to je pokaždé kolo po síti.
  // Předává se jen výsledek `supabase.auth.getUser()`, nikdy nic, co by
  // šlo ovlivnit zvenčí.
  let user = jizOvereny ?? null;
  if (!user) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user?.email) return null;

  const email = user.email.toLowerCase();

  // Zámek 1: proměnná prostředí. Kontroluje se první, protože je to
  // levné a nevyžaduje dotaz do databáze.
  const povolene = povoleneEmaily();
  if (povolene.length === 0 || !povolene.includes(email)) return null;

  // Zámek 2: záznam v databázi. Čte service_role, protože tabulka
  // nemá grant pro authenticated a je pro appku neviditelná.
  const { data, error } = await createAdminClient()
    .from("platform_admins")
    .select("auth_user_id, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return { authUserId: data.auth_user_id, email: data.email };
}
