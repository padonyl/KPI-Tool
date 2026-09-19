// Rozdělení hodnot do košů pro histogram.
//
// PROČ TO STOJÍ ZA SAMOSTATNÝ SOUBOR: šířka koše rozhoduje o tom, co člověk
// v grafu uvidí. Šířka spočítaná jako `rozpeti / 12` dá hranice typu
// „od 3,7142 do 7,4285", což je nečitelné a budí dojem falešné přesnosti.
// Proto se zaokrouhluje na „hezké" číslo (1 / 2 / 5 × 10ⁿ) — stejná úvaha
// jako u zaokrouhlování benchmarkingu, viz 10_concept/benchmarking_anonymizace.md.

export type Kos = {
  od: number;
  /** Horní hranice, VÝLUČNĚ — hodnota rovná `do` patří do dalšího koše. */
  do: number;
  pocet: number;
};

/** Nejbližší vyšší „hezké" číslo: 1, 2, 5, 10, 20, 50, 100… */
function hezkaSirka(hruba: number): number {
  if (!(hruba > 0)) return 1;
  const rad = 10 ** Math.floor(Math.log10(hruba));
  const podil = hruba / rad;
  const nasobek = podil <= 1 ? 1 : podil <= 2 ? 2 : podil <= 5 ? 5 : 10;
  return nasobek * rad;
}

/**
 * Rozdělí hodnoty do košů. Vrací prázdné pole, když není co zobrazit.
 *
 * `cilKosu` je PŘÁNÍ, ne závazek — po zaokrouhlení šířky na hezké číslo
 * jich vyjde o pár víc nebo míň, a to je v pořádku.
 */
export function rozdeleni(hodnoty: number[], cilKosu = 12): Kos[] {
  const cisla = hodnoty.filter((h) => Number.isFinite(h));
  if (cisla.length === 0) return [];

  let min = cisla[0];
  let max = cisla[0];
  for (const h of cisla) {
    if (h < min) min = h;
    if (h > max) max = h;
  }

  // Všechny hodnoty stejné — histogram nemá co ukázat, ale jeden sloupec
  // je poctivější než prázdno: „všech 300 řádků má 5".
  if (min === max) return [{ od: min, do: min, pocet: cisla.length }];

  const sirka = hezkaSirka((max - min) / cilKosu);
  const zacatek = Math.floor(min / sirka) * sirka;
  // +1 kvůli tomu, že `max` samo o sobě musí mít kam spadnout.
  const pocetKosu = Math.floor((max - zacatek) / sirka) + 1;

  const kose: Kos[] = [];
  for (let i = 0; i < pocetKosu; i++) {
    kose.push({ od: zacatek + i * sirka, do: zacatek + (i + 1) * sirka, pocet: 0 });
  }

  for (const h of cisla) {
    let i = Math.floor((h - zacatek) / sirka);
    // Plovoucí čárka umí u hraniční hodnoty utéct o jeden koš mimo pole.
    if (i < 0) i = 0;
    if (i >= kose.length) i = kose.length - 1;
    kose[i].pocet += 1;
  }

  return kose;
}
