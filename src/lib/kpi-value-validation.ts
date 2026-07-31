// Lehká klientská validace rozsahu KPI hodnot (2026-07-26, po QA testu).
//
// POZOR: tohle NENÍ bezpečnostní hranice. Dá se obejít přímým voláním API
// mimo appku - proti tomu chrání až budoucí DB-level kontrola (trigger
// vázaný na typ KPI, viz nápadník). Tady jde jen o to chytit zjevný
// překlep poctivého uživatele v UI (např. zmetkovitost -50 % nebo 500 %),
// ať se do grafů nedostane nesmysl.

export type ValueProblem = {
  kpiName: string;
  periodEnd: string;
  value: number;
  reason: string;
};

// KPI, jejichž jednotka je procenta, dávají smysl jen v rozsahu 0-100.
export function isPercentUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const u = unit.trim().toLowerCase();
  return u === "%" || u === "percent" || u === "procenta" || u === "procent";
}

// Vrátí důvod, proč je hodnota podezřelá, nebo null když je v pořádku.
export function checkKpiValue(
  value: number,
  unit: string | null | undefined,
): string | null {
  if (!Number.isFinite(value)) return "hodnota není platné číslo";
  if (isPercentUnit(unit) && (value < 0 || value > 100)) {
    return "procentuální hodnota musí být mezi 0 a 100";
  }
  return null;
}
