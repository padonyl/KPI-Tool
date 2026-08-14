// Zobrazení období pro člověka.
//
// V DB je období uložené jako datum konce (`period_end`), takže měsíc leden
// vypadá jako "2026-01-31". To se ale čte jako KONKRÉTNÍ DEN, ne jako měsíc -
// uživatel pak nechápe, proč má v nabídce třicet "období" místo jednoho měsíce.
//
// Záměrně NEpřevádíme naslepo: pokud datum na konec období nesedí (typicky
// starší data nahraná přes staré typy pravidel, které datum nezarovnávaly),
// zobrazí se jako den. Jinak by dvě různá lednová data vypadala obě jako
// "Leden 2026" a tvářila se jako duplicita.

const MONTHS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

function parts(periodEnd: string): { y: number; m: number; d: number } | null {
  const match = periodEnd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "31. 1. 2026" - fallback, když datum na období nesedí. */
function formatDay(p: { y: number; m: number; d: number }): string {
  return `${p.d}. ${p.m}. ${p.y}`;
}

/**
 * Období lidsky: "Leden 2026", "Q1 2026", "2026" nebo "31. 1. 2026".
 * Pokud `period_end` neodpovídá konci deklarovaného období, vrací den -
 * je to poctivější než tvrdit měsíc, který tam není celý.
 */
export function formatPeriod(periodEnd: string, periodType?: string | null): string {
  const p = parts(periodEnd);
  if (!p) return periodEnd;

  if (periodType === "year") {
    return p.m === 12 && p.d === 31 ? String(p.y) : formatDay(p);
  }

  if (periodType === "quarter") {
    const isQuarterEnd = [3, 6, 9, 12].includes(p.m) && p.d === lastDayOfMonth(p.y, p.m);
    return isQuarterEnd ? `Q${Math.ceil(p.m / 3)} ${p.y}` : formatDay(p);
  }

  if (periodType === "month") {
    return p.d === lastDayOfMonth(p.y, p.m) ? `${MONTHS[p.m - 1]} ${p.y}` : formatDay(p);
  }

  return formatDay(p);
}

/** Kratší varianta do grafu, kde není místo: "1/26", "Q1/26", "2026". */
export function formatPeriodShort(periodEnd: string, periodType?: string | null): string {
  const p = parts(periodEnd);
  if (!p) return periodEnd;

  if (periodType === "year" && p.m === 12 && p.d === 31) return String(p.y);
  const yy = String(p.y).slice(2);

  if (periodType === "quarter") {
    const isQuarterEnd = [3, 6, 9, 12].includes(p.m) && p.d === lastDayOfMonth(p.y, p.m);
    if (isQuarterEnd) return `Q${Math.ceil(p.m / 3)}/${yy}`;
  }
  if (periodType === "month" && p.d === lastDayOfMonth(p.y, p.m)) {
    return `${p.m}/${yy}`;
  }
  return `${p.d}.${p.m}.`;
}
