import { NextResponse } from "next/server";
import { overAdmina } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";

// ============================================================
// Schválení / zamítnutí firmy z admin prostředí.
//
// Vedle cesty přes odkaz v e-mailu (/api/access), která pracuje s
// jednorázovým tokenem. Tady je volající přihlášený admin, takže se
// ověřuje on, ne token.
//
// Zápis do activity_log nese, KDO změnu provedl — u zásahu do cizí
// firmy je to podstatnější než u čehokoliv jiného v aplikaci.
// ============================================================

const POVOLENE = { approve: "approved", reject: "rejected" } as const;

export async function POST(request: Request) {
  const admin = await overAdmina();
  // 404, ne 403: komu tam nic není, ten se nemá dozvědět, že tam něco je.
  if (!admin) {
    return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
  }

  const { companyId, akce } = await request.json();

  if (typeof companyId !== "string" || !(akce in POVOLENE)) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const db = createAdminClient();
  const novyStav = POVOLENE[akce as keyof typeof POVOLENE];

  const { data: firma, error: chybaCteni } = await db
    .from("companies")
    .select("id, name, status")
    .eq("id", companyId)
    .maybeSingle();

  if (chybaCteni || !firma) {
    return NextResponse.json({ error: "Firma nenalezena." }, { status: 404 });
  }

  const { error } = await db
    .from("companies")
    .update({ status: novyStav, approval_token: null })
    .eq("id", companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(db, {
    companyId,
    userId: null,
    action: novyStav === "approved" ? "access.approved" : "access.rejected",
    metadata: {
      firma: firma.name,
      predchoziStav: firma.status,
      zdroj: "admin",
      provedl: admin.email,
    },
  });

  return NextResponse.json({ ok: true, stav: novyStav });
}
