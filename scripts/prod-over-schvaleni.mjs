// Ověří, že schválení odkazem z notifikace opravdu firmu odemklo.
//
// Kontroluje se to z pohledu uživatele: přihlásit se, podívat se na
// příznak u firmy a zkusit část aplikace, kterou gate předtím blokoval.
// Tvrzení "schváleno" z databáze by nestačilo — testuje se výsledek,
// ne záznam.
//
// Spustit: node scripts/prod-over-schvaleni.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const ZAKLAD = "https://padonyl.com";
const { email, heslo } = JSON.parse(readFileSync(".prod-test-ucet.json", "utf8"));

let chyb = 0;
function check(popis, ok, detail = "") {
  if (!ok) chyb += 1;
  console.log(`  ${ok ? "OK   " : "CHYBA"} ${popis}${detail ? ` — ${detail}` : ""}`);
}

const prohlizec = await chromium.launch();
const stranka = await prohlizec.newPage();

await stranka.goto(`${ZAKLAD}/login`);
await stranka.getByPlaceholder("Email").fill(email);
await stranka.getByPlaceholder("Heslo").fill(heslo);
await stranka.locator('button[type="submit"]').click();
await stranka.waitForURL(/\/dashboard/, { timeout: 30_000 });

const dashboard = await stranka.locator("body").innerText();
check("Příznak u firmy hlásí Schváleno", /schváleno/i.test(dashboard));
check("Nezůstal příznak Čeká na schválení", !/čeká na schválení/i.test(dashboard));

// Gate blokoval /templates — po schválení se tam musí dát dostat.
await stranka.goto(`${ZAKLAD}/templates`);
await stranka.waitForTimeout(2500);
check(
  "Šablony jsou přístupné (gate pustil)",
  /templates/.test(stranka.url()) && !/dashboard/.test(stranka.url()),
  stranka.url().replace(ZAKLAD, ""),
);

// A přehled KPI taky.
await stranka.goto(`${ZAKLAD}/kpis`);
await stranka.waitForTimeout(2500);
check(
  "Přehled KPI je přístupný",
  /kpis/.test(stranka.url()),
  stranka.url().replace(ZAKLAD, ""),
);

console.log(chyb === 0 ? "\nSCHVÁLENÍ FUNGUJE" : `\nSELHALO: ${chyb}`);
await prohlizec.close();
process.exit(chyb === 0 ? 0 : 1);
