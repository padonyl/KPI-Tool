// Oprava z migrace 0022: rozpad musí ukázat skladbu z NEJNOVĚJŠÍHO nahrání
// daného období, ne z toho, na které náhodou ukazuje kpi_values.
//
// Reprodukuje původní chybu (nápadník 2026-09-07): firma nahraje za stejné
// období soubor se STEJNÝM součtem, ale JINÝM rozpadem. `writeKpiValues` při
// shodné hodnotě nic nepřepíše, takže `source_upload_id` zůstane na starém
// nahrání — a proklik ukáže starou skladbu. Součet sedí, detail lže.
//
// Jen dev, po sobě uklidí. Spustit: node scripts/test-rozpad-nejnovejsi.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }

const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};
// Přeskočené se NESMÍ počítat jako prošlé — test, co se sám nespustil, není
// důkaz o ničem. Dřív se to tu stávalo a nafukovalo to počet „prošlo".
let preskoceno = 0;
const preskoc = (n, d = "") => {
  preskoceno += 1;
  console.log("SKIP   " + n + (d ? "  (" + d + ")" : ""));
};

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");

const jako = createClient(URL_, ANON, { auth: { persistSession: false } });
{
  const { error } = await jako.auth.signInWithPassword({ email: admin.email, password: admin.heslo });
  if (error) { console.error("login: " + error.message); process.exit(1); }
}
const { data: ja } = await jako.from("users").select("id").eq("email", admin.email).single();

const OBDOBI = "2032-05-31";
const templateId = randomUUID();
const uklid = { uploady: [] };

