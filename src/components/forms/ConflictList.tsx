"use client";

import { useState } from "react";
import type { Conflict } from "@/lib/kpi-value-writer";
import {
  openConflictsReport,
  CONFLICT_PREVIEW_LIMIT,
} from "@/lib/conflicts-report";
import { formatPeriod } from "@/lib/format-period";
import { formatNumber } from "@/lib/format-number";

// Při pár změnách se vypíšou rovnou. Při větším počtu je seznam v dialogu
// jen zeď čísel - ukáže se proto souhrn a nabídka otevřít detail v nové
// záložce, kde je vidět i rozdíl a procentní změna.

export function ConflictList({
  conflicts,
  sourceName,
}: {
  conflicts: Conflict[];
  sourceName: string;
}) {
  const [popupBlocked, setPopupBlocked] = useState(false);

  const isLong = conflicts.length > CONFLICT_PREVIEW_LIMIT;
  const shown = isLong ? conflicts.slice(0, CONFLICT_PREVIEW_LIMIT) : conflicts;

  return (
    <div className="flex flex-col gap-3">
      {isLong && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Přepsalo by se{" "}
            <strong className="text-brand-ink dark:text-zinc-100">
              {formatNumber(conflicts.length)} hodnot
            </strong>{" "}
            napříč obdobími.
          </p>
          <button
            type="button"
            onClick={() => setPopupBlocked(!openConflictsReport(conflicts, sourceName))}
            className="shrink-0 text-sm font-medium text-brand hover:underline"
          >
            Prozkoumat detail →
          </button>
        </div>
      )}

      {popupBlocked && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Prohlížeč zablokoval otevření nové záložky. Povol vyskakovací okna pro
          tuhle stránku a zkus to znovu.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {shown.map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <span className="font-medium">{c.kpiName}</span>
              <span className="ml-2 text-zinc-500">
                {formatPeriod(c.periodEnd, c.periodType)}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
              <span className="text-zinc-500 line-through">{formatNumber(c.oldValue)}</span>
              <span aria-hidden="true">→</span>
              <span className="font-semibold">{formatNumber(c.newValue)}</span>
            </div>
          </li>
        ))}
      </ul>

      {isLong && (
        <p className="text-xs text-zinc-500">
          Zobrazeno prvních {CONFLICT_PREVIEW_LIMIT} z{" "}
          {formatNumber(conflicts.length)} — zbytek najdeš v detailu.
        </p>
      )}
    </div>
  );
}
