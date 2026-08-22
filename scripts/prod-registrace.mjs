// Zaregistruje testovací účet na PRODUKCI přes skutečný web.
//
// PROČ PŘES PROHLÍŽEČ: produkční klíče Supabase nejsou lokálně k
// dispozici a ani tu nemají co dělat. Registrace přes padonyl.com
// projde stejnou cestou jako u reálného zájemce, včetně proměnných
// nastavených ve Vercelu — což je přesně to, co se ověřuje.
//
// Spustit: node scripts/prod-registrace.mjs
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const ZAKLAD = "https://padonyl.com";

// Adresu lze předat argumentem:
//   node scripts/prod-registrace.mjs vanekp@atlas.cz
//
// POZOR na plus-adresování: `neco+test@domena` nemusí u českých schránek
// fungovat a zpráva se pak nedoručí nikam. Vyzkoušeno 22. 8. u atlas.cz
// a potvrzovací e-mail nedorazil - proto se používá plná adresa.
const email = process.argv[2] ?? `test${Date.now().toString().slice(-6)}@example.com`;
const heslo = `Test-${randomUUID().slice(0, 12)}`;

const prohlizec = await chromium.launch();
const stranka = await prohlizec.newPage();

console.log("Otevírám", `${ZAKLAD}/login`);
await stranka.goto(`${ZAKLAD}/login`);

// Přepnout na registraci
await stranka.getByRole("button", { name: /registrace|vytvořit účet|registrovat/i })
  .first()
  .click()
  .catch(async () => {
    // Kdyby se přepínač jmenoval jinak, zkusit odkaz
    await stranka.getByText(/registrace|nemáš účet/i).first().click();
  });

await stranka.getByPlaceholder("Email").fill(email);
await stranka.getByPlaceholder("Heslo").fill(heslo);
await stranka.locator('button[type="submit"]').click();

// Počkat na některou z možných odpovědí
await stranka.waitForTimeout(4000);
const text = await stranka.locator("body").innerText();

writeFileSync(
  ".prod-test-ucet.json",
  JSON.stringify({ email, heslo, vytvoreno: new Date().toISOString() }, null, 2),
);

console.log("\nE-mail:", email);
console.log("Heslo uloženo v .prod-test-ucet.json (v .gitignore)\n");

if (/potvrz|ověř|e-mail/i.test(text)) {
  console.log("Registrace prošla — čeká se na potvrzení e-mailu.");
  console.log("V schránce vanekp@atlas.cz najdi zprávu s potvrzovacím odkazem a klikni na něj.");
} else if (/již existuje|already/i.test(text)) {
  console.log("Účet už existuje — spusť skript znovu, vygeneruje jinou adresu.");
} else {
  console.log("Neočekávaná odpověď stránky. Výňatek:");
  console.log(text.slice(0, 400));
}

await prohlizec.close();
