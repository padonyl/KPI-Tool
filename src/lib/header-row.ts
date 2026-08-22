// ============================================================
// Nalezení řádku s názvy sloupců (2026-08-22).
//
// PROČ: dosud se předpokládalo, že hlavička je na prvním řádku. Reálné
// exporty to nedodržují - analytici tabulky odsazují, dávají nad ně
// nadpis, nebo mají hlavičku dvoupatrovou (v Excelu sloučená buňka
// „Tržby" nad sloupci 3-6 a pod ní jednotlivé druhy tržeb).
//
// Uživatelův příklad: řádek 1 prázdný, řádek 2 sloučená buňka, řádek 3
// skutečné názvy sloupců. Původní kód by z toho udělal nesmysl - a u
// Excelu dokonce potichu, protože prázdné buňky přeskakoval a data pak
// četl z posunutých sloupců.
//
// Odhad se uživateli VŽDY ukáže k potvrzení, nikdy se nepoužije mlčky -
// stejný princip jako u návrhu sloupce s datem (viz kpi-settings.ts).
// ============================================================

/** Kolik prvních řádků se prohledává. Dál než sem hlavička nebývá. */
export const MAX_HLEDANI = 15;

export type HlavickaOdhad = {
  /** Index řádku v matici (0 = první řádek souboru). */
  index: number;
  /** Jak moc si jsme jistí, 0-1. Pod 0,5 stojí za to zeptat se důrazněji. */
  jistota: number;
  duvod: string;
};

function jeCislo(hodnota: string): boolean {
  const s = hodnota.trim().replace(/\s/g, "").replace(",", ".");
  return s !== "" && !Number.isNaN(Number(s));
}

/**
 * Ohodnotí, jak moc řádek vypadá jako hlavička.
 *
 * Hlavička má: vysoký podíl vyplněných buněk, skoro samý text (ne čísla),
 * neopakující se hodnoty. Datový řádek má naopak čísla a klidně i
 * duplicity. Nadpisový řádek nad tabulkou má jednu vyplněnou buňku a
 * zbytek prázdný - proto se vyplněnost počítá vůči nejširšímu řádku
 * souboru, ne vůči sobě samému.
 */
function skore(radek: string[], sirka: number): number {
  const vyplnene = radek.filter((b) => b.trim() !== "");
  if (vyplnene.length === 0) return 0;

  const podilVyplnenych = vyplnene.length / Math.max(sirka, 1);
  const podilTextu = vyplnene.filter((b) => !jeCislo(b)).length / vyplnene.length;
  const podilUnikatnich = new Set(vyplnene.map((b) => b.trim().toLowerCase())).size / vyplnene.length;

  // Vyplněnost váží nejvíc: odliší hlavičku od nadpisu nad tabulkou
  // i od dvoupatrové hlavičky, kde je horní patro skoro prázdné.
  return podilVyplnenych * 0.5 + podilTextu * 0.3 + podilUnikatnich * 0.2;
}

/**
 * Najde nejpravděpodobnější řádek s názvy sloupců.
 *
 * Nestačí vzít první neprázdný řádek - u dvoupatrové hlavičky by to
 * byla ta sloučená buňka, tedy přesně ten špatný. Proto se hodnotí
 * několik řádků a vybírá nejlepší.
 */
export function najdiHlavicku(matice: string[][]): HlavickaOdhad {
  if (matice.length === 0) {
    return { index: 0, jistota: 0, duvod: "Soubor je prázdný." };
  }

  const sirka = Math.max(...matice.map((r) => r.length));
  const kandidati = matice.slice(0, MAX_HLEDANI).map((radek, index) => ({
    index,
    hodnota: skore(radek, sirka),
    vyplnenych: radek.filter((b) => b.trim() !== "").length,
  }));

  const nejlepsi = kandidati.reduce((a, b) => (b.hodnota > a.hodnota ? b : a));

  // Když je první řádek skoro stejně dobrý, dej mu přednost - je to
  // nejběžnější případ a nemá smysl uživatele mást nabídkou pátého řádku
  // kvůli setině skóre.
  const prvni = kandidati[0];
  const vitez = nejlepsi.hodnota - prvni.hodnota < 0.1 ? prvni : nejlepsi;

  let duvod: string;
  if (vitez.index === 0) {
    duvod = "Názvy sloupců vypadají hned na prvním řádku.";
  } else {
    const preskocene = vitez.index;
    duvod =
      `Prvních ${preskocene} ${preskocene === 1 ? "řádek vypadá" : "řádků vypadá"} ` +
      `jako nadpis nebo odsazení, ne jako názvy sloupců.`;
  }

  return { index: vitez.index, jistota: Math.min(vitez.hodnota, 1), duvod };
}

/**
 * Udělá z řádku matice použitelné názvy sloupců.
 *
 * Dvě věci, které reálné soubory dělají a rozbily by mapování:
 * prázdné buňky (u sloučených nebo pomocných sloupců) a stejné názvy
 * víckrát (typicky „Kč" pod několika skupinami). Obojí se musí
 * pojmenovat jednoznačně, protože názvy slouží jako klíče řádků.
 */
export function nazvySloupcu(radek: string[], sirka: number): string[] {
  const pouzite = new Map<string, number>();

  return Array.from({ length: sirka }, (_, i) => {
    const puvodni = (radek[i] ?? "").trim();
    const zaklad = puvodni === "" ? `Sloupec ${i + 1}` : puvodni;

    const kolikrat = pouzite.get(zaklad) ?? 0;
    pouzite.set(zaklad, kolikrat + 1);
    return kolikrat === 0 ? zaklad : `${zaklad} (${kolikrat + 1})`;
  });
}

/** Poskládá řádky jako objekty podle zvolené hlavičky. */
export function radkyPodleHlavicky(
  matice: string[][],
  indexHlavicky: number,
): { headers: string[]; rows: Record<string, string>[] } {
  if (matice.length === 0) return { headers: [], rows: [] };

  const sirka = Math.max(...matice.map((r) => r.length));
  const headers = nazvySloupcu(matice[indexHlavicky] ?? [], sirka);

  const rows: Record<string, string>[] = [];
  for (let i = indexHlavicky + 1; i < matice.length; i += 1) {
    const radek = matice[i];
    const zaznam: Record<string, string> = {};
    let maObsah = false;

    headers.forEach((nazev, j) => {
      const hodnota = (radek[j] ?? "").trim();
      zaznam[nazev] = hodnota;
      if (hodnota !== "") maObsah = true;
    });

    if (maObsah) rows.push(zaznam);
  }

  return { headers, rows };
}
