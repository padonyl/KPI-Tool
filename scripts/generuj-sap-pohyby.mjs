// Generátor datasetu "Seznam materiálových pohybů" (ekvivalent SAP MB51).
//
// Proč generátor a ne ručně psaný soubor: dataset má být KONZISTENTNÍ —
// nic se nevydá dřív, než se přijme, nic se neprodá dřív, než se vyrobí,
// a sklad nikdy nejde do mínusu. Jen tak jdou spočítaná čísla odsouhlasit
// a analytika nad nimi něco znamená.
//
// Formát je vědomě přizpůsobený parseru appky (viz parse-values.ts):
//   - desetinná ČÁRKA, ŽÁDNÉ oddělovače tisíců ("1234567,89").
//     Pozor: "1.234,56" by se rozpadlo — tečka se čte jako tisíce.
//   - datum DD.MM.RRRR (čtyřciferný rok, jinak by se pořadí složek hádalo)
//   - oddělovač sloupců středník (Papa.parse si ho detekuje sám)
//
// Spustit: node scripts/generuj-sap-pohyby.mjs [pocet-mesicu]

import { writeFileSync, mkdirSync } from "node:fs";

// --- deterministický generátor, ať je soubor reprodukovatelný ---
let seed = 20260918;
function nahoda() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const mezi = (a, b) => a + nahoda() * (b - a);
const celeMezi = (a, b) => Math.floor(mezi(a, b + 1));
const vyber = (pole) => pole[Math.floor(nahoda() * pole.length)];
const vyberN = (pole, n) => {
  const kopie = [...pole];
  const out = [];
  while (out.length < n && kopie.length) {
    out.push(kopie.splice(Math.floor(nahoda() * kopie.length), 1)[0]);
  }
  return out;
};

// --- kalendář: jen pracovní dny ---
const ZACATEK = new Date(Date.UTC(2026, 0, 5));
const MESICU = Number(process.argv[2] ?? 5);
const KONEC = new Date(Date.UTC(2026, MESICU, 0));
const PRACOVNI = [];
for (let d = new Date(ZACATEK); d <= KONEC; d.setUTCDate(d.getUTCDate() + 1)) {
  const den = d.getUTCDay();
  if (den !== 0 && den !== 6) PRACOVNI.push(new Date(d));
}
const denIndex = (i) => PRACOVNI[Math.max(0, Math.min(PRACOVNI.length - 1, i))];
const ddmmrrrr = (d) =>
  String(d.getUTCDate()).padStart(2, "0") +
  "." +
  String(d.getUTCMonth() + 1).padStart(2, "0") +
  "." +
  d.getUTCFullYear();

// --- číselné formáty ---
const cis = (n, des = 2) => n.toFixed(des).split(".").join(",");

// --- číselníky ---
const ZAVODY = ["1000", "2000"];
const SKLADY = { vstup: "0001", vyroba: "0002", hotove: "0003" };

const SKUPINY = [
  { kod: "ROH-OCEL", nazev: "Ocel", mj: "KG", od: 18, do: 46,
    vzory: ["Plech ocelový {a} mm", "Profil U {a}", "Trubka ocelová {a}x{b}", "Tyč kruhová {a} mm", "Jekl {a}x{a}x{b}"] },
  { kod: "ROH-HLIN", nazev: "Hliník", mj: "KG", od: 58, do: 130,
    vzory: ["Profil Al {a}x{b}", "Plech Al {a} mm", "Trubka Al {a} mm"] },
  { kod: "ROH-PLAST", nazev: "Plasty", mj: "KG", od: 34, do: 95,
    vzory: ["Granulát PA6 {a}", "Deska PP {a} mm", "Deska PE {a} mm", "Granulát ABS {a}"] },
  { kod: "ROH-ELEKTRO", nazev: "Elektro", mj: "KS", od: 14, do: 880,
    vzory: ["Motor {a} kW", "Stykač {a} A", "Kabel CYKY {a}x{b}", "Čidlo indukční {a} mm", "Frekvenční měnič {a} kW"] },
  { kod: "ROH-SPOJ", nazev: "Spojovací materiál", mj: "KS", od: 0.6, do: 16,
    vzory: ["Šroub M{a}x{b}", "Matice M{a}", "Podložka {a}", "Nýt {a}x{b}", "Kolík {a}x{b}"] },
  { kod: "ROH-NATER", nazev: "Nátěry a chemie", mj: "L", od: 95, do: 340,
    vzory: ["Základní barva {c}", "Lak polyuretanový {c}", "Ředidlo S{a}", "Odmašťovač {c}"] },
  { kod: "ROH-TESN", nazev: "Těsnění a guma", mj: "KS", od: 3, do: 68,
    vzory: ["O-kroužek {a} mm", "Těsnění ploché {a} mm", "Manžeta {a}x{b}", "Tlumič gumový {a}"] },
];
const BARVY = ["RAL 5010", "RAL 7035", "RAL 9005", "RAL 3020", "RAL 6011"];

