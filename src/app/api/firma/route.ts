import { NextResponse } from "next/server";
import { overSpravce } from "@/lib/team-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";
import {
  pripravProfil,
  pripravKlasifikaci,
  zkontrolujUdaje,
  zmenenaPole,
  zbyvajiciZamekHodin,
  ZAMEK_HODIN,
} from "@/lib/firma-udaje";

// Uložení firemních údajů.
//
// PROČ TO JDE PŘES SERVER a ne přímo z prohlížeče jako většina zápisů:
// appka posílá dotazy pod identitou uživatele, takže kdyby měl admin právo
// zapisovat do `company_classification` přímo, obešel by aplikaci (curl
// s vlastním tokenem) a s ní i 24h zámek. A ten zámek existuje právě proti
// člověku, který by přenastavováním parametrů vlastní firmy zkoumal, jak se
// posouvají srovnávací hodnoty v benchmarkingu. Obrana, která jde přeskočit
// jedním příkazem, není obrana.
//
// Proto `authenticated` nemá na těch tabulkách právo zápisu vůbec (migrace
// 0017) a jediná cesta k zápisu vede tudy, pod service_role.

export async function POST(request: Request) {
  const spravce = await overSpravce("Upravovat údaje firmy");
  if (!spravce.ok) {
    return NextResponse.json({ chyba: spravce.chyba }, { status: spravce.stav });
  }
  const { id: userId, companyId } = spravce.data;

  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return NextResponse.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }
  const { profil: profilVstup, klasifikace: klasifikaceVstup } =
    (telo ?? {}) as Record<string, unknown>;

  const profil = pripravProfil(profilVstup);
  const klasifikace = pripravKlasifikaci(klasifikaceVstup);

  const problem = zkontrolujUdaje(profil, klasifikace);
  if (problem) return NextResponse.json({ chyba: problem }, { status: 400 });

  const admin = createAdminClient();

  const [{ data: stavProfil }, { data: stavKlasifikace }] = await Promise.all([
    admin.from("company_profile").select("*").eq("company_id", companyId).maybeSingle(),
    admin.from("company_classification").select("*").eq("company_id", companyId).maybeSingle(),
  ]);

  const zmenyProfil = zmenenaPole(profil, stavProfil);
  const zmenyKlasifikace = zmenenaPole(klasifikace, stavKlasifikace);

  // Zámek se testuje jen když se zařazení SKUTEČNĚ mění. Uložení beze změny
  // (uživatel otevřel formulář a jen klikl) projít musí — jinak by si člověk
  // omylem zamkl formulář na den.
  if (zmenyKlasifikace.length > 0) {
    const zbyva = zbyvajiciZamekHodin(stavKlasifikace?.changed_at ?? null);
    if (zbyva > 0) {
      return NextResponse.json(
        {
          chyba:
            `Zařazení firmy jde měnit nejvýš jednou za ${ZAMEK_HODIN} hodin. ` +
            `Zkus to prosím znovu za ${zbyva} h. Ostatní údaje uložit můžeš.`,
          zamek: true,
          zbyvaHodin: zbyva,
        },
        { status: 409 },
      );
    }
  }

  if (zmenyProfil.length > 0) {
    const { error } = await admin
      .from("company_profile")
      .upsert(
        { company_id: companyId, ...profil, updated_at: new Date().toISOString() },
        { onConflict: "company_id" },
      );
    if (error) {
      console.error("[api/firma] profil:", error.message);
      return NextResponse.json({ chyba: "Údaje se nepodařilo uložit." }, { status: 500 });
    }
  }

  if (zmenyKlasifikace.length > 0) {
    const ted = new Date().toISOString();
    const { error } = await admin
      .from("company_classification")
      .upsert(
        { company_id: companyId, ...klasifikace, changed_at: ted, updated_at: ted },
        { onConflict: "company_id" },
      );
    if (error) {
      console.error("[api/firma] klasifikace:", error.message);
      return NextResponse.json({ chyba: "Zařazení se nepodařilo uložit." }, { status: 500 });
    }
  }

  if (zmenyProfil.length > 0 || zmenyKlasifikace.length > 0) {
    // Zaznamenávají se NÁZVY změněných polí, ne hodnoty. Na pozdější
    // vyhodnocování (kdo si s údaji hraje) to stačí a do logu se tím
    // nedostanou fakturační kontakty, které jsou osobní údaj.
    await logActivity(admin, {
      companyId,
      userId,
      action: "firma.udaje_zmeneny",
      metadata: { profil: zmenyProfil, klasifikace: zmenyKlasifikace },
    });
  }

  return NextResponse.json({
    ok: true,
    zmeneno: zmenyProfil.length + zmenyKlasifikace.length,
    klasifikaceZmenena: zmenyKlasifikace.length > 0,
  });
}
