// Ukládání firemních údajů přes obrazovku /firma.
//
// Ověřuje to, co uživatel reálně udělá: otevře stránku, něco přepíše,
// uloží. A hlavně 24h zámek na zařazení — první změna projít má, druhá
// hned po ní ne, ale fakturační údaje jít uložit musí i tak.
//
// Jen dev, běží na existujícím testovacím adminovi, po sobě uklidí.
// Spustit: node scripts/test-firma-ukladani.mjs [base]

import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");

// Původní stav, ať se dá vrátit.
const { data: predProfil } = await sb.from("company_profile").select("*").eq("company_id", admin.companyId).single();
const { data: predKlas } = await sb.from("company_classification").select("*").eq("company_id", admin.companyId).single();

// Start bez zámku, ať je test opakovatelný.
await sb.from("company_classification").update({ changed_at: null }).eq("company_id", admin.companyId);

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();

/** Zavolá /api/firma z kontextu přihlášené stránky (session je v cookie). */
async function uloz(telo) {
  return p.evaluate(async (t) => {
    const r = await fetch("/api/firma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    return { stav: r.status, data: await r.json().catch(() => ({})) };
  }, telo);
}

try {
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  const hp = p.locator('input[placeholder="Heslo"]');
  const pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 60; i++) {
    await pr.click().catch(() => {});
    if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
    await p.waitForTimeout(500);
  }
  await p.locator('input[type="email"]').fill(admin.email);
  await hp.fill(admin.heslo);
  await p.locator('button[type="submit"]').click();
  await p.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 60000 });

  await p.goto(BASE + "/firma", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  zapis("admin se dostane na /firma", txt.includes("Údaje o firmě"), txt.slice(0, 80));
  // Hodnota inputu NENÍ v innerText — musí se číst přes inputValue().
  const poleNazev = p.locator("input").first();
  zapis("formulář je předvyplněný názvem firmy",
    (await poleNazev.inputValue()) === predProfil.name, await poleNazev.inputValue());

  const zaklad = {
    name: predProfil.name,
    ico: predProfil.ico ?? "",
    dic: predProfil.dic ?? "",
    billing_address: predProfil.billing_address ?? "",
    billing_email: predProfil.billing_email ?? "",
    website: predProfil.website ?? "",
  };
  const klasZaklad = {
    sector_id: predKlas.sector_id ?? "",
    size_band_id: predKlas.size_band_id ?? "",
    country: predKlas.country ?? "",
  };

  // --- 1. Fakturační údaje: uloží se ---
  const a = await uloz({
    profil: { ...zaklad, ico: "25596641", billing_address: "Testovací 1, Brno" },
    klasifikace: klasZaklad,
  });
  zapis("fakturační údaje se uloží", a.stav === 200, "HTTP " + a.stav + " " + JSON.stringify(a.data));

  const { data: poProfilu } = await sb.from("company_profile").select("ico, billing_address").eq("company_id", admin.companyId).single();
  zapis("IČO je opravdu v databázi", poProfilu.ico === "25596641", poProfilu.ico);

  // --- 2. Neplatné IČO se odmítne ---
  const spatne = await uloz({ profil: { ...zaklad, ico: "12345678" }, klasifikace: klasZaklad });
  zapis("IČO s chybnou kontrolní číslicí neprojde", spatne.stav === 400,
    "HTTP " + spatne.stav + " " + (spatne.data.chyba ?? ""));

  // --- 3. První změna zařazení projde ---
  const zeme1 = klasZaklad.country === "SK" ? "CZ" : "SK";
  const k1 = await uloz({ profil: zaklad, klasifikace: { ...klasZaklad, country: zeme1 } });
  zapis("první změna zařazení projde", k1.stav === 200 && k1.data.klasifikaceZmenena === true,
    "HTTP " + k1.stav);

  // --- 4. Druhá změna hned po ní neprojde ---
  const k2 = await uloz({ profil: zaklad, klasifikace: { ...klasZaklad, country: "DE" } });
  zapis("druhá změna zařazení narazí na zámek", k2.stav === 409 && k2.data.zamek === true,
    "HTTP " + k2.stav + " " + (k2.data.chyba ?? "").slice(0, 70));

  const { data: poZamku } = await sb.from("company_classification").select("country").eq("company_id", admin.companyId).single();
  zapis("zamčená změna se do databáze nedostala", poZamku.country === zeme1,
    "v DB " + poZamku.country + ", pokus byl DE");

  // --- 5. Fakturační údaje jdou uložit i při zamčeném zařazení ---
  const a2 = await uloz({
    profil: { ...zaklad, ico: "25596641", website: "https://example.test" },
    klasifikace: { ...klasZaklad, country: zeme1 },
  });
  zapis("fakturační údaje jdou uložit i se zamčeným zařazením", a2.stav === 200, "HTTP " + a2.stav);

  // --- 6. Uložení beze změny zámek nespustí ani nespadne ---
  const bezZmeny = await uloz({
    profil: { ...zaklad, ico: "25596641", website: "https://example.test" },
    klasifikace: { ...klasZaklad, country: zeme1 },
  });
  zapis("uložení beze změny projde a nic nezmění",
    bezZmeny.stav === 200 && bezZmeny.data.zmeneno === 0,
    "HTTP " + bezZmeny.stav + " zmeneno=" + bezZmeny.data.zmeneno);

  // --- 7. Změna se zapsala do aktivit ---
  const { data: aktivity } = await sb.from("activity_log")
    .select("action").eq("company_id", admin.companyId).eq("action", "firma.udaje_zmeneny")
    .order("created_at", { ascending: false }).limit(5);
  zapis("změny se zaznamenaly do aktivit", (aktivity?.length ?? 0) > 0,
    (aktivity?.length ?? 0) + " záznamů");
} catch (e) {
  zapis("průchod ukládáním", false, e.message.slice(0, 140));
} finally {
  await b.close();
  await sb.from("company_profile").update({
    ico: predProfil.ico, dic: predProfil.dic, billing_address: predProfil.billing_address,
    billing_email: predProfil.billing_email, website: predProfil.website, name: predProfil.name,
  }).eq("company_id", admin.companyId);
  await sb.from("company_classification").update({
    sector_id: predKlas.sector_id, size_band_id: predKlas.size_band_id,
    country: predKlas.country, changed_at: predKlas.changed_at,
  }).eq("company_id", admin.companyId);
  console.log("\npůvodní údaje vráceny");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
