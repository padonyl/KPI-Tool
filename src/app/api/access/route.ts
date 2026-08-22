import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";

// ============================================================
// Schválení / zamítnutí účtu odkazem (migrace 0009).
//
// PROČ TAKHLE A NE OBRAZOVKOU V APPCE: seznam firem napříč tenanty by
// vyžadoval roli s přístupem přes hranice firem - přesně ten RLS bypass,
// který schéma úmyslně nemá (viz komentář u user_role v
// kpi_tool_schema.sql). Tenhle endpoint umí jedinou věc: přepnout stav
// JEDNÉ konkrétní firmy, ke které patří jednorázový token. Žádné
// procházení, žádné vypisování, žádná nová role.
//
// Token se posílá jen vlastníkovi v notifikaci o nové registraci a po
// použití se maže. Není to přihlášení ani session.
// ============================================================

const AKCE = { approve: "approved", reject: "rejected" } as const;

function odpoved(nadpis: string, text: string, ok: boolean) {
  // Prostá HTML odpověď - tenhle endpoint se otevírá z e-mailu, takže
  // nemá smysl kolem něj stavět stránku v appce.
  return new NextResponse(
    `<!doctype html><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${nadpis}</title>
     <div style="font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;color:#111826">
       <h1 style="font-size:1.4rem;margin:0 0 .6rem;color:${ok ? "#0f6b41" : "#8a2f2f"}">${nadpis}</h1>
       <p style="color:#47526b;margin:0">${text}</p>
     </div>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const akce = url.searchParams.get("akce");

  if (!token || !(akce === "approve" || akce === "reject")) {
    return odpoved("Neplatný odkaz", "Odkazu chybí token nebo akce.", false);
  }

  const admin = createAdminClient();

  const { data: firma, error } = await admin
    .from("companies")
    .select("id, name, status")
    .eq("approval_token", token)
    .maybeSingle();

  if (error) {
    return odpoved("Něco se pokazilo", error.message, false);
  }

  // Token se po použití maže, takže tohle je i případ "odkaz už byl použit".
  if (!firma) {
    return odpoved(
      "Odkaz už neplatí",
      "Buď byl použitý, nebo firmu mezitím někdo vyřídil jinak.",
      false,
    );
  }

  const novyStav = AKCE[akce];

  const { error: updateError } = await admin
    .from("companies")
    .update({ status: novyStav, approval_token: null })
    .eq("id", firma.id);

  if (updateError) {
    return odpoved("Nepodařilo se uložit", updateError.message, false);
  }

  await logActivity(admin, {
    companyId: firma.id,
    userId: null,
    action: novyStav === "approved" ? "access.approved" : "access.rejected",
    metadata: { firma: firma.name },
  });

  return novyStav === "approved"
    ? odpoved(
        "Firma schválena",
        `${firma.name} má teď přístup do aplikace.`,
        true,
      )
    : odpoved(
        "Firma zamítnuta",
        `${firma.name} se do aplikace nedostane. Rozhodnutí jde změnit v databázi.`,
        true,
      );
}
