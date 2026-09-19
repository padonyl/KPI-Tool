// Vizualizace rozpadu: sloupce, Pareto a histogram.
//
// Důraz je na to, co se NENABÍDNE. Pareto stojí na tom, že se díly sčítají
// do celku — u průměru je „kumulativní podíl" nesmysl a graf by vypadal
// důvěryhodně, přestože lže. Test proto kontroluje i zakázané stavy.
//
// Jen dev, po sobě uklidí. Spustit: node scripts/test-rozpad-grafy.mjs [base]

import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");
const superU = P.normal.find((n) => n.role === "customer_superuser");
const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const c = createClient(URL_, ANON, { auth: { persistSession: false } });
{
  const { error } = await c.auth.signInWithPassword({ email: superU.email, password: superU.heslo });
  if (error) { console.error("login: " + error.message); process.exit(1); }
}
const { data: me } = await c.from("users").select("id").eq("email", superU.email).single();
const { data: tpl } = await c.from("upload_templates")
  .select("id").eq("name", "E2E-Rozpad-Vyroba").eq("company_id", admin.companyId).maybeSingle();
if (!tpl) { console.error("chybí šablona E2E-Rozpad-Vyroba, spusť nejdřív test-rozpad-e2e.mjs"); process.exit(1); }
const { data: kpi } = await c.from("kpi_definitions").select("id, name").eq("name", "Cash flow").single();

const OBDOBI = "2033-07-31";
// Šest materiálů s výrazně nerovnoměrnými podíly — přesně na to je Pareto.
const MATERIALY = [["Ocel", 5000], ["Hliník", 2500], ["Měď", 1200], ["Plast", 700], ["Guma", 400], ["Sklo", 200]];
const CELKEM = MATERIALY.reduce((s, [, v]) => s + v, 0);

