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
const { error: kve } = await c.from("kpi_values").insert({
  company_id: admin.companyId, kpi_definition_id: kpi.id, value: OCEL + HLINIK,
  period_end: OBDOBI, period_type: "month", version: 1,
  source_upload_id: up.id, entry_source: "upload",
});
if (kve) { console.error("kpi_values:", kve.message); process.exit(1); }
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
  await selects.first().selectOption({ label: /2031/ }).catch(() => {});
  await p.waitForTimeout(500);
  const dim = selects.filter({ hasText: "material" }).first();
  if (await dim.count()) await dim.selectOption("material");
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
