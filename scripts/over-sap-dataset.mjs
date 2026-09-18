// Ověření, že vygenerovaný dataset appka opravdu přečte.
//
// Klíčové: nepoužívá vlastní kopie parserů, ale PŘÍMO ty z appky
// (src/lib/parse-values.ts, papaparse se stejnou konfigurací jako
// parse-file.ts). Kdyby se pravidla v appce změnila, tenhle test spadne —
// což je přesně to, co má dělat.
//
// Spustit: node --experimental-strip-types scripts/over-sap-dataset.mjs

import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { parseNumber, parseDateValue } from "../src/lib/parse-values.ts";

const CESTA = "sample-data/sap-mb51-materialove-pohyby.csv";
const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

// Stejná konfigurace jako parse-file.ts: header: false, oddělovač se detekuje.
const text = readFileSync(CESTA, "utf8").replace(/^﻿/, "");
const { data, errors } = Papa.parse(text, { header: false });
const matice = data.filter((r) => r.length > 1);

zapis("papaparse nehlásí chyby", errors.length === 0, errors.slice(0, 2).map((e) => e.message).join("; "));

const hlavicka = matice[0];
const radky = matice.slice(1);
zapis("oddělovač se detekoval správně", hlavicka.length === 26, hlavicka.length + " sloupců");
zapis("načetly se všechny řádky", radky.length > 3000, radky.length + " datových řádků");

const idx = (nazev) => hlavicka.indexOf(nazev);
const sl = {
  datum: idx("Datum zaúčtování"),
  druh: idx("Druh pohybu"),
  mnozstvi: idx("Množství"),
  hodnota: idx("Hodnota pohybu"),
  trzba: idx("Tržba bez DPH"),
  cogs: idx("COGS"),
  rezie: idx("Režie"),
  odberatel: idx("Odběratel"),
  vyrobek: idx("Text materiálu"),
};
zapis("všechny klíčové sloupce jsou v hlavičce", Object.values(sl).every((i) => i >= 0));

// --- datum: musí projít u KAŽDÉHO řádku, jinak by se KPI nespočítalo ---
let spatneDatum = 0;
let prvniSpatne = "";
const obdobi = new Set();
for (const r of radky) {
  const d = parseDateValue(r[sl.datum]);
  if (!d) {
    spatneDatum++;
    if (!prvniSpatne) prvniSpatne = r[sl.datum];
  } else {
    obdobi.add(d.slice(0, 7));
  }
}
zapis("datum přečteno u všech řádků", spatneDatum === 0, spatneDatum ? spatneDatum + " špatně, např. " + prvniSpatne : "");
zapis("data pokrývají 5 měsíců", obdobi.size === 5, [...obdobi].sort().join(", "));

// --- čísla: každá NEPRÁZDNÁ hodnota musí být čitelná ---
const zkontrolujCislo = (nazev, i) => {
  let spatne = 0;
  let ukazka = "";
  let neprazdnych = 0;
  for (const r of radky) {
    const v = (r[i] ?? "").trim();
    if (v === "") continue;
    neprazdnych++;
    if (parseNumber(v) === null) {
      spatne++;
      if (!ukazka) ukazka = v;
    }
  }
  zapis("sloupec „" + nazev + "“ je celý čitelný", spatne === 0,
    spatne ? spatne + " nečitelných, např. „" + ukazka + "“" : neprazdnych + " hodnot");
};
zkontrolujCislo("Množství", sl.mnozstvi);
zkontrolujCislo("Hodnota pohybu", sl.hodnota);
zkontrolujCislo("Tržba bez DPH", sl.trzba);
zkontrolujCislo("COGS", sl.cogs);
zkontrolujCislo("Režie", sl.rezie);

// --- záporné hodnoty musí přežít (výdeje) ---
const zaporne = radky.filter((r) => (parseNumber(r[sl.mnozstvi]) ?? 0) < 0).length;
zapis("výdeje se čtou jako záporné", zaporne > 1000, zaporne + " řádků");

