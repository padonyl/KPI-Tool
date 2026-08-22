import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { posliVlastnikovi, sablonaNovaRegistrace } from "@/lib/mail";
import { logActivity } from "@/lib/log-activity";

// ============================================================
// Ohlášení nově založené firmy (migrace 0009).
//
// Volá se hned po dokončení onboardingu. Vygeneruje jednorázový token,
// uloží ho k firmě a pošle vlastníkovi notifikaci s odkazy na schválení
// a zamítnutí.
//
// TOKEN SE GENERUJE TADY, NA SERVERU, a klient ho nikdy neuvidí. Kdyby
// si ho generoval prohlížeč (nebo kdyby ho šlo přečíst z řádku firmy),
// uživatel by si vzal svůj token, vložil ho do odkazu a schválil si
// firmu sám. Proto migrace 0009 zároveň odebírá approval_token ze
// SELECT grantu pro roli authenticated.
//
// Endpoint je bezpečný proti zneužití tím, že pracuje VÝHRADNĚ s firmou
// přihlášeného volajícího - nedá se jím sáhnout na cizí řádek.
// ============================================================

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nepřihlášeno." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profil, error: profilError } = await admin
    .from("users")
    .select("id, email, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profilError || !profil) {
    return NextResponse.json(
      { error: profilError?.message ?? "Účet není napojený na firmu." },
      { status: 404 },
    );
  }

  const { data: firma, error: firmaError } = await admin
    .from("companies")
    .select("id, name, status, approval_token")
    .eq("id", profil.company_id)
    .maybeSingle();

  if (firmaError || !firma) {
    return NextResponse.json(
      { error: firmaError?.message ?? "Firma nenalezena." },
      { status: 404 },
    );
  }

  // Už vyřízená firma se znovu neohlašuje - jinak by šlo opakovaným
  // voláním generovat nové tokeny ke schválené firmě.
  if (firma.status !== "pending") {
    return NextResponse.json({ ok: true, jizVyrizeno: true });
  }

  // Token přežívá opakované volání, ať dvě notifikace nezneplatní jedna
  // druhou (uživatel obnoví stránku a starší odkaz by přestal fungovat).
  const token = firma.approval_token ?? crypto.randomUUID();

  if (!firma.approval_token) {
    const { error } = await admin
      .from("companies")
      .update({ approval_token: token })
      .eq("id", firma.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const zaklad =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { predmet, html } = sablonaNovaRegistrace({
    email: profil.email,
    firma: firma.name,
    token,
    zaklad,
  });

  // Selhání e-mailu nesmí shodit registraci - firma je založená a čeká,
  // vlastník ji najde i dotazem do databáze. Chyba se jen zaloguje.
  await posliVlastnikovi({ predmet, html });

  await logActivity(admin, {
    companyId: firma.id,
    userId: profil.id,
    action: "access.requested",
    metadata: { email: profil.email, firma: firma.name },
  });

  return NextResponse.json({ ok: true });
}
