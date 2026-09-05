// Ověří admin prostředí za běhu: kdo se dovnitř dostane a co tam vidí.
//
// PROČ SKRIPT A NE TEST V SADĚ: potřebuje přihlašovací údaje ze souborů,
// které nejsou v gitu (.admin-ucet.json, .e2e-ucet.json). Test závislý na
// tajemstvích by v cizím prostředí padal, a padající sada je horší než
// žádná. Statickou hranici „admin nesahá na kpi_values" hlídá
// e2e/admin-hranice.spec.ts, tenhle skript doplňuje běhovou stránku.
//
// Spustit proti lokálu:  node scripts/over-admina.mjs
// Proti produkci:        node scripts/over-admina.mjs https://padonyl.com
//
// Údaje k adminovi se berou podle cíle: pro lokál z .admin-ucet.json,
// pro produkci z .admin-ucet-prod.json. Skript navíc kontroluje, že
// projekt v souboru odpovídá cílové adrese — dev heslo proti ostré
// adrese by nic neověřilo a tvářilo by se to jako úspěch.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const adresa = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const jeProdukce = !/localhost|127\.0\.0\.1/.test(adresa);

function nactiUcet(soubor) {
  try {
    return JSON.parse(readFileSync(soubor, "utf8"));
  } catch {
    return null;
  }
}

const vysledky = [];
function zapis(nazev, proslo, detail = "") {
  vysledky.push({ nazev, proslo, detail });
  const znak = proslo === null ? "—" : proslo ? "OK" : "CHYBA";
  console.log(`${znak.padEnd(6)} ${nazev}${detail ? `  (${detail})` : ""}`);
}

// Každé prostředí má svůj soubor s údaji, ať se dev účet nepřepisuje
// produkčním a zpátky. Oba jsou v .gitignore.
const souborAdmina = jeProdukce ? ".admin-ucet-prod.json" : ".admin-ucet.json";
const souborBezneho = jeProdukce ? ".prod-test-ucet.json" : ".e2e-ucet.json";
const admin = nactiUcet(souborAdmina);
const bezny = nactiUcet(souborBezneho);

if (jeProdukce && admin && !admin.projekt?.startsWith("lymb")) {
  console.error(
    `Cíl je produkce (${adresa}), ale ${souborAdmina} patří projektu ${admin.projekt ?? "(neuvedeno)"}.\n` +
      `Dev heslo proti ostré adrese by nic neověřilo a tvářilo by se to jako úspěch.`,
  );
  process.exit(1);
}

const prohlizec = await chromium.launch();

/**
 * Počká, až se přihlašovací formulář opravdu oživí (hydratace).
 *
 * PROČ TO NEJDE POZNAT Z OBSAHU POLÍ: dokud React stránku nepřevezme, je
 * na ní jen serverem vykreslené HTML. `fill()` do něj hodnotu zapíše a ta
 * tam i zůstane — jenže stav komponenty je pořád prázdný, takže se odešle
 * prázdný e-mail a Supabase vrátí „missing email or phone". Vypadá to jako
 * špatné heslo. Čtení hodnoty zpátky z DOM tuhle situaci NEODHALÍ, protože
 * hodnota tam poctivě je; první dvě verze téhle kontroly na to doplatily.
 *
 * Jediné, co hydrataci prokáže, je reakce na obsluhu události. Tlačítko
 * „Zobrazit" přepíná typ pole s heslem — dokud React neběží, klik neudělá
 * nic. Až se typ přepne na `text`, je formulář živý.
 *
 * Odhaleno 2026-09-05: ověření admina padalo na „přihlášení selhalo"
 * s heslem, které přes API fungovalo.
 */
async function pockejNaHydrataci(stranka) {
  const heslo = stranka.locator('input[placeholder="Heslo"]');
  const prepinac = stranka.getByRole("button", { name: /Zobrazit|Skrýt/ });

  for (let pokus = 0; pokus < 20; pokus++) {
    await prepinac.click().catch(() => {});
    if ((await heslo.getAttribute("type")) === "text") {
      await prepinac.click(); // vrátit zpět na skryté, ať to nic nevypisuje
      return true;
    }
    await stranka.waitForTimeout(300);
  }
  return false;
}

