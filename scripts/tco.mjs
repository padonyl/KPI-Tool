// TCO: co stojí mít reporting. Tři varianty na 1 a 3 roky.
//
// PROČ SKRIPT A NE TABULKA V DOKUMENTU: čísla se budou měnit (naše cena
// zatím neexistuje, kurz se hýbe, mzdy rostou). Natvrdo přepsaná čísla
// v prodejním materiálu zastarají a nikdo si nevšimne. Tohle se přepočítá.
//
// Spustit: node scripts/tco.mjs
// Zdroje a předpoklady jsou vypsané dole ve výstupu — patří k číslům.

// ---------------------------------------------------------------
// VSTUPY — tady se ladí
// ---------------------------------------------------------------
const KURZ = 21;                  // Kč/USD, ~ září 2026

// Varianta 0 — zůstat v Excelu
const EXCEL_HODIN_MESICNE = 24;   // ILUSTRATIVNÍ. Ptát se zákazníka!
const MZDA_HRUBA_REPORTER = 60_000; // kdo dnes reporty skládá (controller)

// Varianta 1 — Padonyl
const PADONYL_ROCNE = null;       // cena zatím NEROZHODNUTÁ, viz cenovy_model_navrh
const PADONYL_HODIN_MESICNE = 2;  // nahrát soubory, zkontrolovat

// Varianta 2 — vlastní DWH + BI
const DWH_CLOVEK_NAKLAD_MESICNE = 100_000; // náklad firmy, ne hrubá mzda
const BI_UZIVATELU = [5, 15];
const POWER_BI_PRO_USD = 14;      // za uživatele a měsíc
const INFRA_USD_MESICNE = 156;    // Fabric F2, roční rezervace

const ODVODY = 1.338;             // 24,8 % soc. + 9 % zdrav. na straně firmy
const HODIN_MESICNE = 160;

// ---------------------------------------------------------------
const kc = (n) => n === null ? "?" : Math.round(n).toLocaleString("cs-CZ") + " Kč";
const nakladHodiny = (hruba) => (hruba * ODVODY) / HODIN_MESICNE;

const hodinaReportera = nakladHodiny(MZDA_HRUBA_REPORTER);

const varianty = [];

varianty.push({
  nazev: "0) Zůstat v Excelu",
  polozky: [
    ["čas na skládání reportů",
      EXCEL_HODIN_MESICNE * hodinaReportera * 12,
      `${EXCEL_HODIN_MESICNE} h/měs × ${Math.round(hodinaReportera)} Kč/h`],
  ],
});

varianty.push({
  nazev: "1) Padonyl",
  polozky: [
    ["licence", PADONYL_ROCNE, "zatím nerozhodnuto"],
    ["čas na nahrání dat",
      PADONYL_HODIN_MESICNE * hodinaReportera * 12,
      `${PADONYL_HODIN_MESICNE} h/měs × ${Math.round(hodinaReportera)} Kč/h`],
  ],
});

for (const uziv of BI_UZIVATELU) {
  varianty.push({
    nazev: `2) Vlastní DWH + BI (${uziv} uživatelů)`,
    polozky: [
      ["člověk na DWH a BI (1,0 úvazku)", DWH_CLOVEK_NAKLAD_MESICNE * 12,
        `${kc(DWH_CLOVEK_NAKLAD_MESICNE)}/měs nákladu firmy`],
      ["licence Power BI Pro", POWER_BI_PRO_USD * uziv * 12 * KURZ,
        `${POWER_BI_PRO_USD} USD × ${uziv} × 12`],
      ["infrastruktura skladu", INFRA_USD_MESICNE * 12 * KURZ,
        `${INFRA_USD_MESICNE} USD/měs`],
    ],
  });
}

console.log("=".repeat(78));
console.log("TCO reportingu — roční náklad a tříletý součet");
console.log("=".repeat(78));

for (const v of varianty) {
  const znamo = v.polozky.filter((p) => p[1] !== null);
  const rocne = znamo.reduce((s, p) => s + p[1], 0);
  const neznamo = v.polozky.some((p) => p[1] === null);

  console.log("\n" + v.nazev);
  for (const [popis, castka, pozn] of v.polozky) {
    console.log("   " + popis.padEnd(34) + kc(castka).padStart(14) + "   " + pozn);
  }
  console.log("   " + "─".repeat(62));
  console.log("   " + (neznamo ? "ročně (bez licence)" : "ročně").padEnd(34) + kc(rocne).padStart(14));
  console.log("   " + (neznamo ? "3 roky (bez licence)" : "3 roky").padEnd(34) + kc(rocne * 3).padStart(14));
  v._rocne = rocne;
}

// --- co z toho plyne ---
const dwh5 = varianty.find((v) => v.nazev.includes("5 uživatelů"));
const clovek = DWH_CLOVEK_NAKLAD_MESICNE * 12;
const podilCloveka = (clovek / dwh5._rocne) * 100;