// --- totály spočítané Z NAPARSOVANÝCH hodnot ---
const soucet = (i, filtr = () => true) =>
  radky.filter(filtr).reduce((s, r) => s + (parseNumber(r[i] ?? "") ?? 0), 0);
const trzby = soucet(sl.trzba);
const cogs = soucet(sl.cogs);
const rezie = soucet(sl.rezie);
const hrubaMarze = ((trzby - cogs) / trzby) * 100;
const cistyZisk = trzby - cogs - rezie;

zapis("tržby vyšly nenulové", trzby > 1_000_000);
zapis("hrubá marže je v rozumném pásmu", hrubaMarze > 15 && hrubaMarze < 60, hrubaMarze.toFixed(1) + " %");
zapis("čistý zisk je kladný", cistyZisk > 0);

// --- tržba smí být JEN u prodeje (601), jinak by se součty míchaly ---
const trzbaMimoProdej = radky.filter(
  (r) => r[sl.druh] !== "601" && (r[sl.trzba] ?? "").trim() !== "",
).length;
zapis("tržba je vyplněná jen u prodeje (601)", trzbaMimoProdej === 0, trzbaMimoProdej + " mimo 601");

const kc = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 0 });
console.log("\n=== CO MÁ VYJÍT V APPCE ===");
console.log("  Tržby bez DPH : " + kc(trzby) + " Kč");
console.log("  COGS          : " + kc(cogs) + " Kč");
console.log("  Režie         : " + kc(rezie) + " Kč");
console.log("  Hrubý zisk    : " + kc(trzby - cogs) + " Kč");
console.log("  Hrubá marže   : " + hrubaMarze.toFixed(1) + " %");
console.log("  Čistý zisk    : " + kc(cistyZisk) + " Kč");
console.log("  Čistá marže   : " + ((cistyZisk / trzby) * 100).toFixed(1) + " %");

// --- co má analytika najít ---
const podle = (i, hodnota) => {
  const m = new Map();
  for (const r of radky.filter((x) => x[sl.druh] === "601")) {
    const k = r[i] || "(prázdné)";
    m.set(k, (m.get(k) ?? 0) + (parseNumber(r[hodnota] ?? "") ?? 0));
  }
  return m;
};
const trzbaZak = podle(sl.odberatel, sl.trzba);
const cogsZak = podle(sl.odberatel, sl.cogs);
const marzeZak = [...trzbaZak.entries()]
  .map(([k, t]) => ({ k, marze: ((t - (cogsZak.get(k) ?? 0)) / t) * 100, t }))
  .sort((a, b) => a.marze - b.marze);

console.log("\n=== NÁSTRAHY, KTERÉ MÁ ANALYTIKA ODHALIT ===");
console.log("  Nejhorší marže podle odběratele:");
for (const z of marzeZak.slice(0, 3)) {
  console.log("    " + z.k.padEnd(28) + z.marze.toFixed(1) + " %   (tržby " + kc(z.t) + " Kč)");
}
const trzbaVyr = podle(sl.vyrobek, sl.trzba);
const cogsVyr = podle(sl.vyrobek, sl.cogs);
const marzeVyr = [...trzbaVyr.entries()]
  .map(([k, t]) => ({ k, marze: ((t - (cogsVyr.get(k) ?? 0)) / t) * 100 }))
  .sort((a, b) => a.marze - b.marze);
console.log("  Nejhorší marže podle výrobku:");
for (const v of marzeVyr.slice(0, 3)) {
  console.log("    " + v.k.padEnd(34) + v.marze.toFixed(1) + " %");
}
const srot = radky.filter((r) => r[sl.druh] === "551");
const srotMesic = new Map();
for (const r of srot) {
  const m = (parseDateValue(r[sl.datum]) ?? "").slice(0, 7);
  srotMesic.set(m, (srotMesic.get(m) ?? 0) + Math.abs(parseNumber(r[sl.hodnota] ?? "") ?? 0));
}
console.log("  Hodnota šrotu po měsících:");
for (const [m, v] of [...srotMesic.entries()].sort()) console.log("    " + m + "   " + kc(v) + " Kč");

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
