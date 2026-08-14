// ------------------------------------------------------------
// Seskupení KPI podle oblasti (Finance, Zákazníci, Lidé a růst...).
//
// Od migrace 0008 je v katalogu přes 30 KPI - plochý seznam se
// neprochází. Oblast se ukládá rovnou v podobě, v jaké se zobrazuje
// (velkým písmenem), takže tady se nic nepřekládá; jen se drží
// pořadí, ať nabídka nevypadá pokaždé jinak.
// ------------------------------------------------------------

/** Pořadí oblastí podle Balanced Scorecard, viz kpi_katalog.md. */
const ORDER = [
  "Finance",
  "Zákazníci",
  "Interní procesy",
  "Lidé a růst",
  "Kvalita",
  "Logistika",
  "Výroba",
];

function rank(category: string): number {
  const i = ORDER.indexOf(category);
  // Neznámá oblast (přidaná v DB bez úpravy kódu) jde na konec, ne pryč.
  return i === -1 ? ORDER.length : i;
}

export function groupByCategory<T extends { category: string }>(
  items: T[],
): [string, T[]][] {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return [...byCategory.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "cs"),
  );
}
