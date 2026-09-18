// Ověření, že rozpad umí spočítat POMĚROVÉ KPI po skupinách.
//
// Marže se nedá sečíst ani zprůměrovat — musí se pro každou skupinu sečíst
// čitatel a jmenovatel zvlášť a teprve pak podělit. Tenhle test pouští
// PŘÍMO produkční funkci hodnotaKpiProRadky nad reálným datasetem a
// porovnává ji s nezávislým ručním výpočtem.
//
// Spustit: node --experimental-strip-types scripts/over-rozpad-vzorec.mjs

import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { hodnotaKpiProRadky } from "../src/lib/rozpad.ts";
import { parseNumber } from "../src/lib/parse-values.ts";

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const text = readFileSync("sample-data/sap-mb51-materialove-pohyby.csv", "utf8").replace(/^﻿/, "");
const { data } = Papa.parse(text, { header: false });
const matice = data.filter((r) => r.length > 1);
const hlavicka = matice[0];
const radky = matice.slice(1).map((r) => Object.fromEntries(hlavicka.map((h, i) => [h, r[i] ?? ""])));

// Jen prodejní pohyby — tržby/COGS/režie jsou vyplněné jen u nich.
const prodeje = radky.filter((r) => r["Druh pohybu"] === "601");
zapis("dataset obsahuje prodeje", prodeje.length > 100, prodeje.length + " řádků");

// Čistá marže = (Tržba − COGS − Režie) / Tržba × 100
// Slot `zisk` je výraz přes tři sloupce — přesně to, co umí slotový model.
const vzorec = {
  spec: {
    expression: "{zisk} / {trzby} * 100",
    slots: [
      { key: "zisk", label: "Čistý zisk" },
      { key: "trzby", label: "Tržby" },
    ],
  },
  config: {
    slots: {
      zisk: {
        aggregation: "sum",
        terms: [
          { column: "Tržba bez DPH", op: "+" },
          { column: "COGS", op: "-" },
          { column: "Režie", op: "-" },
        ],
      },
      trzby: {
        aggregation: "sum",
        terms: [{ column: "Tržba bez DPH", op: "+" }],
      },
    },
  },
};
const perioda = { periodEnd: "2026-05-31", periodType: "month" };

// --- celková marže přes všechny prodeje ---
const zVzorce = hodnotaKpiProRadky(prodeje, vzorec, perioda);
const soucet = (k, sada) => sada.reduce((s, r) => s + (parseNumber(r[k] ?? "") ?? 0), 0);
const rucne =
  ((soucet("Tržba bez DPH", prodeje) - soucet("COGS", prodeje) - soucet("Režie", prodeje)) /
    soucet("Tržba bez DPH", prodeje)) *
  100;

zapis("vzorec vrátil číslo", zVzorce !== null);
zapis(
  "celková čistá marže sedí s ručním výpočtem",
  zVzorce !== null && Math.abs(zVzorce - rucne) < 0.01,
  "vzorec " + (zVzorce ?? NaN).toFixed(2) + " % vs ručně " + rucne.toFixed(2) + " %",
);

// --- rozpad po produktu: přesně to, co uživatel chce vidět ---
const skupiny = new Map();
for (const r of prodeje) {
  const k = r["Text materiálu"];
  if (!skupiny.has(k)) skupiny.set(k, []);
  skupiny.get(k).push(r);
}
zapis("rozpad má víc než 30 produktů", skupiny.size > 30, skupiny.size + " produktů");

let nesedi = 0;
let nespocitano = 0;
let porovnano = 0;
const tabulka = [];
for (const [produkt, sada] of skupiny) {
  const v = hodnotaKpiProRadky(sada, vzorec, perioda);
  if (v === null) { nespocitano++; continue; }
  const ocekavano =
    ((soucet("Tržba bez DPH", sada) - soucet("COGS", sada) - soucet("Režie", sada)) /
      soucet("Tržba bez DPH", sada)) *
    100;
  porovnano++;
  if (Math.abs(v - ocekavano) > 0.01) nesedi++;
  tabulka.push({ produkt, marze: v, radku: sada.length });
}
zapis("každá skupina se spočítala", nespocitano === 0, nespocitano + " nespočítaných");
// Podmínka na `porovnano` je schválně: bez ní by tvrzení prošlo i tehdy,
// když se nespočítalo VŮBEC NIC (0 rozdílů z 0 porovnání). Vzor P7.
zapis(
  "marže u VŠECH produktů sedí s ručním výpočtem",
  nesedi === 0 && porovnano > 30,
  porovnano + " porovnáno, " + nesedi + " rozdílů",
);

// --- kontrola, že to NENÍ průměr marží po řádcích (klasická past) ---
const prvni = tabulka[0] && skupiny.get(tabulka[0].produkt);
if (prvni && prvni.length > 1) {
  const prumerPoRadcich =
    prvni.reduce((s, r) => {
      const t = parseNumber(r["Tržba bez DPH"] ?? "") ?? 0;
      const c = parseNumber(r["COGS"] ?? "") ?? 0;
      const re = parseNumber(r["Režie"] ?? "") ?? 0;
      return s + ((t - c - re) / t) * 100;
    }, 0) / prvni.length;
  const spravne = tabulka[0].marze;
  console.log(
    "\n  (kontrola metody: vážená marže " + spravne.toFixed(2) +
    " % vs naivní průměr po řádcích " + prumerPoRadcich.toFixed(2) + " %)",
  );
}

tabulka.sort((a, b) => a.marze - b.marze);
console.log("\n=== NEJHORŠÍ MARŽE PODLE PRODUKTU (tohle má ukázat appka) ===");
for (const t of tabulka.slice(0, 5)) {
  console.log("  " + t.produkt.padEnd(34) + t.marze.toFixed(1).padStart(7) + " %   (" + t.radku + " řádků)");
}
console.log("=== NEJLEPŠÍ ===");
for (const t of tabulka.slice(-3).reverse()) {
  console.log("  " + t.produkt.padEnd(34) + t.marze.toFixed(1).padStart(7) + " %   (" + t.radku + " řádků)");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
