// Přihlásí se testovacím účtem na PRODUKCI a založí firmu.
// Tím se spustí ohlášení nové registrace přes Resend — což je to,
// co se celým tímhle testem ověřuje.
//
// Spustit: node scripts/prod-zaloz-firmu.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const ZAKLAD = "https://padonyl.com";
const { email, heslo } = JSON.parse(readFileSync(".prod-test-ucet.json", "utf8"));

const prohlizec = await chromium.launch();
const stranka = await prohlizec.newPage();

// Chyby ze stránky vypisovat, ať se nic neztratí potichu — u ohlášení
// registrace na tom dnes stála oprava (dřív tam bylo prázdné .catch()).
stranka.on("console", (m) => {
  if (m.type() === "error") console.log("  [prohlížeč]", m.text());
});

console.log("Přihlašuji", email);
await stranka.goto(`${ZAKLAD}/login`);
await stranka.getByPlaceholder("Email").fill(email);
await stranka.getByPlaceholder("Heslo").fill(heslo);
await stranka.locator('button[type="submit"]').click();

await stranka.waitForURL(/\/dashboard/, { timeout: 30_000 });
console.log("Přihlášeno, jsem na dashboardu.");

const nazev = page_nazev();
function page_nazev() {
  return `ZKUŠEBNÍ firma ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
}

const poleNazev = stranka.getByLabel(/název firmy/i);
await poleNazev.waitFor({ timeout: 30_000 });
await poleNazev.fill(nazev);

// Vyplnit číselníky, ať formulář projde validací
const selecty = stranka.locator("select");
for (let i = 0; i < (await selecty.count()); i += 1) {
  if ((await selecty.nth(i).locator("option").count()) > 1) {
    await selecty.nth(i).selectOption({ index: 1 });
  }
}

console.log("Zakládám firmu:", nazev);
await stranka.getByRole("button", { name: /založit|vytvořit/i }).click();

// Po založení se volá /api/access/request, které pošle notifikaci.
await stranka.waitForTimeout(6000);

const text = await stranka.locator("body").innerText();
if (/čeká na schválení/i.test(text)) {
  console.log("\nFirma založená a čeká na schválení — gate funguje.");
} else if (new RegExp(nazev.slice(0, 15), "i").test(text)) {
  console.log("\nFirma založená. Stav:", /schváleno/i.test(text) ? "schváleno" : "viz dashboard");
} else {
  console.log("\nNeočekávaný stav stránky, výňatek:");
  console.log(text.slice(0, 500));
}

console.log("\nTeď zkontroluj schránku — měla přijít notifikace");
console.log("s předmětem „Nová registrace: " + nazev + "\".");

await prohlizec.close();