const DODAVATELE = [
  "Ferona a.s.", "ArcelorMittal Distribution", "Alumat s.r.o.", "ThyssenKrupp Ferrostal",
  "Plastika Nitra a.s.", "Resinex CZ s.r.o.", "Siemens s.r.o.", "ABB s.r.o.",
  "Schneider Electric CZ", "Killich s.r.o.", "Fabory CZ", "Bossard CZ s.r.o.",
  "Colorlak a.s.", "PPG Deco Czech", "Rubena a.s.", "Trelleborg Bohemia",
  "Hennlich s.r.o.", "Haberkorn s.r.o.", "Bibus s.r.o.", "ESSA Czech",
  "Metalšrot Tlumačov", "Hilti ČR s.r.o.", "Wurth s.r.o.", "Lapp Kabel s.r.o.", "Elektro Cabel CZ",
];
const ODBERATELE = [
  "Škoda Auto a.s.", "Brose CZ spol. s r.o.", "Continental Automotive",
  "Hella Autotechnik Nova", "Bosch Diesel s.r.o.", "Magna Exteriors Bohemia",
  "Witte Automotive", "Tatra Trucks a.s.", "Agrostroj Pelhřimov a.s.",
  "Bonatrans Group a.s.", "Zetor Tractors a.s.", "Linet spol. s r.o.",
  "Juta a.s.", "Koyo Bearings ČR", "Hanon Systems Autopal", "Mubea CZ s.r.o.",
  "Strojírny Prostějov a.s.", "Vítkovice Machinery",
];
const UZIVATELE = ["NOVAKJ", "SVOBODM", "DVORAKP", "CERNAT", "PROCHAZ", "KUCERAL", "VESELAM", "HORAKT"];
const STREDISKA = ["4010 Nákup", "5020 Výroba montáž", "5030 Výroba obrábění", "6010 Expedice", "5040 Lakovna"];

// --- 300 vstupních materiálů ---
const materialy = [];
let cisloMat = 1000100;
for (let i = 0; i < 300; i++) {
  const sk = SKUPINY[i % SKUPINY.length];
  const nazev = vyber(sk.vzory)
    .split("{a}").join(String(celeMezi(2, 120)))
    .split("{b}").join(String(celeMezi(4, 80)))
    .split("{c}").join(vyber(BARVY));
  materialy.push({
    cislo: String(cisloMat++),
    nazev,
    skupina: sk.nazev,
    skupinaKod: sk.kod,
    mj: sk.mj,
    cena: Number(mezi(sk.od, sk.do).toFixed(2)),
    zavod: vyber(ZAVODY),
  });
}

// --- 50 hotových výrobků s kusovníkem ---
const TYPY_VYROBKU = [
  "Čerpadlo odstředivé", "Převodovka šneková", "Rám podvozkový", "Skříň rozvaděče",
  "Dopravník pásový", "Hydraulický agregát", "Svařenec nosný", "Kryt převodovky",
  "Konzole montážní", "Ventilová jednotka",
];
const vyrobky = [];
let cisloVyr = 5000100;
for (let i = 0; i < 50; i++) {
  const typ = TYPY_VYROBKU[i % TYPY_VYROBKU.length];
  const oznaceni = typ + " " + String.fromCharCode(65 + (i % 6)) + celeMezi(100, 999);
  const slozky = vyberN(materialy, celeMezi(4, 9)).map((m) => ({
    material: m,
    mnozstvi: Number(mezi(0.5, m.mj === "KS" ? 12 : 8).toFixed(2)),
  }));
  const materialoveNaklady = slozky.reduce((s, p) => s + p.mnozstvi * p.material.cena, 0);
  // Standardní cena = materiál + přirážka za práci a výrobní režii.
  const standardniCena = Number((materialoveNaklady * mezi(1.14, 1.26)).toFixed(2));
  // Tři výrobky schválně s tenkou marží — ať má analytika co odhalit.
  const tenka = i === 7 || i === 23 || i === 41;
  const prirazka = tenka ? mezi(1.02, 1.12) : mezi(1.34, 1.62);
  vyrobky.push({
    cislo: String(cisloVyr++),
    nazev: oznaceni,
    skupina: "Hotový výrobek",
    mj: "KS",
    slozky,
    standardniCena,
    prodejniCena: Number((standardniCena * prirazka).toFixed(2)),
    zavod: vyber(ZAVODY),
  });
}

