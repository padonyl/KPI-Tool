// Ověření po nasazení: běží na produkci nová verze detailu KPI (ta, co se
// nově dotazuje na source_rows)? ČTE JEN — nic nezapisuje, nic nemaže.
// Spustit: node scripts/over-prod-rozpad.mjs [base]
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "https://padonyl.com").replace(/\/$/, "");
const ucet = JSON.parse(readFileSync(".prod-test-ucet.json", "utf8"));

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const chybyKonzole = [];
p.on("pageerror", (e) => chybyKonzole.push(e.message));

try {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const hp = p.locator('input[placeholder="Heslo"]');
  const pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
  // Počkat na hydrataci reakcí na klik, ne časem (viz lessons log).
  let hydratovano = false;
  for (let i = 0; i < 40; i++) {
    await pr.click().catch(() => {});
    if ((await hp.getAttribute("type")) === "text") { await pr.click(); hydratovano = true; break; }
    await p.waitForTimeout(500);
  }
  zapis("přihlašovací formulář se hydratoval", hydratovano);

  await p.locator('input[type="email"]').fill(ucet.email);
  await hp.fill(ucet.heslo);
  await p.locator('button[type="submit"]').click();
  // Nečekat naslepo na přesměrování — když přihlášení selže, chceme vidět
  // hlášku, ne jen timeout (a nezkoušet to dokola kvůli rate limitu).
  let prihlasen = false;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1000);
    if (!new URL(p.url()).pathname.startsWith("/login")) { prihlasen = true; break; }
  }
  if (!prihlasen) {
    const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    zapis("přihlášení na produkci", false, txt.slice(0, 250));
    throw new Error("prihlaseni-selhalo");
  }
  zapis("přihlášení na produkci", true);

  await p.goto(`${BASE}/kpis`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  const odkazy = p.locator('a[href^="/kpis/"]');
  const pocet = await odkazy.count();
  zapis("přehled KPI se načetl", pocet > 0, `${pocet} odkazů na KPI`);

  if (pocet > 0) {
    await odkazy.first().click();
    await p.waitForURL(/\/kpis\/[^/]+$/, { timeout: 60000 });
    await p.waitForTimeout(2000);
    const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    const rozbite = /Application error|Internal Server Error|Nastala chyba|Something went wrong/i.test(txt);
    zapis("detail KPI se vykreslil bez chyby", !rozbite, rozbite ? txt.slice(0, 200) : "");
    // Panel se ukáže jen tam, kde jsou uložené řádky — na produ zatím nikde,
    // takže jeho NEPŘÍTOMNOST je v pořádku. Klíčové je, že stránka nespadla:
    // nový dotaz na source_rows tedy prošel včetně grantů z migrace 0016.
    const maPanel = (await p.getByText("Rozpad do detailu").count()) > 0;
    console.log(`  panel Rozpad zobrazen: ${maPanel ? "ano" : "ne (očekávané - zatím žádná šablona s opt-inem)"}`);
  }

  zapis("žádná chyba v konzoli stránky", chybyKonzole.length === 0, chybyKonzole.slice(0, 2).join(" | "));
} finally {
  await b.close();
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
