import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// ============================================================
// Průchod skutečnou aplikací: založení firmy, nová šablona, nahrání
// vzorového souboru se sloučenou hlavičkou a kontrola, že aplikace
// našla správný řádek s názvy sloupců.
//
// Účet vzniká skriptem scripts/test-ucet.mjs (jednorázový, dev).
// Bez něj se testy přeskočí, ať sada nepadá u toho, kdo ho nemá.
// ============================================================

const UCET = ".e2e-ucet.json";
const maUcet = existsSync(UCET);

const ucet = maUcet
  ? (JSON.parse(readFileSync(UCET, "utf8")) as { email: string; heslo: string })
  : { email: "", heslo: "" };

test.skip(!maUcet, "Chybí .e2e-ucet.json — spusť node scripts/test-ucet.mjs");

// POZOR: tenhle test neprojde, dokud na dev neproběhne migrace 0009.
// Dashboard se ptá na companies.status a bez migrace vrací
// "column companies_1.status does not exist" - tedy se ani nezobrazí
// formulář pro založení firmy. Není to vada testu ani hlavičkového
// rozpoznávání, je to ta ordering podmínka: migrace dřív než kód.

// Průchod je jeden dlouhý scénář: každý krok staví na předchozím.
test.describe.configure({ mode: "serial" });

test("založení firmy, šablona a rozpoznání sloučené hlavičky", async ({ page }) => {
  // --- přihlášení ---
  await page.goto("/login");
  // Pole nemají <label>, jen placeholder - viz nález o přístupnosti.
  await page.getByPlaceholder("Email").fill(ucet.email);
  await page.getByPlaceholder("Heslo").fill(ucet.heslo);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  // --- založení firmy ---
  // Účet je čerstvý, takže formulář tam VŽDY je. Dřív se tu jen zjišťovala
  // viditelnost hned po přesměrování - to je ale závod s vykreslením a
  // formulář se stihl přeskočit, takže test dojel bez firmy a spadl až o
  // dva kroky dál na nesouvisejícím místě.
  const nazevFirmy = page.getByLabel(/název firmy/i);
  await expect(nazevFirmy).toBeVisible({ timeout: 30_000 });
  {
    await nazevFirmy.fill("E2E Testovací s.r.o.");
    const selecty = page.locator("select");
    const pocet = await selecty.count();
    for (let i = 0; i < pocet; i += 1) {
      const moznosti = selecty.nth(i).locator("option");
      if ((await moznosti.count()) > 1) {
        await selecty.nth(i).selectOption({ index: 1 });
      }
    }
    await page.getByRole("button", { name: /založit|vytvořit/i }).click();
    await expect(page.getByText(/E2E Testovací/i).first()).toBeVisible({ timeout: 30_000 });
  }

  // --- nová šablona + soubor se sloučenou hlavičkou ---
  await page.goto("/templates/new");

  const soubor = path.resolve("sample-data/hlavicky/3-sloucena-hlavicka.xlsx");
  const vstupSouboru = page.locator('input[type="file"]');
  await expect(vstupSouboru).toBeAttached({ timeout: 30_000 });
  await vstupSouboru.setInputFiles(soubor);

  // Tohle je jádro testu: aplikace musí přeskočit prázdný řádek i sloučenou
  // buňku a vzít názvy až ze třetího řádku.
  await expect(
    page.getByText(/Názvy sloupců beru z 3\. řádku/i),
  ).toBeVisible({ timeout: 30_000 });

  // A musí nabízet skutečné názvy sloupců, ne "Tržby" ze sloučené buňky.
  await page.getByRole("button", { name: /je to jinak/i }).click();
  const nahled = page.locator("table");
  await expect(nahled).toContainText("Služby");
  await expect(nahled).toContainText("Materiál");
});