// --- stav skladu, ať nic nejde do mínusu ---
const sklad = new Map();
const pridej = (kod, n) => sklad.set(kod, (sklad.get(kod) ?? 0) + n);
const stav = (kod) => sklad.get(kod) ?? 0;

const radky = [];
let doklad = 4900000001;
const novyDoklad = () => String(doklad++);
const sarze = (p) => "S" + p + celeMezi(1000, 9999);

function zapis(o) {
  radky.push({
    datumZauctovani: ddmmrrrr(o.datum),
    datumDokladu: ddmmrrrr(o.datumDokl ?? o.datum),
    doklad: o.doklad,
    polozka: String(o.polozka),
    zavod: o.zavod,
    sklad: o.sklad,
    material: o.material.cislo,
    textMaterialu: o.material.nazev,
    skupina: o.material.skupina,
    druhPohybu: o.druh,
    textPohybu: o.textPohybu,
    sh: o.mnozstvi >= 0 ? "S" : "H",
    mnozstvi: cis(o.mnozstvi, 3),
    mj: o.material.mj,
    cenaZaMj: cis(o.cena, 2),
    hodnota: cis(o.mnozstvi * o.cena, 2),
    mena: "CZK",
    zakazka: o.zakazka ?? "",
    dodavatel: o.dodavatel ?? "",
    odberatel: o.odberatel ?? "",
    sarze: o.sarze ?? "",
    trzba: o.trzba != null ? cis(o.trzba, 2) : "",
    cogs: o.cogs != null ? cis(o.cogs, 2) : "",
    rezie: o.rezie != null ? cis(o.rezie, 2) : "",
    uzivatel: vyber(UZIVATELE),
    stredisko: o.stredisko ?? vyber(STREDISKA),
  });
}

// === 1) Nákup: příjmy vstupního materiálu (101) ===
// Váženo na začátek období, ať je z čeho vyrábět.
for (const m of materialy) {
  const pocet = celeMezi(3, 8);
  for (let i = 0; i < pocet; i++) {
    const den = denIndex(Math.floor(Math.pow(nahoda(), 1.7) * PRACOVNI.length));
    const mn = Number(mezi(m.mj === "KS" ? 80 : 150, m.mj === "KS" ? 1200 : 2200).toFixed(2));
    // Ocel od dubna zdražuje — ať je v datech vidět nákladový posun.
    const zdrazeni = m.skupinaKod === "ROH-OCEL" && den.getUTCMonth() >= 3 ? 1.18 : 1;
    pridej(m.cislo, mn);
    zapis({
      datum: den, doklad: novyDoklad(), polozka: 1, zavod: m.zavod, sklad: SKLADY.vstup,
      material: m, druh: "101", textPohybu: "Příjem zboží na objednávku",
      mnozstvi: mn, cena: Number((m.cena * zdrazeni).toFixed(2)),
      dodavatel: vyber(DODAVATELE), sarze: sarze("N"), stredisko: "4010 Nákup",
    });
  }
}

