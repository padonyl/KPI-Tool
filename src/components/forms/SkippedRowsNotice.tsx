"use client";

import { useState } from "react";
import { totalSkipped, type SkippedRows } from "@/lib/run-upload";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/lib/ui-classes";
import { formatNumber } from "@/lib/format-number";

// Vyřazené řádky nesmí mizet potichu: chybí v součtu a ředí průměr, takže
// posouvají výsledek celého KPI. O tom, jestli je přeskočit, rozhoduje
// uživatel - aplikace to za něj neudělá mlčky.
//
// U většího počtu (viz THRESHOLD) se navíc vyžaduje výslovné potvrzení -
// pár rozbitých řádků je běžný šum, desítky znamenají špatný podklad.

const THRESHOLD = 10;

type Props = {
  skipped: SkippedRows;
  onContinue: () => void;
  onCancel: () => void;
};

export function SkippedRowsNotice({ skipped, onContinue, onCancel }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  const count = totalSkipped(skipped);
  const share = skipped.totalRows > 0 ? (count / skipped.totalRows) * 100 : 0;
  const needsAcknowledgement = count > THRESHOLD;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950">
      <div>
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {count === 1
            ? "Jeden řádek se nepodařilo přečíst"
            : `Nepodařilo se přečíst ${formatNumber(count)} řádků`}
          <span className="font-normal">
            {" "}
            z {formatNumber(skipped.totalRows)} ({share.toFixed(share < 1 ? 1 : 0)} %)
          </span>
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
          Tyhle řádky se do výpočtu nezapočítají — chybí v součtech a ovlivní
          i průměry, takže výsledná čísla budou o ně nižší.
        </p>
      </div>

      <ul className="flex flex-col gap-1 text-sm text-amber-800 dark:text-amber-300">
        {skipped.unreadableDate > 0 && (
          <li>
            <strong>{formatNumber(skipped.unreadableDate)}</strong> ×
            nečitelné datum — nedá se určit, do jakého období řádek patří
          </li>
        )}
        {skipped.incompleteDelivery > 0 && (
          <li>
            <strong>{formatNumber(skipped.incompleteDelivery)}</strong> ×
            neúplná dodávka — chybí termín nebo množství
          </li>
        )}
      </ul>

      {skipped.examples.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Například:{" "}
          <span className="font-mono">{skipped.examples.join("  ·  ")}</span>
        </p>
      )}

      {needsAcknowledgement && (
        <label className="flex items-start gap-2 rounded-md bg-amber-100/70 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-amber-600"
          />
          <span>
            Beru na vědomí, že se tyhle řádky vynechají, a podklad jsem
            zkontroloval.
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onContinue}
          disabled={needsAcknowledgement && !acknowledged}
          className={`${PRIMARY_BUTTON} disabled:cursor-not-allowed`}
        >
          Pokračovat bez nich
        </button>
        <button onClick={onCancel} className={SECONDARY_BUTTON}>
          Zrušit a opravit soubor
        </button>
      </div>
    </div>
  );
}
