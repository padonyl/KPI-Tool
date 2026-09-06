// Horní mez rozumné hodnoty. Nad ní jde skoro jistě o překlep nebo abúz
// (test 30 person uložil `1e308` jako hodnotu i jako cíl KPI). Bilión Kč
// je pro SME řádově mimo realitu, takže se tím nic použitelného neodřízne.
const MAX_ABS = 1e15;

/**
 * Přečte číslo z textu. VĚDOMĚ STRIKTNÍ — radši null než tiché zkreslení.
 *
 * Nálezy testu 2026-09-06, které tahle verze zavírá:
 *   * `Number("0x1F")` vracelo 31, `Number("0o17")`/`Number("0b101")` taky —
 *     kód dílu z výroby se tak uložil jako číslo. Hex/oktal/binár/scientific
 *     se teď odmítají (projde jen desítkový zápis).
 *   * mezery se dřív maazaly VŠECHNY, takže „1 2 3" → 123. Teď se odstraní
 *     jen když tvoří tisícové skupiny („1 234 567"); jinak je vstup neplatný.
 *   * `1e308` se uložilo jako hodnota. Teď platí mez |x| ≤ 1e15.
 */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/%/g, "").trim();
  if (s === "") return null;

  // Mezery: buď tisícové skupiny (odstranit), nebo chyba (nezalepovat).
  if (/\s/.test(s)) {
    if (/^[+-]?\d{1,3}(\s\d{3})+([.,]\d+)?$/.test(s)) {
      s = s.replace(/\s/g, "");
    } else {
      return null;
    }
  }

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && !hasDot) {
    s = s.replace(",", "."); // český desetinný zápis „12,5"
  } else if (hasComma && hasDot) {
    s = s.replace(/,/g, ""); // tisícové čárky „1,234.5"
  }

  // Striktní desítkový tvar — žádný 0x/0o/0b ani „1e3". Number() by je bral.
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || Math.abs(n) > MAX_ABS) return null;
  return n;
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
// Rozumný rozsah roku pro provozní data. Sdílené s ručním zápisem, aby
// platila stejná mez jako pro import ze souboru (nález testu 2026-09-06:
// ruční zápis bral roky 1000 i 999999 → rozbitá časová osa a „NaN").
export const ROK_MIN = 1950;
export const ROK_MAX = 2200;

/** Je rok v rozumném provozním rozsahu? */
export function jeRozumnyRok(year: number): boolean {
  return Number.isInteger(year) && year >= ROK_MIN && year <= ROK_MAX;
}

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (year < ROK_MIN || year > ROK_MAX) return null;
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