try {
  {
    const { error } = await jako.from("upload_templates").insert({
      id: templateId, company_id: admin.companyId,
      name: "TEST-nejnovejsi-" + Date.now(),
      date_column_name: "datum", period_type: "month",
      source_columns: ["datum", "material", "castka"],
      store_rows: true, rows_retention_days: 365, created_by: ja.id,
    });
    if (error) throw new Error("šablona: " + error.message);
  }

  // Obě nahrání mají STEJNÝ součet (1000), ale obrácenou skladbu.
  async function nahraj(znacka, oceloviny, hlinik, pred) {
    const { data, error } = await jako.from("uploads").insert({
      company_id: admin.companyId, uploaded_by: ja.id,
      file_name: znacka + ".csv", template_id: templateId, status: "processed",
      uploaded_at: new Date(Date.now() - pred).toISOString(),
    }).select("id").single();
    if (error) throw new Error("nahrání " + znacka + ": " + error.message);
    uklid.uploady.push(data.id);

    const radky = [
      { material: "Ocel", castka: String(oceloviny) },
      { material: "Hliník", castka: String(hlinik) },
    ].map((d) => ({
      company_id: admin.companyId, upload_id: data.id, template_id: templateId,
      period_end: OBDOBI, period_type: "month",
      data: { datum: "2032-05-15", ...d },
    }));
    const { error: e2 } = await jako.from("source_rows").insert(radky);
    if (e2) throw new Error("řádky " + znacka + ": " + e2.message);
    return data.id;
  }

  const stare = await nahraj("stare", 100, 900, 3 * 86_400_000);
  const nove = await nahraj("nove", 900, 100, 1 * 86_400_000);
  zapis("připravena dvojice se stejným součtem (1000) a obrácenou skladbou", true);

  // === jádro: co funkce vrátí ===
  const { data: obdobi, error: chyba } = await jako.rpc("rozpad_periody", {
    p_template_id: templateId,
  });
  if (chyba) throw new Error("rpc: " + chyba.message);

  const nase = (obdobi ?? []).filter((o) => o.period_end === OBDOBI);
  zapis("období se vrátí právě jednou", nase.length === 1, "vráceno " + nase.length);
  zapis("vybráno NEJNOVĚJŠÍ nahrání", nase[0]?.upload_id === nove,
    nase[0]?.upload_id === stare ? "vybralo staré — chyba se vrátila" : "ok");
  zapis("počet řádků je jen z nového nahrání, ne součet obou",
    Number(nase[0]?.radku) === 2, "vrátilo " + nase[0]?.radku);

  // Skladba, kterou by uživatel viděl.
  {
    const { data: r } = await jako.from("source_rows")
      .select("data").eq("upload_id", nase[0]?.upload_id).eq("period_end", OBDOBI);
    const ocel = (r ?? []).find((x) => x.data.material === "Ocel");
    zapis("proklik ukáže NOVOU skladbu (Ocel 900, ne 100)",
      ocel?.data?.castka === "900", "Ocel = " + ocel?.data?.castka);
  }

  // === zabezpečení funkce ===
  {
    const anonKlient = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error } = await anonKlient.rpc("rozpad_periody", { p_template_id: templateId });
    zapis("nepřihlášený funkci nespustí", !!error, error?.message?.slice(0, 60) ?? "prošlo!");
  }

  // === cizí firma nesmí nic dostat (SECURITY INVOKER + RLS) ===
  //
  // Bez tohohle testu je celá funkce neověřená v tom nejdůležitějším bodě.
  // V personách druhá firma není (po úklidu devu 2026-09-18 zbyla jedna),
  // ale test-firma-bezpecnost.mjs si zakládá stálou „CIZI-Firma-Test" —
  // tu tady najdeme a přihlásíme se za jejího uživatele.
  {
    const CIZI_NAZEV = "CIZI-Firma-Test";
    const HESLO = "Heslo-Test-12345";
    let cizi = null;
    const { data: profil } = await sb.from("company_profile")
      .select("company_id").eq("name", CIZI_NAZEV).maybeSingle();
    if (profil) {
      const { data: uziv } = await sb.from("users")
        .select("email").eq("company_id", profil.company_id).limit(1);
      if (uziv?.[0]?.email) cizi = { email: uziv[0].email, heslo: HESLO };
    }

    if (cizi) {
      const c = createClient(URL_, ANON, { auth: { persistSession: false } });
      const { error: le } = await c.auth.signInWithPassword({ email: cizi.email, password: cizi.heslo });
      if (le) {
        preskoc("cizí firma nedostane naše období", "nelze se přihlásit: " + le.message.slice(0, 40));
      } else {
        const { data: d } = await c.rpc("rozpad_periody", { p_template_id: templateId });
        zapis("cizí firma nedostane naše období", (d ?? []).length === 0,
          "vráceno " + (d ?? []).length + " řádků");
      }
    } else {
      preskoc("cizí firma nedostane naše období",
        "firma " + CIZI_NAZEV + " neexistuje — spusť nejdřív test-firma-bezpecnost.mjs");
    }
  }

  // === retence: když staré nahrání zmizí, nové se pořád najde ===
  {
    await sb.from("source_rows").delete().eq("upload_id", stare);
    const { data: po } = await jako.rpc("rozpad_periody", { p_template_id: templateId });
    const n2 = (po ?? []).filter((o) => o.period_end === OBDOBI);
    zapis("po smazání starých řádků období nezmizí", n2.length === 1);
    zapis("a pořád ukazuje na nové nahrání", n2[0]?.upload_id === nove);
  }

  // === opačný směr: samotné staré nahrání se najde taky ===
  {
    await sb.from("source_rows").delete().eq("upload_id", nove);
    const { data: po } = await jako.rpc("rozpad_periody", { p_template_id: templateId });
    const n3 = (po ?? []).filter((o) => o.period_end === OBDOBI);
    zapis("bez řádků nevrací období vůbec", n3.length === 0,
      "vráceno " + n3.length + " (obě nahrání jsou prázdná)");
  }
} catch (e) {
  zapis("průchod testem", false, e.message.slice(0, 160));
} finally {
  // POZOR na to, KTERÝ klient co maže. `service_role` smí mazat source_rows,
  // ale na uploads ani upload_templates nemá DELETE — a mazání, které RLS
  // zastaví, vrátí NULOVÝ počet BEZ CHYBY. Úklid pak jen vypadá, že proběhl.
  // Takhle tu 2026-09-19 zůstaly tři osiřelé šablony. Proto se maže
  // přihlášeným klientem a výsledek se kontroluje.
  const zkus = async (co) => { try { return await co(); } catch { return null; } };
  for (const id of uklid.uploady) {
    await zkus(() => sb.from("source_rows").delete().eq("upload_id", id));
    await zkus(() => jako.from("uploads").delete().eq("id", id));
  }
  await zkus(() => jako.from("upload_templates").delete().eq("id", templateId));

  const { data: zbyla } = await jako.from("upload_templates").select("id").eq("id", templateId);
  console.log((zbyla ?? []).length === 0
    ? "\nuklizeno"
    : "\nPOZOR: testovací šablona " + templateId.slice(0, 8) + " se nesmazala");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo" + (preskoceno ? ", " + preskoceno + " přeskočeno" : "") + ".");
process.exit(chyb ? 1 : 0);
