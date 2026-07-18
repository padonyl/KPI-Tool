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

export function parseDateValue(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;

  // už ISO (např. z Excel Date buňky převedené v parse-file.ts)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // D.M.YYYY nebo DD.MM.YYYY (český formát)
  const czMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (czMatch) {
    const [, d, m, y] = czMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // D/M/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
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
