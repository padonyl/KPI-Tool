"use client";

import type { NespocitaneObdobi } from "@/lib/formula";
import { formatPeriod } from "@/lib/format-period";

// ============================================================
// Upozornění na období, u kterých se KPI nepodařilo spočítat.
//
// PROČ EXISTUJE: dřív se taková období jen odfiltrovala. U šablony s
// jedním KPI to skončilo hláškou „žádná čitelná data", u šablony s víc
// KPI ale nahrání proběhlo jako ÚSPĚŠNÉ a jedno KPI potichu nemělo za
// období hodnotu — poznalo se to až podle díry v grafu za tři měsíce.
//
// Nahrání to nezastavuje. Ostatní KPI spočítaná jsou a zahodit je kvůli
// jednomu by bylo horší. Uživatel jen musí vědět, co nevyšlo a proč.
// ============================================================

export function NespocitanaObdobiNotice({
  nespocitane,
}: {
  nespocitane: NespocitaneObdobi[];
}) {
  if (nespocitane.length === 0) return null;

  // Seskupit po KPI — deset chybějících měsíců u jednoho ukazatele je
  // jeden problém, ne deset.
  const podleKpi = new Map<string, NespocitaneObdobi[]>();
  for (const n of nespocitane) {
    const seznam = podleKpi.get(n.kpiName) ?? [];
    seznam.push(n);
    podleKpi.set(n.kpiName, seznam);
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {nespocitane.length === 1
          ? "Jedno období se nepodařilo spočítat"
          : `${nespocitane.length} období se nepodařilo spočítat`}
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {[...podleKpi.entries()].map(([kpiName, polozky]) => {
          const chybejici = [...new Set(polozky.flatMap((p) => p.chybejiciSloupce))];
          const necitelne = [...new Set(polozky.flatMap((p) => p.necitelneSloupce))];
          const sloty = [...new Set(polozky.flatMap((p) => p.sloty))];

          return (
            <li key={kpiName} className="text-sm text-amber-900 dark:text-amber-200">
              <strong>{kpiName}</strong>{" "}
              <span className="text-amber-800 dark:text-amber-300">
                — {polozky
                  .slice(0, 4)
                  .map((p) => formatPeriod(p.periodEnd, p.periodType))
                  .join(", ")}
                {polozky.length > 4 && ` a ${polozky.length - 4} další`}
              </span>

              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Nepodařilo se naplnit: {sloty.join(", ")}.
              </p>

              {chybejici.length > 0 && (
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  <strong>V souboru chybí sloupec:</strong> {chybejici.join(", ")}.
                  Nejspíš se ve zdroji přejmenoval, nebo se vzaly názvy ze
                  špatného řádku.
                </p>
              )}

              {necitelne.length > 0 && (
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  <strong>Sloupec neobsahuje čísla:</strong> {necitelne.join(", ")}.
                  Buď je textový, nebo je za dané období prázdný.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
        Ostatní hodnoty se uložily normálně. Tahle období zůstanou prázdná,
        dokud se soubor nenahraje znovu s opraveným mapováním.
      </p>
    </div>
  );
}