// === 2) Výroba: výdej dílů do zakázky (261) + příjem z výroby (131) ===
const zakazky = [];
for (let i = 0; i < 300; i++) {
  const v = vyber(vyrobky);
  // Zakázka nesmí začít hned první den — materiál musí být na skladě.
  const denIdx = celeMezi(Math.floor(PRACOVNI.length * 0.08), PRACOVNI.length - 6);
  const den = denIndex(denIdx);
  const mnV = celeMezi(4, 45);

  if (!v.slozky.every((s) => stav(s.material.cislo) >= s.mnozstvi * mnV)) continue;

  const cisloZak = "VZ" + (400000 + i);
  const dokl = novyDoklad();
  v.slozky.forEach((s, idx) => {
    const spotreba = Number((s.mnozstvi * mnV).toFixed(2));
    pridej(s.material.cislo, -spotreba);
    zapis({
      datum: den, doklad: dokl, polozka: idx + 1, zavod: v.zavod, sklad: SKLADY.vstup,
      material: s.material, druh: "261", textPohybu: "Výdej do výrobní zakázky",
      mnozstvi: -spotreba, cena: s.material.cena, zakazka: cisloZak,
      stredisko: vyber(["5020 Výroba montáž", "5030 Výroba obrábění"]),
    });
  });

  // Zmetky — v březnu schválně častěji, ať je co najít.
  if (nahoda() < (den.getUTCMonth() === 2 ? 0.22 : 0.06)) {
    const s = vyber(v.slozky);
    const zmetek = Number((s.mnozstvi * mezi(0.5, 2.5)).toFixed(2));
    if (stav(s.material.cislo) >= zmetek) {
      pridej(s.material.cislo, -zmetek);
      zapis({
        datum: den, doklad: novyDoklad(), polozka: 1, zavod: v.zavod, sklad: SKLADY.vstup,
        material: s.material, druh: "551", textPohybu: "Výdej do šrotu",
        mnozstvi: -zmetek, cena: s.material.cena, zakazka: cisloZak,
        stredisko: "5030 Výroba obrábění",
      });
    }
  }

  const denHotovo = denIndex(denIdx + celeMezi(1, 5));
  zakazky.push({ vyrobek: v, denIdx: denIdx + celeMezi(1, 5), mnozstvi: mnV });
  zapis({
    datum: denHotovo, doklad: novyDoklad(), polozka: 1, zavod: v.zavod, sklad: SKLADY.hotove,
    material: v, druh: "131", textPohybu: "Příjem z výroby",
    mnozstvi: mnV, cena: v.standardniCena, zakazka: cisloZak, sarze: sarze("V"),
    stredisko: "5020 Výroba montáž",
  });
}

// === 3) Prodej hotových výrobků (601) ===
// Jeden odběratel má trvale vyšší slevu — další věc, kterou má analytika najít.
const SLEVOVY = ODBERATELE[3];
for (const z of zakazky) {
  let zbyva = z.mnozstvi;
  const dodavek = celeMezi(1, 3);
  for (let i = 0; i < dodavek && zbyva > 0; i++) {
    const mn = i === dodavek - 1 ? zbyva : Math.max(1, Math.floor(zbyva * mezi(0.3, 0.7)));
    zbyva -= mn;
    const denProdeje = denIndex(z.denIdx + celeMezi(2, 20));
    const odberatel = vyber(ODBERATELE);
    const sleva = odberatel === SLEVOVY ? mezi(0.82, 0.9) : mezi(0.95, 1.03);
    const trzba = Number((z.vyrobek.prodejniCena * sleva * mn).toFixed(2));
    zapis({
      datum: denProdeje, doklad: novyDoklad(), polozka: 1, zavod: z.vyrobek.zavod,
      sklad: SKLADY.hotove, material: z.vyrobek, druh: "601",
      textPohybu: "Výdej při dodání zákazníkovi",
      mnozstvi: -mn, cena: z.vyrobek.standardniCena, odberatel, sarze: sarze("V"),
      trzba,
      cogs: Number((z.vyrobek.standardniCena * mn).toFixed(2)),
      rezie: Number((trzba * mezi(0.17, 0.23)).toFixed(2)),
      stredisko: "6010 Expedice",
    });
  }
}

// === 4) Pár storen, ať data vypadají jako z reálného provozu ===
for (const r of radky.filter((x) => x.druhPohybu === "101").slice(0, 28)) {
  if (nahoda() < 0.5) continue;
  const mn = -Number(r.mnozstvi.split(",").join("."));
  radky.push({
    ...r, doklad: novyDoklad(), druhPohybu: "102", textPohybu: "Storno příjmu zboží",
    sh: "H", mnozstvi: cis(mn, 3),
    hodnota: cis(mn * Number(r.cenaZaMj.split(",").join(".")), 2),
  });
}

