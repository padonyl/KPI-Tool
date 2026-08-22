import { defineConfig, devices } from "@playwright/test";

// ------------------------------------------------------------
// Automatické testy UI (2026-08-22).
//
// PROČ vznikly: na padonyl.com byla měsíc sekce, která byla v tmavém
// režimu na mobilu neviditelná (bílý text na skoro bílém pozadí kvůli
// tokenu, co se v tmavém režimu překlápí). Nikdo si toho nevšiml,
// protože se vývoj dělá ve světlém režimu na širokém monitoru.
//
// ZÁMĚRNĚ MALÁ SADA. Pravidlo: malá sada, která je vždycky zelená, je
// cenná - velká rozbitá je přítěž. Nepřidávat testy na každou drobnost,
// přidávat je na to, co se reálně rozbilo.
//
// Dva projekty místo jednoho: stejné testy běží ve světlém i tmavém
// režimu. Bez toho by kontrolu kontrastu neměl kdo spustit v režimu,
// kde ta chyba vůbec byla.
// ------------------------------------------------------------

const PORT = 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  timeout: 45_000,

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "světlý režim",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "tmavý režim",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
    {
      // Šířka telefonu - právě tam byla chyba vidět nejhůř.
      name: "mobil, tmavý režim",
      use: { ...devices["Pixel 7"], colorScheme: "dark" },
    },
  ],

  // Testuje se proti PRODUKČNÍMU buildu, ne proti dev serveru.
  //
  // Proč: dev server kompiluje routu až při prvním požadavku a na tomhle
  // disku to trvá i přes 30 s. První běh (22.8.) proto hlásil devatenáct
  // chyb, z nichž většina byly jen timeouty na kompilaci - test, který
  // padá náhodně, je horší než žádný. Produkční build se staví jednou,
  // pak jsou všechny stránky okamžité a testuje se přesně to, co se
  // reálně nasadí.
  //
  // E2E_BASE_URL=... pustí testy proti běžící adrese (třeba produkci)
  // a nic nestartuje.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 300_000,
      },
});
