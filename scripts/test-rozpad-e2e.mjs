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
const { data: kpi } = await cAdmin.from("kpi_definitions")
  .select("id, name, category").neq("category", "Lidé a růst").limit(1).single();

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
const { error: ruleErr } = await cAdmin.from("template_kpi_rules").insert({
  template_id: tpl.id, kpi_definition_id: kpi.id,
  rule_type: "direct", config: { source_column: "castka" },
});
if (ruleErr) throw new Error(`insert rule: ${ruleErr.message}`);
zapis("šablona s opt-inem naseedovaná", true, `KPI ${kpi.name}`);

// vyčistit případné staré source_rows z minula
await sb.from("source_rows").delete().eq("template_id", tpl.id);

// --- 2. CSV ---
const csv = "datum,castka,material\n2026-05-10,100,Ocel\n2026-05-20,200,Hlinik\n2026-05-25,50,Ocel\n";
const csvPath = path.join(os.tmpdir(), `rozpad-${Date.now()}.csv`);
writeFileSync(csvPath, csv, "utf8");

// --- 3. nahrání přes UI jako superuser ---
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
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
  if (/Nastala chyba|nepodařilo/i.test(txt)) { console.log("  UI chyba:", txt.slice(0, 160)); break; }
}
zapis("nahrání přes UI dokončeno", hotovo);
await b.close();

// --- 4. kontrola source_rows ---
const { data: rows, error: rowsErr } = await sb.from("source_rows")
  .select("period_end, data").eq("template_id", tpl.id);
if (rowsErr) { zapis("čtení source_rows", false, rowsErr.message); }
else {
  zapis("uložily se 3 řádky", (rows?.length ?? 0) === 3, `nalezeno ${rows?.length ?? 0}`);
  const maMaterial = (rows ?? []).every((r) => r.data && "material" in r.data && "castka" in r.data);
  zapis("řádky nesou dimenze (material, castka)", maMaterial);
  const spravneObdobi = (rows ?? []).every((r) => r.period_end === "2026-05-31");
  zapis("řádky mají správné období (2026-05-31)", spravneObdobi, (rows ?? []).map((r) => r.period_end).join(","));
  // rozpad podle materiálu (to, co bude dělat proklik ve fázi 4)
  const podleMaterialu = {};
  for (const r of rows ?? []) {
    const m = r.data.material;
    podleMaterialu[m] = (podleMaterialu[m] ?? 0) + Number(r.data.castka);
  }
  console.log("  rozpad podle materiálu:", JSON.stringify(podleMaterialu));
  zapis("rozpad dá Ocel=150, Hlinik=200", podleMaterialu.Ocel === 150 && podleMaterialu.Hlinik === 200);
}

// úklid řádků (šablonu necháme pro příště)
await sb.from("source_rows").delete().eq("template_id", tpl.id);

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
