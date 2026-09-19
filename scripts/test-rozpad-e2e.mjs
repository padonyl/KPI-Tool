// E2E ověření zápisové cesty rozpadu: šablona s opt-inem → nahrání přes
// UI → řádky v source_rows. Jen dev. Spustit: node scripts/test-rozpad-e2e.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3101").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");        // NORM-Vyroba admin
const superU = P.normal.find((n) => n.role === "customer_superuser" && n.companyId === admin.companyId);
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

async function jako(ucet) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email: ucet.email, password: ucet.heslo });
  if (error) throw new Error(`login ${ucet.email}: ${error.message}`);
  return c;
}

// --- 1. seed šablony s opt-inem (jako admin, přes RLS) ---
const cAdmin = await jako(admin);
const { data: adminRow } = await cAdmin.from("users").select("id").eq("email", admin.email).single();
// KPI musí být ne-HR (u HR se řádky neukládají) A ne-procentuální — do KPI
// cpeme částky (100/200/50 Kč), a validace by u procentního KPI hodnotu 200
// správně shodila ("procentuální hodnota musí být 0–100").
const PROCENTA = new Set(["%", "percent", "procenta", "procent"]);
const { data: kpiKandidati } = await cAdmin.from("kpi_definitions")
  .select("id, name, unit, category").neq("category", "Lidé a růst").order("name");
const kpi = (kpiKandidati ?? []).find((k) => !PROCENTA.has((k.unit ?? "").trim().toLowerCase()));
if (!kpi) throw new Error("nenašlo se žádné ne-procentuální, ne-HR KPI");

const NAZEV = "E2E-Rozpad-Vyroba";
let { data: tpl } = await cAdmin.from("upload_templates").select("id").eq("name", NAZEV).eq("company_id", admin.companyId).maybeSingle();
if (tpl) {
  // reset: smazat řádky (service_role) a pravidla (admin), přenastavit
  await sb.from("source_rows").delete().eq("template_id", tpl.id);
  await cAdmin.from("template_kpi_rules").delete().eq("template_id", tpl.id);
  await cAdmin.from("upload_templates").update({ store_rows: true, rows_retention_days: 90 }).eq("id", tpl.id);
} else {
  const id = randomUUID();
  const { error } = await cAdmin.from("upload_templates").insert({
    id, company_id: admin.companyId, name: NAZEV,
    date_column_name: "datum", period_type: "month",
    source_columns: ["datum", "castka", "material"],
    store_rows: true, rows_retention_days: 90, created_by: adminRow.id,
  });
  if (error) throw new Error(`insert template: ${error.message}`);
  tpl = { id };
}
// Agregované pravidlo: sečti "castka" za období → jeden kandidát za měsíc
// (350). Prázdný filtr = zahrň všechny řádky. (Direct by z 3 řádků ve stejném
// měsíci udělal 3 kandidáty za totéž období a kolidoval sám se sebou.) Na
// rozpad to nemá vliv — source_rows se ukládají ze všech syrových řádků.
const { error: ruleErr } = await cAdmin.from("template_kpi_rules").insert({
  template_id: tpl.id, kpi_definition_id: kpi.id,
  rule_type: "aggregated",
  config: { filter_column: "", filter_value: "", value_column: "castka", aggregation: "sum" },
});
if (ruleErr) throw new Error(`insert rule: ${ruleErr.message}`);
zapis("šablona s opt-inem naseedovaná", true, `KPI ${kpi.name}`);

// vyčistit případné staré source_rows z minula
await sb.from("source_rows").delete().eq("template_id", tpl.id);

// --- 2. CSV ---
// Každý běh jiný měsíc. Kdyby se opakoval, writeKpiValues by při shodné
// hodnotě nic nepřepsalo a kpi_values by dál ukazovalo na starý upload bez
// řádků (panel rozpadu by se nezobrazil); při odlišné hodnotě by zas naskočil
// krok "Potvrď přepsání". Unikátní období drží test na čisté cestě.
const idx = Math.floor(Date.now() / 1000) % 96; // 96 měsíců = 8 let
const rok = 2020 + Math.floor(idx / 12);
const mesic = (idx % 12) + 1;
const mm = String(mesic).padStart(2, "0");
const OBDOBI = new Date(Date.UTC(rok, mesic, 0)).toISOString().slice(0, 10);
const csv =
  "datum,castka,material\n" +
  `${rok}-${mm}-10,100,Ocel\n` +
  `${rok}-${mm}-20,200,Hlinik\n` +
  `${rok}-${mm}-25,50,Ocel\n`;
const csvPath = path.join(os.tmpdir(), `rozpad-${Date.now()}.csv`);
writeFileSync(csvPath, csv, "utf8");

// --- 3. nahrání přes UI jako superuser ---
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
// Zachytit konzoli prohlížeče — insert source_rows je non-fatal a chyba jde
// jen sem (console.error), node ji jinak nevidí.
p.on("console", (m) => {
  const t = m.text();
  if (/source_rows|insert|error|denied|policy|row-level/i.test(t)) console.log("  [browser]", m.type(), t);
});
p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
// Odposlech REST volání na source_rows — definitivně řekne, jestli se insert
// vůbec pokusil a co server odpověděl.
p.on("response", async (res) => {
  const u = res.url();
  if (/\/rest\/v1\/source_rows/.test(u)) {
    let body = "";
    if (res.status() >= 400) { try { body = " " + (await res.text()).slice(0, 300); } catch {} }
    console.log(`  [net] ${res.request().method()} source_rows → ${res.status()}${body}`);
  }
});
await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
const hp = p.locator('input[placeholder="Heslo"]'), pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
// Počkat na hydrataci — na pomalém dev serveru trvá i přes 10 s. Ověřuje
// se reakcí na klik (přepnutí typu pole), ne časem.
let hydratovano = false;
for (let i = 0; i < 60; i++) {
  await pr.click().catch(() => {});
  if ((await hp.getAttribute("type")) === "text") { await pr.click(); hydratovano = true; break; }
  await p.waitForTimeout(500);
}
if (!hydratovano) { console.log("  formulář se nehydratoval včas"); }
await p.locator('input[type="email"]').fill(superU.email);
await hp.fill(superU.heslo);
await p.locator('button[type="submit"]').click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });

