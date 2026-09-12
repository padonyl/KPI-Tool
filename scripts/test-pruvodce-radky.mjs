// Ověření opravy A: průvodce novou šablonou importuje vzorový soubor rovnou —
// a když je zapnuté ukládání řádků, MUSÍ se ty řádky uložit i při tomhle
// prvním nahrání. Dřív se neukládaly vůbec.
// Jen dev. Spustit: node scripts/test-pruvodce-radky.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

const NAZEV = `E2E-Pruvodce-${Date.now()}`;
const c = createClient(URL, ANON);
const { error: le } = await c.auth.signInWithPassword({ email: admin.email, password: admin.heslo });
if (le) { console.error("login:", le.message); process.exit(1); }

// Všechna ne-HR KPI mají dnes vzorec (direct/aggregated jsou jen legacy), takže
// průvodce ukáže slotový builder. Bereme nejjednodušší případ: jeden slot.
const { data: kpis } = await c.from("kpi_definitions")
  .select("id, name, unit, category, is_derived, formula_spec")
  .neq("category", "Lidé a růst").order("name");
const kpi = (kpis ?? []).find(
  (k) => !k.is_derived && (k.formula_spec?.slots ?? []).length === 1 && (k.unit ?? "").trim() !== "%",
);
if (!kpi) { console.error("nenašlo se KPI s jedním slotem"); process.exit(1); }
console.log(`  KPI: ${kpi.name} [${kpi.unit}], slot ${kpi.formula_spec.slots[0].key}`);

// Tři různé měsíce → direct pravidlo dá jednu hodnotu na období (žádná kolize).
const csv = "datum,castka,material\n2029-03-10,100,Ocel\n2029-04-12,200,Hlinik\n2029-05-14,50,Ocel\n";
const csvPath = path.join(os.tmpdir(), `pruvodce-${Date.now()}.csv`);
writeFileSync(csvPath, csv, "utf8");

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
let templateId = null;

try {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const hp = p.locator('input[placeholder="Heslo"]'), pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 60; i++) {
    await pr.click().catch(() => {});
    if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
    await p.waitForTimeout(500);
  }
  await p.locator('input[type="email"]').fill(admin.email);
  await hp.fill(admin.heslo);
  await p.locator('button[type="submit"]').click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

  await p.goto(`${BASE}/templates/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.locator('input[type="file"]').setInputFiles(csvPath);
  await p.waitForTimeout(2500);

  // Hlavička: výchozí "názvy beru z 1. řádku" je správně, nic se neklikne.
  // Období: průvodce si sloupec s datem i délku období odhadne sám a ptá se
  // na potvrzení. Když by odhad nevyšel, spadne se do ručního výběru.
  const souhlas = p.getByRole("button", { name: "Ano, souhlasí" });
  if (await souhlas.count()) {
    await souhlas.first().click();
    await p.waitForTimeout(1800);
  } else {
    const rucne = p.getByRole("button", { name: "Ne, nastavím to ručně" });
    if (await rucne.count()) { await rucne.first().click(); await p.waitForTimeout(1200); }
    const mesic = p.getByRole("button", { name: /^Měsíc/ });
    if (await mesic.count()) { await mesic.first().click(); await p.waitForTimeout(1500); }
  }
  zapis("průvodce došel k mapování KPI", (await p.getByText("Přidat KPI do šablony").count()) > 0);

  // KPI → slotový builder: kliknout na sloupec "castka" v paletě (jde to
  // klikem, drag není potřeba) a tím ho vložit do jediného slotu.
  const selects = p.locator("select");
  await selects.first().selectOption(kpi.id);
  await p.waitForTimeout(1500);

  const chip = p.getByRole("button", { name: "castka", exact: true });
  await chip.first().waitFor({ timeout: 15000 });
  await chip.first().click();
  await p.waitForTimeout(1000);
  zapis("sloupec vložen do slotu vzorce", true);

  await p.getByRole("button", { name: "Přidat pravidlo do šablony" }).click();
  await p.waitForTimeout(1500);
  const potizRule = await p.locator("p.text-red-600").first().innerText().catch(() => "");
  if (potizRule) console.log("  hláška u pravidla:", potizRule.slice(0, 120));

  // Zapnout ukládání řádků. Je to první zaškrtávátko na stránce (druhé je
  // "nahrát data rovnou", které je zapnuté už ve výchozím stavu).
  const prepinac = p.locator('input[type="checkbox"]').first();
  await prepinac.check();
  zapis("přepínač ukládání řádků je zapnutý", await prepinac.isChecked());

  await p.locator('input[placeholder*="Sales"]').fill(NAZEV);
  await p.waitForTimeout(600);

  await p.getByRole("button", { name: /Uložit šablonu/ }).first().click();

  // Počkat na dokončení (průvodce může chtít potvrdit konflikty/vynechané řádky)
  let hotovo = false;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1500);
    const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    if (/Rovnou se nahrálo|Šablona uložena|Hotovo/i.test(txt)) { hotovo = true; break; }
    const dal = p.getByRole("button", { name: /Pokračovat|Uložit i tak|Přepsat všechny/ });
    if (await dal.count()) { await dal.first().click().catch(() => {}); continue; }
  }
  zapis("průvodce dokončil uložení i import", hotovo);
} catch (e) {
  zapis("průchod průvodcem", false, e.message.slice(0, 140));
} finally {
  await b.close();
}

// --- kontrola v databázi: uložily se syrové řádky? ---
const { data: tpl } = await c.from("upload_templates")
  .select("id, store_rows").eq("name", NAZEV).eq("company_id", admin.companyId).maybeSingle();
zapis("šablona vznikla", !!tpl, tpl ? `store_rows=${tpl.store_rows}` : "nenalezena");

if (tpl) {
  templateId = tpl.id;
  const { data: rows } = await sb.from("source_rows").select("period_end, data").eq("template_id", tpl.id);
  const pocet = rows?.length ?? 0;
  zapis("průvodce uložil syrové řádky", pocet === 3, `nalezeno ${pocet} (čekáno 3)`);
  if (pocet) {
    const materialy = [...new Set(rows.map((r) => r.data.material))].sort().join(",");
    zapis("řádky nesou dimenze ze souboru", materialy === "Hlinik,Ocel", materialy);
  }
}

// --- úklid ---
if (templateId) {
  await sb.from("source_rows").delete().eq("template_id", templateId);
  await c.from("template_kpi_rules").delete().eq("template_id", templateId);
  await c.from("upload_templates").delete().eq("id", templateId);
  console.log("uklizeno (šablona i řádky smazány)");
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
