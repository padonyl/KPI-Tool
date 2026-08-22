import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// ============================================================
// Hlídá hranici admin prostředí: METADATA ANO, DATA ZÁKAZNÍKŮ NE.
//
// Rozhodnuto 2026-08-22. Provozovatel vidí, které firmy existují, kdo v
// nich má účet a jestli s nástrojem pracují — ale ani jednu jejich
// hodnotu KPI.
//
// Bez tohohle testu je ta hranice jen věta v komentáři, kterou někdo za
// půl roku v dobré víře poruší, protože „to bude jen jeden graf".
// Test čte zdrojové soubory, nepotřebuje prohlížeč ani databázi.
//
// Kdyby se přístup k datům někdy stavěl (na pozvání od firmy, časově
// omezený), poroste tenhle test s ním: povolí se výslovně a jen tam,
// kde se ověřuje platné pozvání.
// ============================================================

/** Tabulky, které nesou data zákazníka. V adminu nemají co dělat. */
const ZAKAZANE = ["kpi_values", "deliveries", "kpi_budgets"];

/** Soubory admin části. */
const OBLASTI = [
  "src/lib/admin.ts",
  "src/lib/admin-data.ts",
  "src/app/admin",
  "src/app/api/admin",
];

function souboryV(cesta: string): string[] {
  const plna = path.resolve(cesta);
  const info = statSync(plna, { throwIfNoEntry: false });
  if (!info) return [];
  if (info.isFile()) return [plna];

  return readdirSync(plna).flatMap((polozka) =>
    souboryV(path.join(cesta, polozka)),
  );
}

test.describe("Hranice admin prostředí", () => {
  const soubory = OBLASTI.flatMap(souboryV).filter((f) => /\.tsx?$/.test(f));

  test("admin část vůbec existuje", () => {
    // Kdyby se soubory přejmenovaly, test níže by prošel na prázdné
    // množině a tvářil by se, že hlídá — přitom by nehlídal nic.
    expect(soubory.length).toBeGreaterThan(3);
  });

  for (const zakazana of ZAKAZANE) {
    test(`nikde se nesahá na ${zakazana}`, () => {
      const nalezy = soubory
        .filter((f) => {
          const obsah = readFileSync(f, "utf8");
          // Komentáře nevadí — právě v nich je ta hranice vysvětlená.
          const bezKomentaru = obsah
            .replace(/\/\/.*$/gm, "")
            .replace(/\/\*[\s\S]*?\*\//g, "");
          return bezKomentaru.includes(zakazana);
        })
        .map((f) => path.relative(process.cwd(), f));

      expect(
        nalezy,
        `Admin část sahá na ${zakazana}, což je tabulka s daty zákazníků.\n` +
          `Soubory: ${nalezy.join(", ")}\n` +
          `Hranice je metadata ano, data ne. Přístup k číslům firmy má být\n` +
          `jen na její pozvání, časově omezený — ne trvale v adminu.`,
      ).toEqual([]);
    });
  }

  test("z uploads se čte jen čas, ne obsah", () => {
    const obsah = readFileSync(path.resolve("src/lib/admin-data.ts"), "utf8");

    // Dotazy na uploads smí vybírat jen metadata. storage_path by vedl
    // k souboru zákazníka, file_name prozrazuje, co nahrává.
    for (const sloupec of ["storage_path", "file_name", "error_message"]) {
      expect(
        obsah.includes(sloupec),
        `admin-data.ts čte z uploads sloupec ${sloupec}, který patří k obsahu, ne k metadatům.`,
      ).toBe(false);
    }
  });
});
