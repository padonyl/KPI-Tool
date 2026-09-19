import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Automatická retence: smaže syrové řádky i nahrané soubory, kterým
// uplynula doba uchování nastavená na šabloně.
//
// PROČ ROUTA A NE `pg_cron`: pg_cron běží uvnitř databáze a umí SQL.
// Úložiště souborů je ale API mimo databázi, takže by na něj nedosáhl —
// a retence, která smaže řádky a nechá ležet původní soubor s týmiž daty,
// je jen poloviční. Odsud jde obojí a zapíše se o tom jeden záznam.
//
// ZABEZPEČENÍ: routa běží pod service_role, tedy bez řádkové bezpečnosti.
// Spustit ji smí jen Vercel Cron, který posílá `Authorization: Bearer
// <CRON_SECRET>`. Bez nastaveného tajemství se routa odmítne spustit
// úplně — mlčky běžet nezabezpečená je horší než neběžet vůbec.
// (Týž druh chyby jako u `smaz_prosle_source_rows`, kde chybějící revoke
// znamenal „smí každý" — viz migrace 0020.)

/** Když šablona retenci nemá nastavenou, platí tahle. */
const VYCHOZI_RETENCE_DNI = 365;

export async function GET(request: Request) {
  const tajemstvi = process.env.CRON_SECRET;
  if (!tajemstvi) {
    console.error("[cron/retence] CRON_SECRET není nastavené — routa se nespustí.");
    return NextResponse.json({ chyba: "Není nastavené tajemství." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${tajemstvi}`) {
    return NextResponse.json({ chyba: "Nepovoleno." }, { status: 401 });
  }

  const admin = createAdminClient();
  const zacatek = Date.now();

  const { data: beh } = await admin
    .from("retence_behy")
    .insert({})
    .select("id")
    .single();

  const dokonci = async (data: Record<string, unknown>) => {
    if (beh?.id) {
      await admin
        .from("retence_behy")
        .update({ ...data, dokonceno_at: new Date().toISOString(), trvani_ms: Date.now() - zacatek })
        .eq("id", beh.id);
    }
  };

  try {
    // --- 1. syrové řádky ---
    // Maže databázová funkce: je to jeden příkaz nad miliony řádků, což
    // je práce pro databázi, ne pro stahování dávek přes síť.
    const { data: radku, error: chybaRadku } = await admin.rpc("smaz_prosle_source_rows", {
      vychozi_dny: VYCHOZI_RETENCE_DNI,
    });
    if (chybaRadku) throw new Error("řádky: " + chybaRadku.message);

    // --- 2. nahrané soubory ---
    // Bere se jen to, co MÁ cestu, ještě nebylo smazané a u čeho se dá
    // retence zjistit (zná se šablona). Nahrání bez šablony se nechává být:
    // radši soubor ponechat než smazat naslepo podle odhadu.
    const { data: kandidati, error: chybaVypisu } = await admin
      .from("uploads")
      .select("id, storage_path, uploaded_at, template_id, upload_templates(rows_retention_days)")
      .not("storage_path", "is", null)
      .is("file_deleted_at", null)
      .not("template_id", "is", null)
      .limit(1000);
    if (chybaVypisu) throw new Error("výpis souborů: " + chybaVypisu.message);

    const ted = Date.now();
    const kSmazani = (kandidati ?? []).filter((u) => {
      const sablona = u.upload_templates as unknown as { rows_retention_days: number | null } | null;
      const dni = sablona?.rows_retention_days ?? VYCHOZI_RETENCE_DNI;
      const stariDni = (ted - new Date(u.uploaded_at).getTime()) / 86_400_000;
      return stariDni > dni;
    });

    let souboru = 0;
    if (kSmazani.length > 0) {
      const cesty = kSmazani.map((u) => u.storage_path as string);
      const { error: chybaMazani } = await admin.storage.from("company-uploads").remove(cesty);
      if (chybaMazani) throw new Error("mazání souborů: " + chybaMazani.message);

      // Označit až PO úspěšném smazání. Kdyby se to obrátilo a mazání
      // selhalo, soubor by v úložišti zůstal a nikdo by se o něj už
      // nepokusil — tiše by tam ležel napořád.
      const { error: chybaZnacky } = await admin
        .from("uploads")
        .update({ file_deleted_at: new Date().toISOString(), storage_path: null })
        .in("id", kSmazani.map((u) => u.id));
      if (chybaZnacky) throw new Error("označení souborů: " + chybaZnacky.message);

      souboru = kSmazani.length;
    }

    await dokonci({ radku_smazano: radku ?? 0, souboru_smazano: souboru });

    return NextResponse.json({
      ok: true,
      radkuSmazano: radku ?? 0,
      souboruSmazano: souboru,
      trvaniMs: Date.now() - zacatek,
    });
  } catch (e) {
    const zprava = e instanceof Error ? e.message : String(e);
    console.error("[cron/retence]", zprava);
    await dokonci({ chyba: zprava });
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
