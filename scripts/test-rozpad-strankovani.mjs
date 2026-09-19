// Ověření opravy: rozpad musí počítat z VŠECH řádků období, ne jen z prvního
// tisíce, který vrátí PostgREST. Naseeduje 1500 řádků a přečte, co UI ukáže.
// Jen dev. Spustit: node scripts/test-rozpad-strankovani.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

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
const superU = P.normal.find((n) => n.role === "customer_superuser" && n.companyId === admin.companyId);
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

const POCET = 1500, OBDOBI = "2031-01-31";
// castka = 1..1500; material stridave. Hlinik = liche castky, Ocel = sude.
const OCEL = 750 * 751;      // 563 250
const HLINIK = 750 * 750;    // 562 500

const c = createClient(URL, ANON);
const { error: le } = await c.auth.signInWithPassword({ email: superU.email, password: superU.heslo });
if (le) { console.error("login:", le.message); process.exit(1); }

const { data: me } = await c.from("users").select("id").eq("email", superU.email).single();
const { data: tpl } = await c.from("upload_templates").select("id").eq("name", "E2E-Rozpad-Vyroba").eq("company_id", admin.companyId).maybeSingle();
if (!tpl) { console.error("chybi sablona E2E-Rozpad-Vyroba, spust nejdriv test-rozpad-e2e.mjs"); process.exit(1); }
const { data: kpi } = await c.from("kpi_definitions").select("id, name").eq("name", "Cash flow").single();

// --- seed: upload + 1500 radku + hodnota KPI, ktera na upload ukazuje ---
const { data: up, error: ue } = await c.from("uploads").insert({
  company_id: admin.companyId, uploaded_by: me.id,
  file_name: "_strankovani.csv", storage_path: `${admin.companyId}/_strankovani`, status: "processed",
}).select("id").single();
if (ue) { console.error("uploads:", ue.message); process.exit(1); }

const radky = Array.from({ length: POCET }, (_, i) => ({
  company_id: admin.companyId, upload_id: up.id, template_id: tpl.id,
  period_end: OBDOBI, period_type: "month",
  data: { datum: "2031-01-15", castka: String(i + 1), material: i % 2 ? "Ocel" : "Hlinik" },
}));
for (let i = 0; i < radky.length; i += 500) {
  const { error } = await c.from("source_rows").insert(radky.slice(i, i + 500));
  if (error) { console.error("source_rows:", error.message); process.exit(1); }
}
// Verze se NESMÍ zadrátovat na 1. Úklid na konci testu hodnotu jen označí za
// nahrazenou, ale nemaže ji (mazat kpi_values přihlášený uživatel nesmí), takže
// verze 1 zůstane po prvním běhu navždy obsazená a druhý běh spadne na unikátní
// klíč (company, kpi, period, version). Zjištěno 2026-09-19.
const { data: stavajici } = await c.from("kpi_values")
  .select("version").eq("company_id", admin.companyId)
  .eq("kpi_definition_id", kpi.id).eq("period_end", OBDOBI)
  .order("version", { ascending: false }).limit(1);
const dalsiVerze = (stavajici?.[0]?.version ?? 0) + 1;

const { error: kve } = await c.from("kpi_values").insert({
  company_id: admin.companyId, kpi_definition_id: kpi.id, value: OCEL + HLINIK,
  period_end: OBDOBI, period_type: "month", version: dalsiVerze,
  source_upload_id: up.id, entry_source: "upload",
});
if (kve) {
  // Řádky už v databázi leží — bez tohohle úklidu by tam zůstalo 1500 kusů
  // a příští běh by počítal s dvojnásobkem. Přesně to se 2026-09-19 stalo.
  await sb.from("source_rows").delete().eq("upload_id", up.id);
  console.error("kpi_values:", kve.message, "(naseedované řádky uklizeny)");
  process.exit(1);
}
zapis("naseedováno 1500 řádků", true, `${kpi.name}, období ${OBDOBI}`);

