// Vygeneruje vzorové soubory s různým tvarem hlavičky.
// Spustit: node scripts/vzorky-hlavicka.mjs
// Soubory vzniknou v sample-data/hlavicky/.
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const KAM = "sample-data/hlavicky";
await mkdir(KAM, { recursive: true });

// ------------------------------------------------------------
// 1. CSV, hlavička hned na prvním řádku (běžný případ)
// ------------------------------------------------------------
await writeFile(
  join(KAM, "1-bezny.csv"),
  [
    "Datum;Objednávka;Zákazník;Částka",
    "01.05.2026;OBJ-2601;12345678;5000",
    "01.05.2026;OBJ-2601;12345678;3000",
    "11.05.2026;OBJ-2602;87654321;12000",
    "20.05.2026;OBJ-2603;12345678;9000",
  ].join("\n"),
  "utf8",
);

// ------------------------------------------------------------
// 2. CSV s nadpisem a prázdným řádkem nad tabulkou
// ------------------------------------------------------------
await writeFile(
  join(KAM, "2-nadpis-nad-tabulkou.csv"),
  [
    "Report objednávek za květen 2026;;;",
    "Vygenerováno 01.06.2026;;;",
    ";;;",
    "Datum;Objednávka;Zákazník;Částka",
    "01.05.2026;OBJ-2601;12345678;5000",
    "11.05.2026;OBJ-2602;87654321;12000",
    "20.05.2026;OBJ-2603;12345678;9000",
  ].join("\n"),
  "utf8",
);

// ------------------------------------------------------------
// 3. XLSX se sloučenou buňkou - případ od uživatele
//    řádek 1 prázdný, řádek 2 sloučené "Tržby" nad sloupci C-F,
//    řádek 3 skutečné názvy
// ------------------------------------------------------------
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tržby");

  ws.addRow([]); // 1 - prázdný
  ws.addRow(["", "", "Tržby", "", "", ""]); // 2 - sloučená hlavička
  ws.mergeCells("C2:F2");
  ws.addRow(["Datum", "Středisko", "Zboží", "Služby", "Materiál", "Ostatní"]); // 3
  ws.addRow([new Date("2026-05-01"), "Praha", 1000, 200, 50, 10]);
  ws.addRow([new Date("2026-05-11"), "Brno", 2000, 300, 70, 20]);
  ws.addRow([new Date("2026-05-20"), "Praha", 1500, 250, 60, 15]);

  await wb.xlsx.writeFile(join(KAM, "3-sloucena-hlavicka.xlsx"));
}

// ------------------------------------------------------------
// 4. XLSX s duplicitními a prázdnými názvy sloupců
// ------------------------------------------------------------
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sklad");

  ws.addRow(["Datum", "Materiál", "Kč", "", "Kč", "Ks"]);
  ws.addRow([new Date("2026-05-31"), "Ocel", 100000, "pozn", 5000, 20]);
  ws.addRow([new Date("2026-05-31"), "Hliník", 60000, "", 3000, 12]);

  await wb.xlsx.writeFile(join(KAM, "4-duplicitni-nazvy.xlsx"));
}

// ------------------------------------------------------------
// 5. XLSX s vzorci a odsazením zleva (data začínají až ve sloupci B)
// ------------------------------------------------------------
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Marže");

  ws.addRow([]);
  ws.addRow(["", "Datum", "Tržby", "Náklady", "Zisk"]);
  ws.addRow(["", new Date("2026-05-31"), 100000, 70000, { formula: "C3-D3", result: 30000 }]);
  ws.addRow(["", new Date("2026-06-30"), 120000, 80000, { formula: "C4-D4", result: 40000 }]);

  await wb.xlsx.writeFile(join(KAM, "5-odsazeni-a-vzorce.xlsx"));
}

console.log("Vzorky vytvořeny v", KAM);
