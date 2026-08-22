import { test, expect } from "@playwright/test";
import { VEREJNE_STRANKY, PRESMEROVANI, CHRANENE_STRANKY } from "./stranky";

// ============================================================
// Základní pojistka: veřejné stránky se načtou, staré adresy pořád
// přesměrovávají a chráněné části appky nikoho nepustí bez přihlášení.
//
// Tohle je ta část, kterou by ruční proklikání dělalo po každé změně -
// a která se rozbije nejtišeji (přejmenování routy, zapomenutý redirect).
// ============================================================

test.describe("Veřejné stránky", () => {
  for (const stranka of VEREJNE_STRANKY) {
    test(`${stranka.cesta} se načte a má svůj nadpis`, async ({ page }) => {
      const odpoved = await page.goto(stranka.cesta);
      expect(odpoved?.status(), `${stranka.cesta} nevrátila 200`).toBe(200);
      await expect(
        page.getByRole("heading", { name: stranka.nadpis }).first(),
      ).toBeVisible();
    });
  }
});

test.describe("Přesměrování starých adres", () => {
  for (const { z, na } of PRESMEROVANI) {
    test(`${z} vede na ${na}`, async ({ page }) => {
      await page.goto(z);
      await expect(page).toHaveURL(new RegExp(`${na}$`));
    });
  }
});

test.describe("Ochrana přihlášené části", () => {
  for (const cesta of CHRANENE_STRANKY) {
    test(`${cesta} bez přihlášení pošle na login`, async ({ page }) => {
      await page.goto(cesta);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test("Navigace z firemní homepage vede na produkt", async ({ page }) => {
  await page.goto("/");
  // Firemní stránka a produkt jsou oddělené - tenhle přechod je to,
  // co drží rozdělení značky a nástroje pohromadě (viz znacka_a_marketingovy_web.md).
  await page.getByRole("link", { name: /KPI Tool/i }).first().click();
  await expect(page).toHaveURL(/\/kpi-tool/);
});
