// Prožene vzorové soubory SKUTEČNOU funkcí parseFile() z aplikace,
// včetně ExcelJS a PapaParse. Testuje tedy reálnou cestu, ne napodobeninu.
//
// Spustit: npx tsx scripts/test-hlavicka-soubory.mts
// (nebo přeložit přes tsc a spustit node)
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFile, seZmenenouHlavickou } from "../src/lib/parse-file.js";

const KAM = "sample-data/hlavicky";
let chyb = 0;

function check(popis: string, skutecnost: unknown, ocekavano: unknown) {
  const ok = JSON.stringify(skutecnost) === JSON.stringify(ocekavano);
  if (!ok) chyb += 1;
  console.log(`${ok ? "  OK  " : "  CHYBA"} ${popis}`);
  if (!ok) {
    console.log(`         dostal: ${JSON.stringify(skutecnost)}`);
    console.log(`         čekáno: ${JSON.stringify(ocekavano)}`);
  }
}

async function nacti(jmeno: string) {
  const buffer = await readFile(join(KAM, jmeno));
  return new File([buffer], jmeno);
}

// --- 1. Běžné CSV ---
{
  console.log("\n1-bezny.csv");
  const p = await parseFile(await nacti("1-bezny.csv"));
  check("hlavička na 1. řádku", p.indexHlavicky, 0);
  check("názvy sloupců", p.headers, ["Datum", "Objednávka", "Zákazník", "Částka"]);
  check("počet datových řádků", p.rows.length, 4);
  check("hodnota", p.rows[0]["Částka"], "5000");
}

// --- 2. CSV s nadpisem nad tabulkou ---
{
  console.log("\n2-nadpis-nad-tabulkou.csv");
  const p = await parseFile(await nacti("2-nadpis-nad-tabulkou.csv"));
  check("hlavička na 4. řádku (index 3)", p.indexHlavicky, 3);
  check("názvy sloupců", p.headers, ["Datum", "Objednávka", "Zákazník", "Částka"]);
  check("nadpis se nestal hlavičkou", p.headers.includes("Report objednávek za květen 2026"), false);
  check("počet datových řádků", p.rows.length, 3);
}

// --- 3. XLSX se sloučenou buňkou (případ uživatele) ---
{
  console.log("\n3-sloucena-hlavicka.xlsx");
  const p = await parseFile(await nacti("3-sloucena-hlavicka.xlsx"));
  check("hlavička na 3. řádku (index 2)", p.indexHlavicky, 2);
  check("názvy sloupců", p.headers, [
    "Datum", "Středisko", "Zboží", "Služby", "Materiál", "Ostatní",
  ]);
  check("počet datových řádků", p.rows.length, 3);
  // Tohle je ten dřívější tichý bug: data se četla z posunutých sloupců.
  check("Služby ze správného sloupce", p.rows[0]["Služby"], "200");
  check("Materiál ze správného sloupce", p.rows[0]["Materiál"], "50");
  check("Středisko", p.rows[1]["Středisko"], "Brno");

  // Ruční přepnutí na špatný řádek musí dát sloučenou buňku
  const spatne = seZmenenouHlavickou(p, 1);
  check("ruční přepnutí na řádek 2", spatne.headers[2], "Tržby");
}

// --- 4. Duplicitní a prázdné názvy ---
{
  console.log("\n4-duplicitni-nazvy.xlsx");
  const p = await parseFile(await nacti("4-duplicitni-nazvy.xlsx"));
  check("hlavička na 1. řádku", p.indexHlavicky, 0);
  check("duplicity a prázdné pojmenované", p.headers, [
    "Datum", "Materiál", "Kč", "Sloupec 4", "Kč (2)", "Ks",
  ]);
  check("první Kč", p.rows[0]["Kč"], "100000");
  check("druhé Kč se nepřepsalo", p.rows[0]["Kč (2)"], "5000");
}

// --- 5. Odsazení zleva a vzorce ---
{
  console.log("\n5-odsazeni-a-vzorce.xlsx");
  const p = await parseFile(await nacti("5-odsazeni-a-vzorce.xlsx"));
  check("hlavička na 2. řádku (index 1)", p.indexHlavicky, 1);
  check("prázdný první sloupec pojmenovaný", p.headers[0], "Sloupec 1");
  check("ostatní názvy", p.headers.slice(1), ["Datum", "Tržby", "Náklady", "Zisk"]);
  check("vzorec dal spočítanou hodnotu", p.rows[0]["Zisk"], "30000");
  check("počet datových řádků", p.rows.length, 2);
}

console.log(chyb === 0 ? "\nVŠE PROŠLO" : `\nSELHALO: ${chyb}`);
process.exit(chyb === 0 ? 0 : 1);
