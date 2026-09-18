import type { ParsedRow } from "@/lib/template-rules";
import {
  tokenizeExpression,
  toRpn,
  evaluateRpn,
  evaluateSlot,
  isSystemSlot,
  daysInPeriod,
  type FormulaSpec,
  type FormulaConfig,
} from "@/lib/formula";

export type VzorecKpi = { spec: FormulaSpec; config: FormulaConfig };

/**
 * Spočítá KPI podle jeho vlastního vzorce nad libovolnou sadou řádků.
 *
 * PROČ to existuje: poměrové KPI (marže, podíl, OEE) NEJDE získat součtem
 * ani průměrem jednoho sloupce. Marže po produktu se musí spočítat
 * z agregátů dané skupiny — sečíst tržby a náklady zvlášť a teprve pak
 * podělit. Průměr marží po řádcích dá jiné (a špatné) číslo, protože
 * ignoruje váhu jednotlivých obchodů.
 *
 * Rozpad do detailu tuhle funkci používá pro každou skupinu zvlášť, takže
 * se v tabulce objeví TÉŽ KPI, jaké je nahoře na stránce — jen rozpadlé.
 *
 * Vrací null, když skupině chybí data pro některý slot. Nepočítá se naslepo:
 * poctivější je říct „nelze spočítat" než ukázat nulu.
 */
export function hodnotaKpiProRadky(
  radky: ParsedRow[],
  vzorec: VzorecKpi,
  perioda: { periodEnd: string; periodType: string },
): number | null {
  try {
    const rpn = toRpn(tokenizeExpression(vzorec.spec.expression));
    const hodnoty: Record<string, number> = {};

    // Systémové sloty (např. počet dní v období) se neberou z dat.
    const dny = daysInPeriod(perioda.periodEnd, perioda.periodType);
    if (dny !== null) hodnoty.days_in_period = dny;

    for (const slot of vzorec.spec.slots ?? []) {
      if (isSystemSlot(slot.key)) continue;
      const definice = vzorec.config.slots?.[slot.key];
      if (!definice) return null;
      const v = evaluateSlot(radky, definice);
      if (v === null) return null;
      hodnoty[slot.key] = v;
    }

    return evaluateRpn(rpn, hodnoty);
  } catch {
    return null;
  }
}