/** Přihlásí se přes formulář a vrátí kontext s cookies. */
async function prihlas(ucet) {
  const kontext = await prohlizec.newContext();
  const stranka = await kontext.newPage();
  await stranka.goto(`${adresa}/login`, { waitUntil: "domcontentloaded" });

  if (!(await pockejNaHydrataci(stranka))) {
    await kontext.close();
    return null;
  }

  await stranka.locator('input[type="email"]').fill(ucet.email);
  // Heslo se hledá podle placeholderu — type se přepíná tlačítkem
  // „Zobrazit", takže input[type=password] by nebyl spolehlivý.
  await stranka.locator('input[placeholder="Heslo"]').fill(ucet.heslo);

  // Záměrně button[type=submit], ne role+název: „Přihlásit se" je i odkaz
  // v hlavičce, takže by výběr podle názvu byl nejednoznačný.
  await stranka.locator('button[type="submit"]').click();

  await stranka
    .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 })
    .catch(() => {});

  const uspech = !new URL(stranka.url()).pathname.startsWith("/login");
  await stranka.close();
  return uspech ? kontext : (await kontext.close(), null);
}

/** Vrátí stavový kód a text stránky /admin pro daný kontext. */
async function otevriAdmin(kontext) {
  const stranka = await kontext.newPage();
  const odpoved = await stranka.goto(`${adresa}/admin`, {
    waitUntil: "domcontentloaded",
  });
  const stav = odpoved?.status() ?? 0;
  const text = await stranka.locator("body").innerText();
  await stranka.close();
  return { stav, text };
}

try {
  // ---- 1. Nepřihlášený návštěvník ----
  const anonKontext = await prohlizec.newContext();
  const anon = await otevriAdmin(anonKontext);
  zapis(
    "Nepřihlášený dostane 404",
    anon.stav === 404,
    `vrátilo ${anon.stav}`,
  );
  await anonKontext.close();

  // ---- 2. Běžný uživatel ----
  if (!bezny) {
    zapis("Běžný uživatel dostane 404", null, `chybí ${souborBezneho}`);
  } else {
    const kontext = await prihlas(bezny);
    if (!kontext) {
      // Nepřihlášení NENÍ důkaz chyby v adminu — účet mohl být smazaný
      // nebo mít jiné heslo. Hlásit to jako selhání by dělalo červenou
      // tam, kde se nic neověřilo. Proto přeskočeno, ale s důvodem.
      zapis(
        "Běžný uživatel dostane 404",
        null,
        `nešlo se přihlásit účtem z ${souborBezneho} — neověřeno`,
      );
    } else {
      const r = await otevriAdmin(kontext);
      zapis("Běžný uživatel dostane 404", r.stav === 404, `vrátilo ${r.stav}`);
      await kontext.close();
    }
  }

  // ---- 3. Admin ----
  if (!admin) {
    zapis("Admin se dostane dovnitř", null, `chybí ${souborAdmina}`);
  } else {
    const kontext = await prihlas(admin);
    if (!kontext) {
      zapis("Admin se dostane dovnitř", false, "přihlášení selhalo");
    } else {
      const r = await otevriAdmin(kontext);
      zapis(
        "Admin se dostane dovnitř",
        r.stav === 200 && /Firmy/.test(r.text),
        `stav ${r.stav}`,
      );
      zapis(
        "Admin vidí, kým je přihlášen",
        r.text.includes(admin.email),
        admin.email,
      );

      // Hranice metadat: na přehledu firem nesmí být slovo, které by
      // znamenalo číslo z byznysu zákazníka. Kontroluje se text, ne
      // zdroják — ten hlídá admin-hranice.spec.ts.
      const podezrele = ["Kč", "hodnota KPI", "Skutečnost", "Plán"].filter((s) =>
        r.text.includes(s),
      );
      zapis(
        "Na přehledu nejsou čísla zákazníka",
        podezrele.length === 0,
        podezrele.length ? `našlo se: ${podezrele.join(", ")}` : "",
      );
      await kontext.close();
    }
  }
} finally {
  await prohlizec.close();
}

const chyby = vysledky.filter((v) => v.proslo === false);
const preskocene = vysledky.filter((v) => v.proslo === null);

console.log(
  `\n${vysledky.length - chyby.length - preskocene.length} prošlo, ` +
    `${chyby.length} selhalo, ${preskocene.length} přeskočeno — ${adresa}`,
);
process.exit(chyby.length ? 1 : 0);
