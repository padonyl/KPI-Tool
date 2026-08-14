export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace("%", "").replace(/\s/g, "");
  if (s === "") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && !hasDot) {
    // český formát desetinné čárky, např. "12,5"
    s = s.replace(",", ".");
  } else if (hasComma && hasDot) {
    // tisícové oddělovače, např. "1,234.5" -> odstranit čárky
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Je to skutečně existující datum v rozumném rozsahu?
 *
 * Horní hranice brání nesmyslům typu roku 2600, které vznikaly z čísel
 * zakázek (viz komentář u parseDateValue).
 *
 * Spodní hranice je 1950 schválně: Excel má epochu v roce 1900, takže prázdná
 * nebo rozbitá buňka se často propíše jako 1.1.1900 (případně 30.12.1899).
 * To není datum, to je artefakt - a provozní data výrobní firmy z padesátých
 * let stejně nikdo nesleduje, takže se tím nic použitelného neodřízne.
 */
function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (year < 1950 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Přečte datum jen z formátů, které jsou skutečně datem.
 *
 * VĚDOMĚ BEZ volného `new Date(s)` fallbacku: ten bral skoro cokoliv a tiše
 * z toho dělal nesmysly - "OBJ-2601" (číslo zakázky) vracel jako 2600-12-31,
 * "M-1001" jako 1000-12-31, "100" jako 0099-12-31. Kvůli tomu appka
 * označila sloupec s čísly objednávek za sloupec s datem a spadl na tom
 * první pokus o OTIF šablonu. Radši datum nepřečíst, než přečíst špatně.
 */
export function parseDateValue(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;

  // Oddělovače bereme zaměnitelně (tečka, lomítko, pomlčka) - exporty je
  // občas míchají ("16/05.2026") a význam je i tak jednoznačný. Čas na konci
  // se zahazuje. O pořadí složek rozhoduje, na které straně je čtyřciferný rok:
  //   2026-01-31 -> rok první (ISO),  31.01.2026 -> den první (český zápis).
  const parts = s.match(
    /^(\d{1,4})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{1,4})(?:[T ][\d:.]+.*)?$/,
  );
  if (!parts) return null;

  const first = Number(parts[1]);
  const middle = Number(parts[2]);
  const last = Number(parts[3]);

  if (parts[1].length === 4) return toIsoIfValid(first, middle, last);
  if (parts[3].length === 4) return toIsoIfValid(last, middle, first);

  // Dvouciferný rok nechceme hádat (05.06.07 může být cokoliv).
  return null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function endOfMonthIso(dateIso: string): string {
  const [y, m] = dateIso.split("-").map(Number);
  // den 0 příštího měsíce = poslední den tohoto měsíce
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
