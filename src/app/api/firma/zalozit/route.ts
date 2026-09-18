import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ocistiText } from "@/lib/text";

// Založení firmy při onboardingu.
//
// PROČ NA SERVERU: od migrace 0017 žijí firemní údaje ve třech tabulkách
// podle toho, kdo je smí měnit, a `authenticated` nemá na `company_profile`
// ani `company_classification` právo zápisu — jinak by se dal obejít 24h
// zámek na zařazení. Zakládání proto musí proběhnout pod service_role.
//
// Vedlejší přínos: dřív se firma a napojení uživatele zakládaly dvěma
// samostatnými dotazy z prohlížeče. Když druhý selhal, zůstala v databázi
// firma bez jediného uživatele — nikdo ji neviděl a nikdo ji neuklidil.
// Tady se po sobě aspoň uklidí.

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ chyba: "Nepřihlášeno." }, { status: 401 });

  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return NextResponse.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }
  const { name, sector_id, size_band_id } = (telo ?? {}) as Record<string, unknown>;

  const nazev = ocistiText(typeof name === "string" ? name : "").trim();
  if (nazev.length < 2) {
    return NextResponse.json({ chyba: "Zadej název firmy (minimálně 2 znaky)." }, { status: 400 });
  }
  if (nazev.length > 120) {
    return NextResponse.json({ chyba: "Název firmy je moc dlouhý (max 120 znaků)." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Jeden transakční příkaz místo čtyř samostatných vložení (migrace 0018).
  // Buď vznikne firma se vším, co k ní patří, nebo nevznikne nic — dřív se
  // při selhání uprostřed dala v databázi najít firma bez jediného
  // uživatele, kterou nikdo neviděl a nikdo neuklidil.
  const { data: companyId, error } = await admin.rpc("zaloz_firmu", {
    p_auth_user_id: user.id,
    p_email: user.email,
    p_nazev: nazev,
    p_sector_id: typeof sector_id === "string" && sector_id ? sector_id : null,
    p_size_band_id: typeof size_band_id === "string" && size_band_id ? size_band_id : null,
  });

  if (error) {
    console.error("[api/firma/zalozit]", error.code, error.message);
    // 23505 = k účtu už firma patří. Ostatní chyby jsou naše, ne uživatelovy.
    if (error.code === "23505") {
      return NextResponse.json({ chyba: "K tomuhle účtu už je firma napojená." }, { status: 409 });
    }
    return NextResponse.json({ chyba: "Firmu se nepodařilo založit." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, companyId });
}
