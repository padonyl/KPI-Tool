import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Ověření pro operace nad týmem (pozvat, změnit roli, odebrat přístup).
//
// PROČ SPOLEČNĚ: všechny tři sahají na `users` přes service_role, který
// řádkovou bezpečnost obchází úplně. Ta kontrola tedy NENÍ pohodlí, ale
// jediná bezpečnostní hranice, která tam je. Rozkopírovaná na třech
// místech je otázka času, kdy se jedna kopie rozejde.
//
// Dvě věci, které se nesmí vynechat ani u jedné operace:
//   1. volající je customer_admin,
//   2. cíl patří do TÉŽE firmy.
//
// Bez druhé podmínky by admin jedné firmy mohl přes service_role měnit
// role a přístupy komukoliv v databázi — stačilo by uhodnout cizí id.
// ============================================================

export type Spravce = { id: string; companyId: string };
export type Clen = {
  id: string;
  email: string;
  role: string;
  status: string;
  companyId: string;
};

export type Vysledek<T> = { ok: true; data: T } | { ok: false; chyba: string; stav: number };

/** Ověří, že volající je přihlášený customer_admin. */
export async function overSpravce(): Promise<Vysledek<Spravce>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, chyba: "Nepřihlášeno.", stav: 401 };

  const { data } = await supabase
    .from("users")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data || data.role !== "customer_admin") {
    return { ok: false, chyba: "Spravovat tým smí jen admin firmy.", stav: 403 };
  }

  return { ok: true, data: { id: data.id, companyId: data.company_id } };
}

/**
 * Najde člena týmu a ověří, že patří do firmy volajícího.
 *
 * Záměrně vrací stejnou hlášku pro „neexistuje" i „je z jiné firmy" —
 * jinak by se dalo uhodnout, která id v databázi existují.
 */
export async function najdiClena(
  spravce: Spravce,
  userId: unknown,
): Promise<Vysledek<Clen>> {
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, chyba: "Chybí uživatel.", stav: 400 };
  }

  const { data } = await createAdminClient()
    .from("users")
    .select("id, email, role, status, company_id")
    .eq("id", userId)
    .maybeSingle();

  if (!data || data.company_id !== spravce.companyId) {
    return { ok: false, chyba: "Uživatel ve tvé firmě není.", stav: 404 };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      email: data.email,
      role: data.role,
      status: data.status,
      companyId: data.company_id,
    },
  };
}

/**
 * Hlídá, aby firma nezůstala bez správce.
 *
 * Volá se před KAŽDOU změnou, která by člověku vzala roli admina — ať
 * už degradací, nebo odebráním přístupu. Bez toho by se admin mohl
 * omylem odstřihnout sám a firma by pak nemohla ani pozvat kolegu;
 * musel by to rozplétat provozovatel ručně v databázi.
 *
 * Vrací true, když je cíl POSLEDNÍ aktivní admin firmy.
 */
export async function jePosledniAdmin(clen: Clen): Promise<boolean> {
  if (clen.role !== "customer_admin" || clen.status !== "active") return false;

  const { count } = await createAdminClient()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", clen.companyId)
    .eq("role", "customer_admin")
    .eq("status", "active");

  return (count ?? 0) <= 1;
}