await p.goto(`${BASE}/upload/template/${tpl.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(1500);
await p.locator('input[type="file"]').setInputFiles(csvPath);

// projít případné kroky (vynechané řádky / konflikty) k dokončení
let hotovo = false;
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1500);
  const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (/Hotovo|Uloženo \d+ hodnot|Zobrazit přehled KPI/.test(txt)) { hotovo = true; break; }
  const pokracovat = p.getByRole("button", { name: /Pokračovat|Uložit i tak|Přepsat všechny/ });
  if (await pokracovat.count()) { await pokracovat.first().click().catch(() => {}); continue; }
  if (/Nastala chyba|nepodařilo/i.test(txt)) {
    const po = txt.indexOf("Nastala chyba");
    console.log("  UI chyba:", po >= 0 ? txt.slice(po, po + 300) : txt.slice(0, 300));
    break;
  }
}
zapis("nahrání přes UI dokončeno", hotovo);

// --- 4. kontrola source_rows ---
const { data: rows, error: rowsErr } = await sb.from("source_rows")
  .select("period_end, data").eq("template_id", tpl.id);
if (rowsErr) { zapis("čtení source_rows", false, rowsErr.message); }
else {
  const pocet = rows?.length ?? 0;
  zapis("uložily se 3 řádky", pocet === 3, `nalezeno ${pocet}`);
  // Pozor na `.every()` nad prázdným polem — to projde vždy. Proto i podmínka
  // na počet, ať se z prázdného výsledku nestane zelený test.
  const maMaterial = pocet > 0 && rows.every((r) => r.data && "material" in r.data && "castka" in r.data);
  zapis("řádky nesou dimenze (material, castka)", maMaterial);
  const spravneObdobi = pocet > 0 && rows.every((r) => r.period_end === OBDOBI);
  zapis(`řádky mají správné období (${OBDOBI})`, spravneObdobi, (rows ?? []).map((r) => r.period_end).join(","));
  // rozpad podle materiálu (to, co bude dělat proklik ve fázi 4)
  const podleMaterialu = {};
  for (const r of rows ?? []) {
    const m = r.data.material;
    podleMaterialu[m] = (podleMaterialu[m] ?? 0) + Number(r.data.castka);
  }
  console.log("  rozpad podle materiálu:", JSON.stringify(podleMaterialu));
  zapis("rozpad dá Ocel=150, Hlinik=200", podleMaterialu.Ocel === 150 && podleMaterialu.Hlinik === 200);
}

// --- 5. čtení přes UI: proklik do rozpadu na detailu KPI (fáze 4) ---
try {
  await p.goto(`${BASE}/kpis/${kpi.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  const panel = p.getByText("Rozpad do detailu");
  const jePanel = (await panel.count()) > 0;
  zapis("panel Rozpad se na detailu KPI zobrazí", jePanel);
  if (jePanel) {
    // Nově se NIC nepředvybírá (požadavek uživatele 2026-09-18): napřed
    // období, teprve pak se načtou řádky a nabídnou se sloupce.
    const obdobi = p.locator("select").first();
    const volby = await obdobi.locator("option").allInnerTexts();
    zapis("období jde vybrat ze seznamu", volby.length > 1, volby.join(" | "));

    const prvni = await obdobi.locator("option").nth(1).getAttribute("value");
    await obdobi.selectOption(prvni);
    await p.waitForTimeout(2500);

    const dimSelect = p.locator("select").filter({ hasText: "material" }).first();
    await dimSelect.waitFor({ timeout: 15000 });
    await dimSelect.selectOption("material");
    await p.waitForTimeout(1200);

    // Agregaci i číselný sloupec vybrat VÝSLOVNĚ. Šablona má u Cash flow staré
    // pravidlo bez mapování slotů, takže se volba „vzorec KPI" nenabízí.
    // Cílit podle popisku — „castka" je ve třech selectech naráz.
    const podlePopisku = (popisek) =>
      p.locator("label").filter({ hasText: popisek }).locator("select").first();

    const agregace = podlePopisku("Co počítat");
    await agregace.waitFor({ timeout: 15000 });
    await agregace.selectOption("sum");
    await p.waitForTimeout(300);

    const cisel = podlePopisku("Číselný sloupec");
    await cisel.waitFor({ timeout: 15000 });
    await cisel.selectOption("castka");
    await p.waitForTimeout(1200);

    const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    zapis("rozpad v UI ukazuje Ocel i Hlinik", /Ocel/.test(txt) && /Hlinik/.test(txt));
    // Dřív se kontrolovaly jen NÁZVY skupin — to prošlo i tehdy, když u všech
    // hodnot stálo „nelze spočítat". Tvrzení o hodnotách tam chybělo.
    zapis("a ukazuje spočítané hodnoty, ne hlášku o nemožnosti",
      /150/.test(txt) && /200/.test(txt) && !/nelze spočítat/.test(txt));
  }
} catch (e) {
  zapis("čtení přes UI", false, e.message.slice(0, 80));
}

await b.close();

// úklid řádků (šablonu necháme pro příště)
await sb.from("source_rows").delete().eq("template_id", tpl.id);

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
