import { parseDateValue } from "@/lib/parse-values";
import type { ParsedRow } from "@/lib/template-rules";

// Rozpoznání, které sloupce vypadají jako datum.
//
// Bez toho musel uživatel hledat datum v seznamu všech sloupců souboru
// (u skladového reportu klidně mezi patnácti) a vybíral naslepo, protože
// neviděl, co v tom sloupci vlastně je.

export type ColumnSample = {
  name: string;
  /** Podíl neprázdných hodnot, které jdou přečíst jako datum (0-1). */
  dateRatio: number;
  /** Vypadá to na sloupec s datem? */
  looksLikeDate: boolean;
  /** Pár skutečných hodnot ze souboru, ať uživatel vidí, o co jde. */
  examples: string[];
};

/** Kolik řádků stačí prohlédnout - u velkého souboru nemá smysl číst vše. */
const SAMPLE_SIZE = 50;

export function describeColumns(headers: string[], rows: ParsedRow[]): ColumnSample[] {
  const sample = rows.slice(0, SAMPLE_SIZE);

  return headers.map((name) => {
    const values = sample
      .map((row) => (row[name] ?? "").trim())
      .filter((value) => value !== "");

    const parsedCount = values.filter((value) => parseDateValue(value) !== null).length;
    const dateRatio = values.length > 0 ? parsedCount / values.length : 0;

    return {
      name,
      dateRatio,
      // Prahová hodnota, ne jistota: pár rozbitých řádků nemá sloupec
      // diskvalifikovat, ale sloupec s čísly nemá projít jen náhodou.
      looksLikeDate: values.length > 0 && dateRatio >= 0.8,
      examples: [...new Set(values)].slice(0, 3),
    };
  });
}