let up = null;
try {
  {
    const { data, error } = await c.from("uploads").insert({
      company_id: admin.companyId, uploaded_by: me.id,
      file_name: "_grafy.csv", storage_path: admin.companyId + "/_grafy", status: "processed",
    }).select("id").single();
    if (error) throw new Error("upload: " + error.message);
    up = data.id;
  }

  // Na každý materiál 20 řádků, aby byl histogram z čeho postavit.
  const radky = [];
  for (const [material, soucet] of MATERIALY) {
    for (let i = 0; i < 20; i++) {
      radky.push({
        company_id: admin.companyId, upload_id: up, template_id: tpl.id,
        period_end: OBDOBI, period_type: "month",
        data: { datum: "2033-07-15", castka: String(soucet / 20), material },
      });
    }
  }
  for (let i = 0; i < radky.length; i += 500) {
    const { error } = await c.from("source_rows").insert(radky.slice(i, i + 500));
    if (error) throw new Error("source_rows: " + error.message);
  }

  {
    const { data: stav } = await c.from("kpi_values")
      .select("version").eq("company_id", admin.companyId)
      .eq("kpi_definition_id", kpi.id).eq("period_end", OBDOBI)
      .order("version", { ascending: false }).limit(1);
    const { error } = await c.from("kpi_values").insert({
      company_id: admin.companyId, kpi_definition_id: kpi.id, value: CELKEM,
      period_end: OBDOBI, period_type: "month", version: (stav?.[0]?.version ?? 0) + 1,
      source_upload_id: up, entry_source: "upload",
    });
    if (error) throw new Error("kpi_values: " + error.message);
  }
  zapis("naseedováno 120 řádků v 6 materiálech", true, "celkem " + CELKEM);

  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  try {
    await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    const hp = p.locator('input[placeholder="Heslo"]'), pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
    for (let i = 0; i < 60; i++) { await pr.click().catch(() => {}); if (await hp.count()) break; await p.waitForTimeout(500); }
    await p.locator('input[type="email"]').fill(superU.email);
    await hp.fill(superU.heslo);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

    await p.goto(BASE + "/kpis/" + kpi.id, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.getByText("Rozpad do detailu").waitFor({ timeout: 30000 });

    const podlePopisku = (popisek) =>
      p.locator("label").filter({ hasText: popisek }).locator("select").first();

    const obdobi = p.locator("select").first();
    const volba = await obdobi.locator("option", { hasText: "2033" }).first().getAttribute("value");
    if (!volba) throw new Error("období 2033 není v seznamu");
    await obdobi.selectOption(volba);
    await p.waitForTimeout(2000);

    await podlePopisku("Rozpad podle").selectOption("material");
    await podlePopisku("Co počítat").selectOption("sum");
    await p.waitForTimeout(300);
    await podlePopisku("Číselný sloupec").selectOption("castka");
    await p.waitForTimeout(1500);

    const zalozka = (jmeno) => p.getByRole("button", { name: jmeno, exact: true });

    // Na stránce je i tabulka s historií hodnot KPI, takže se musí cílit
    // jen na tu z rozpadu. Pozná se podle sloupce "řádků", který jinde není.
    const tabulkaRozpadu = p.locator("table").filter({ hasText: "řádků" });
    const radkuTabulky = async () => tabulkaRozpadu.locator("tbody tr").count();

    zapis("výchozí pohled je tabulka a má 6 řádků",
      (await radkuTabulky()) === 6, (await radkuTabulky()) + " řádků");

    // --- sloupce ---
    await zalozka("Sloupce").click();
    await p.waitForTimeout(1200);
    const sloupcu = await p.locator("svg .recharts-bar-rectangle").count();
    zapis("Sloupce vykreslí 6 sloupců", sloupcu === 6, "nalezeno " + sloupcu);
    zapis("v pohledu Sloupce už tabulka rozpadu není", (await radkuTabulky()) === 0);

    // --- Pareto ---
    await zalozka("Pareto").click();
    await p.waitForTimeout(1200);
    const txtPareto = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    zapis("Pareto vykreslí sloupce i kumulativní křivku",
      (await p.locator("svg .recharts-bar-rectangle").count()) === 6 &&
      (await p.locator("svg .recharts-line").count()) >= 1);
    // Ocel+Hliník = 7500 z 10000 = 75 %, s Mědí 87 % → 80 % padne na 3. kategorii.
    zapis("Pareto uvádí, kolik kategorií tvoří 80 %",
      /3 kategorií tvoří 80 %/.test(txtPareto),
      (txtPareto.match(/\d+ kategorií tvoří 80 %/) ?? ["nenalezeno"])[0]);

    // --- histogram ---
    await zalozka("Rozdělení").click();
    await p.waitForTimeout(1200);
    const kosu = await p.locator("svg .recharts-bar-rectangle").count();
    zapis("Rozdělení vykreslí histogram", kosu > 0, kosu + " košů");
    zapis("histogram uvádí, z kolika řádků počítá",
      /Rozdělení 120 řádků/.test((await p.locator("body").innerText()).replace(/\s+/g, " ")));

    // --- co se NESMÍ nabídnout ---
    await podlePopisku("Co počítat").selectOption("avg");
    await p.waitForTimeout(1200);
    zapis("u průměru je Pareto zakázané (kumulativní podíl by lhal)",
      await zalozka("Pareto").isDisabled());
    zapis("u průměru zůstávají Sloupce dostupné", !(await zalozka("Sloupce").isDisabled()));
  } catch (e) {
    zapis("průchod přes UI", false, e.message.slice(0, 140));
  } finally {
    await b.close();
  }
} catch (e) {
  zapis("příprava dat", false, e.message.slice(0, 160));
} finally {
  if (up) {
    await sb.from("source_rows").delete().eq("upload_id", up);
    await c.from("kpi_values").update({ superseded_at: new Date().toISOString() }).eq("source_upload_id", up);
    await c.from("uploads").delete().eq("id", up);
  }
  console.log("\nuklizeno");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