// --- seřadit jako reálný výpis: podle data a dokladu ---
const naDatum = (s) => {
  const [d, m, r] = s.split(".");
  return r + m + d;
};
radky.sort(
  (a, b) =>
    naDatum(a.datumZauctovani).localeCompare(naDatum(b.datumZauctovani)) ||
    a.doklad.localeCompare(b.doklad),
);

// --- zápis CSV ---
const HLAVICKA = [
  ["datumZauctovani", "Datum zaúčtování"], ["datumDokladu", "Datum dokladu"],
  ["doklad", "Materiálový doklad"], ["polozka", "Položka"],
  ["zavod", "Závod"], ["sklad", "Sklad"],
  ["material", "Materiál"], ["textMaterialu", "Text materiálu"], ["skupina", "Skupina materiálu"],
  ["druhPohybu", "Druh pohybu"], ["textPohybu", "Text druhu pohybu"], ["sh", "S/H"],
  ["mnozstvi", "Množství"], ["mj", "ZMJ"],
  ["cenaZaMj", "Cena za MJ"], ["hodnota", "Hodnota pohybu"], ["mena", "Měna"],
  ["zakazka", "Výrobní zakázka"], ["dodavatel", "Dodavatel"], ["odberatel", "Odběratel"],
  ["sarze", "Šarže"],
  ["trzba", "Tržba bez DPH"], ["cogs", "COGS"], ["rezie", "Režie"],
  ["uzivatel", "Uživatel"], ["stredisko", "Nákladové středisko"],
];
const uvozovky = (v) => {
  const s = String(v ?? "");
  return s.includes(";") || s.includes('"') || s.includes("\n")
    ? '"' + s.split('"').join('""') + '"'
    : s;
};
const radek = (pole) => pole.map(uvozovky).join(";");
const csv = [
  radek(HLAVICKA.map((h) => h[1])),
  ...radky.map((r) => radek(HLAVICKA.map((h) => r[h[0]]))),
].join("\r\n");

mkdirSync("sample-data", { recursive: true });
const cesta = "sample-data/sap-mb51-materialove-pohyby.csv";
writeFileSync(cesta, "﻿" + csv, "utf8");

// --- kontrolní součty (to, co má appka spočítat) ---
const num = (s) => (s === "" ? 0 : Number(s.split(",").join(".")));
const soucet = (k) => radky.reduce((s, r) => s + num(r[k]), 0);
const trzby = soucet("trzba");
const cogsC = soucet("cogs");
const rezieC = soucet("rezie");
const podleDruhu = {};
for (const r of radky) podleDruhu[r.druhPohybu] = (podleDruhu[r.druhPohybu] ?? 0) + 1;
const kc = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 0 });

console.log("Soubor: " + cesta);
console.log("Řádků: " + radky.length + "   Sloupců: " + HLAVICKA.length);
console.log("Materiálů: " + materialy.length + "   Výrobků: " + vyrobky.length + "   Zakázek: " + zakazky.length);
console.log("Období: " + ddmmrrrr(PRACOVNI[0]) + " – " + ddmmrrrr(PRACOVNI[PRACOVNI.length - 1]));
console.log("\nPočty podle druhu pohybu:");
for (const [d, n] of Object.entries(podleDruhu).sort()) console.log("  " + d + "  " + n);
console.log("\n=== KONTROLNÍ SOUČTY (tohle má vyjít i v appce) ===");
console.log("  Tržby bez DPH : " + kc(trzby) + " Kč");
console.log("  COGS          : " + kc(cogsC) + " Kč");
console.log("  Režie         : " + kc(rezieC) + " Kč");
console.log("  Hrubý zisk    : " + kc(trzby - cogsC) + " Kč");
console.log("  Hrubá marže   : " + (((trzby - cogsC) / trzby) * 100).toFixed(1) + " %");
console.log("  Čistý zisk    : " + kc(trzby - cogsC - rezieC) + " Kč");
console.log("  Čistá marže   : " + (((trzby - cogsC - rezieC) / trzby) * 100).toFixed(1) + " %");
const minus = [...sklad.entries()].filter(([, v]) => v < -0.001);
console.log("\nSklad v mínusu: " + (minus.length === 0 ? "nikde (konzistentní)" : minus.length + " materiálů !!"));