console.log("\n" + "=".repeat(78));
console.log("CO Z TOHO PLYNE");
console.log("=".repeat(78));
console.log(`\n• Člověk tvoří ${podilCloveka.toFixed(0)} % nákladu vlastního řešení.`);
console.log(`  Licence a infrastruktura dohromady jen ${(100 - podilCloveka).toFixed(0)} %.`);
console.log("  → Argument NENÍ „naše licence je levnější než Power BI\" (ta je levná),");
console.log("    ale „u nás nepotřebuješ toho člověka\".");
console.log(`\n• I kdyby firma vystačila s POLOVIČNÍM úvazkem, vyjde vlastní řešení`);
console.log(`  na ${kc(dwh5._rocne - clovek / 2)} ročně, tedy ${kc((dwh5._rocne - clovek / 2) * 3)} za tři roky.`);
console.log(`\n• Prostor pro naši cenu: cokoliv pod ${kc(dwh5._rocne)} ročně je levnější`);
console.log("  než vlastní řešení — a to je řádově jiná úroveň než licence Power BI.");

// --- bod zvratu proti Excelu ---
//
// Tohle je ta nepříjemná část, kterou materiál NESMÍ zamlčet: proti
// vlastnímu skladu vyhrajeme na náklad drtivě, ale proti „zůstat v Excelu"
// NE automaticky. Excel není zadarmo, ale je levný — a jestli se vyplatíme,
// závisí na tom, kolik času nad reporty u zákazníka reálně shoří.
// Kdo povede jednání nákladovým argumentem u firmy, která reporty skládá
// dvě hodiny měsíčně, dostane spočítáno, že má zůstat, kde je.
console.log("\n" + "-".repeat(78));
console.log("BOD ZVRATU PROTI EXCELU (kolik hodin měsíčně to musí zákazníka stát)");
console.log("-".repeat(78));
console.log("\nNaše cena je zatím proměnná, proto ILUSTRATIVNÍ rozpětí — nejsou to naše ceny:\n");
console.log("   cena/rok".padEnd(16) + "bod zvratu".padStart(16) + "   pod tím je levnější Excel");
for (const cena of [30_000, 60_000, 90_000, 120_000]) {
  // Vyplatí se, když: cena + náš čas < hodiny * sazba * 12
  const hodin = (cena + PADONYL_HODIN_MESICNE * hodinaReportera * 12) / (hodinaReportera * 12);
  console.log("   " + kc(cena).padEnd(13) + (hodin.toFixed(1) + " h/měs").padStart(16));
}
console.log("\n→ Proti vlastnímu skladu je to nákladový argument.");
console.log("  Proti Excelu je to argument o tom, CO firma uvidí — ne o ceně.");
console.log("  Kdo to zamění, dostane od zákazníka spočítáno, že má zůstat v Excelu.");

console.log("\n" + "-".repeat(78));
console.log("PŘEDPOKLADY (patří ke každému použití těchto čísel)");
console.log("-".repeat(78));
console.log(`• Kurz ${KURZ} Kč/USD (září 2026).`);
console.log(`• Odvody zaměstnavatele ${((ODVODY - 1) * 100).toFixed(1)} % (24,8 % soc. + 9 % zdrav.), sazby 2026.`);
console.log(`• Náklad člověka na DWH+BI ${kc(DWH_CLOVEK_NAKLAD_MESICNE)}/měs = zhruba ${kc(DWH_CLOVEK_NAKLAD_MESICNE / ODVODY)} hrubého.`);
console.log("  Zdroje uvádějí pro BI analytika v ČR 48–88 tis. hrubého, tohle je spodní polovina.");
console.log(`• Power BI Pro ${POWER_BI_PRO_USD} USD/uživatel/měsíc (Microsoft zdražil z 10 USD k 1. 4. 2025).`);
console.log(`• Infrastruktura ${INFRA_USD_MESICNE} USD/měs = Microsoft Fabric F2 s roční rezervací.`);
console.log("  Bez rezervace 263 USD/měs. Větší sklad bude dražší.");
console.log("• NEZAPOČÍTÁNA implementace (4–8 týdnů na jedno oddělení, 3–6 měsíců na sklad");
console.log("  a reporting pro vedení). Ceny agentur nejsou veřejné, kvótují se individuálně.");
console.log(`• ${EXCEL_HODIN_MESICNE} h/měs u varianty 0 je ILUSTRATIVNÍ číslo — u zákazníka se na něj zeptat,`);
console.log("  ne ho tvrdit. Jeho vlastní odhad je přesvědčivější než jakýkoliv náš.");

// ---------------------------------------------------------------
// Varianta 0 se neporáží cenou — je nejlevnější a to je v pořádku.
// Porážejí ji disbenefity, a ty nejsou v korunách. Rozepsané jsou
// v 10_concept/podklady_pro_dokumenty.md, sekce TCO. Pořadí podle síly:
//   1. přestaneš se ptát na to, co je drahé spočítat  ← naše pozicování
//   2. historie se přepisuje → trend neexistuje
//   3. rozhoduje se podle dat starých 4–6 týdnů
//   4. chyby, které nikdo nehledá (audity: chyby v ≥ 86 % tabulek)
//   5. celý reporting drží jeden člověk
//   6. definice se v čase rozcházejí
//   7. zjistit „proč" je další ruční projekt
// ---------------------------------------------------------------
