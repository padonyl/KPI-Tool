import { NextResponse } from "next/server";
import { ocistiText } from "@/lib/text";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";
import { overSpravce, najdiClena, jePosledniAdmin } from "@/lib/team-auth";

// Změna role člena týmu.
//
// Ověření oprávnění dělá appka sama přes team-auth — service_role klient
// níže obchází řádkovou bezpečnost, takže ta kontrola JE bezpečnostní
// hranice, ne jen pohodlí. Stejný vzor jako /api/team/invite.

const PLATNE_ROLE = ["user", "customer_superuser", "customer_admin"] as const;

export async function POST(request: Request) {
  const { userId, role, poznamka } = await request.json();

  if (!PLATNE_ROLE.includes(role)) {
    return NextResponse.json({ error: "Neplatná role." }, { status: 400 });
  }

  const spravce = await overSpravce();
  if (!spravce.ok) {
    return NextResponse.json({ error: spravce.chyba }, { status: spravce.stav });
  }

  const clen = await najdiClena(spravce.data, userId);
  if (!clen.ok) {
    return NextResponse.json({ error: clen.chyba }, { status: clen.stav });
  }

  if (clen.data.role === role) {
    return NextResponse.json({ error: "Tuhle roli už má." }, { status: 400 });
  }

  // Firma nesmí zůstat bez správce — platí i pro sebe sama, právě proto
  // se nekontroluje „není to volající", ale „je poslední admin".
  if (role !== "customer_admin" && (await jePosledniAdmin(clen.data))) {
    return NextResponse.json(
      {
        error:
          "Tohle je poslední admin firmy. Nejdřív povyš někoho jiného, jinak by firma zůstala bez správce.",
      },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ role })
    .eq("id", clen.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(admin, {
    companyId: spravce.data.companyId,
    userId: spravce.data.id,
    action: "team.role_changed",
    metadata: {
      target_email: clen.data.email,
      from: clen.data.role,
      to: role,
      poznamka:
        typeof poznamka === "string" && ocistiText(poznamka) ? ocistiText(poznamka) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
