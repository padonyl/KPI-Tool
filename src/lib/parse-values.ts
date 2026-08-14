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
 * Rozsah let brání tomu, aby prošly nesmysly typu roku 99 nebo 2600, které
 * vznikaly z čísel zakázek a materiálů (viz komentář u parseDateValue).
 */
function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
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

  // ISO, volitelně s časem (Excel Date buňka převedená v parse-file.ts,
  // nebo export typu "2026-01-31 00:00:00")
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+.*)?$/);
  if (iso) {
    return toIsoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // D.M.YYYY nebo DD.MM.YYYY (český formát), volitelně s časem
  const cz = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})(?:[T ][\d:.]+.*)?$/);
  if (cz) {
    return toIsoIfValid(Number(cz[3]), Number(cz[2]), Number(cz[1]));
  }

  // D/M/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return toIsoIfValid(Number(slash[3]), Number(slash[2]), Number(slash[1]));
  }

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
