// Jednotné formátování čísel napříč aplikací.
//
// Bez oddělovače tisíců jsou provozní čísla prakticky nečitelná - "2920208"
// se od "292028" na první pohled nerozezná. České locale zároveň řeší
// desetinnou čárku místo tečky, takže se tím spraví i "31.74" -> "31,74".
//
// Oddělovačem je pevná mezera (U+00A0), takže se číslo nikdy nezalomí
// uprostřed.

const FORMATTER = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });

/** "2 920 208", "31,74", "-4 500" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return FORMATTER.format(value);
}

/** Číslo i s jednotkou: "2 920 208 Kč", "31,74 %". */
export function formatValue(value: number, unit?: string | null): string {
  const formatted = formatNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}
