import { NextResponse } from "next/server";
import { ocistiText } from "@/lib/text";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";
import { overSpravce, najdiClena, jePosledniAdmin } from "@/lib/team-auth";

// Odebrání a vrácení přístupu (users.status, migrace 0013).
//
// Nemaže se řádek: na `users(id)` visí pět cizích klíčů bez určeného
// chování při smazání, takže delete by selhal u každého, kdo cokoliv
// udělal — a přepsat je na „vynuluj odkaz" by z historie odstranilo KDO.
// Vysvětlené v migraci 0013.
//
// Vynucení je v auth_company_id(), kterou používá všech 43 politik:
// jakmile status není 'active', uživatel neuvidí nic. Tenhle endpoint
// tedy jen přepíná stav, neřeší přístup k jednotlivým tabulkám.

// 'suspended' tu ZÁMĚRNĚ není. Pozastavení z naší strany je provozovatelova
// pravomoc a nemá jít vyvolat z účtu zákazníka — jinak by si firma mohla
// sama zrušit pozastavení, které jsme jí nastavili.
const PLATNE_STAVY = ["active", "deactivated"] as const;

const POPIS: Record<string, string> = {
  active: "vrácen přístup",
  deactivated: "odebrán přístup",
};

export async function POST(request: Request) {
  const { userId, status, poznamka } = await request.json();

  if (!PLATNE_STAVY.includes(status)) {
    return NextResponse.json({ error: "Neplatný stav." }, { status: 400 });
  }

  const spravce = await overSpravce();
  if (!spravce.ok) {
    return NextResponse.json({ error: spravce.chyba }, { status: spravce.stav });
  }

  const clen = await najdiClena(spravce.data, userId);
  if (!clen.ok) {
    return NextResponse.json({ error: clen.chyba }, { status: clen.stav });
  }

  if (clen.data.status === status) {
    return NextResponse.json({ error: "V tomhle stavu už je." }, { status: 400 });
  }

  // Pozastavení nastavuje provozovatel a firma ho nesmí zrušit sama.
  if (clen.data.status === "suspended") {
    return NextResponse.json(
      { error: "Tenhle přístup pozastavil provozovatel. Ozvi se nám." },
      { status: 409 },
    );
  }

  if (status === "deactivated" && (await jePosledniAdmin(clen.data))) {
    return NextResponse.json(
      {
        error:
          "Tohle je poslední admin firmy. Nejdřív povyš někoho jiného, jinak by se firma zamkla.",
      },
      { status: 409 },
    );
  }

  const cistaPoznamka =
    typeof poznamka === "string" && ocistiText(poznamka)
      ? ocistiText(poznamka).slice(0, 500)
      : null;

  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({
      status,
      status_reason: cistaPoznamka,
      status_changed_at: new Date().toISOString(),
      status_changed_by: spravce.data.id,
    })
    .eq("id", clen.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sloupec status_reason drží jen důvod PLATNÉHO stavu a přepisuje se.
  // Evidence každé jednotlivé změny patří sem — po dvojím odebrání a
  // vrácení by ve sloupci zbyla poslední věta.
  await logActivity(admin, {
    companyId: spravce.data.companyId,
    userId: spravce.data.id,
    action: "team.access_changed",
    metadata: {
      target_email: clen.data.email,
      from: clen.data.status,
      to: status,
      popis: POPIS[status],
      poznamka: cistaPoznamka,
    },
  });

  return NextResponse.json({ ok: true });
}