// --- cteni pres UI ---
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
try {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const hp = p.locator('input[placeholder="Heslo"]'), pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 60; i++) {
    await pr.click().catch(() => {});
    if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
    await p.waitForTimeout(500);
  }
  await p.locator('input[type="email"]').fill(superU.email);
  await hp.fill(superU.heslo);
  await p.locator('button[type="submit"]').click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

  await p.goto(`${BASE}/kpis/${kpi.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByText("Rozpad do detailu").waitFor({ timeout: 30000 });

  // vybrat nase obdobi a dimenzi material
  const selects = p.locator("select");

  // Vybírat se MUSÍ podle `value`, ne přes { label: /2031/ }. Playwright bere
  // u `label` jen přesný řetězec — regulární výraz nesedne na nic, selectOption
  // vyhodí výjimku a dřívější `.catch(() => {})` ji spolkl. Test pak proklikal
  // prázdný panel a zbylá tvrzení (negativní) prošla naprázdno.
  // Zjištěno 2026-09-19; takhle byl test rozbitý od 2026-09-12.
  const obdobi = selects.first();
  const volba = await obdobi.locator("option", { hasText: "2031" }).first().getAttribute("value");
  if (!volba) throw new Error("v seznamu období není žádná volba pro rok 2031");
  await obdobi.selectOption(volba);

  await p.waitForTimeout(500);
  const dim = selects.filter({ hasText: "material" }).first();
  await dim.waitFor({ timeout: 15000 });
  await dim.selectOption("material");

  // Agregaci i číselný sloupec je potřeba vybrat VÝSLOVNĚ. Test dřív spoléhal
  // na výchozí hodnotu, jenže šablona E2E-Rozpad-Vyroba má u Cash flow staré
  // pravidlo bez mapování slotů, takže vzorec KPI se nenabízí a výchozí volba
  // je „součet sloupce" — a ta bez vybraného sloupce nic nespočítá.
  // Cílit podle POPISKU, ne pořadím ani obsahem. Sloupec „castka" je ve třech
  // selectech naráz (rozpad podle / číselný sloupec / filtr), takže
  // `.filter({ hasText: "castka" })` trefí špatný — dřív to nastavilo filtr.
  const podlePopisku = (popisek) =>
    p.locator("label").filter({ hasText: popisek }).locator("select").first();

  const agregace = podlePopisku("Co počítat");
  await agregace.waitFor({ timeout: 15000 });
  await agregace.selectOption("sum");
  await p.waitForTimeout(300);

  const cisel = podlePopisku("Číselný sloupec");
  await cisel.waitFor({ timeout: 15000 });
  await cisel.selectOption("castka");
  // stránkování = víc dotazů, dát tomu čas
  await p.waitForTimeout(4000);

  const txt = (await p.locator("body").innerText()).replace(/ | /g, " ").replace(/\s+/g, " ");
  const cislo = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "[ .]?")).test(txt);

  zapis("Ocel má úplný součet 563 250", cislo(OCEL));
  zapis("Hliník má úplný součet 562 500", cislo(HLINIK));
  // pojistka: presne ta cisla, ktera by vysla pri oriznuti na 1000 radku
  const oriznuteOcel = 500 * 501, oriznuteHlinik = 500 * 500; // 250500 / 250000
  zapis("nezobrazuje oříznutá čísla z 1000 řádků", !cislo(oriznuteOcel) && !cislo(oriznuteHlinik));
  zapis("neukazuje varování o neúplnosti (1500 < strop)", !/Rozpad níž je\s*spočítaný z prvních/i.test(txt));
} catch (e) {
  zapis("čtení přes UI", false, e.message.slice(0, 120));
} finally {
  await b.close();
}

// --- uklid ---
await sb.from("source_rows").delete().eq("upload_id", up.id);
await c.from("kpi_values").update({ superseded_at: new Date().toISOString() }).eq("source_upload_id", up.id);
console.log("uklizeno (řádky smazány, hodnota KPI označena za nahrazenou)");

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
