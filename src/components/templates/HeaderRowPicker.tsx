"use client";

import { useState } from "react";
import type { ParsedFile } from "@/lib/parse-file";
import { MAX_HLEDANI } from "@/lib/header-row";

// ============================================================
// Potvrzení řádku s názvy sloupců.
//
// Stejný princip jako u návrhu sloupce s datem: aplikace odhad ukáže,
// uživatel ho potvrdí nebo přepíše. Nikdy se nepoužije mlčky.
//
// Místo pole na číslo řádku se ukazuje kus skutečného souboru a klikne
// se na správný řádek. U dvoupatrové hlavičky (sloučená buňka nad
// sloupci) je z náhledu na první pohled vidět, který řádek je ten
// správný - z čísla řádku by to nikdo neuhodl.
// ============================================================

const NAHLED_RADKU = 8;
const NAHLED_SLOUPCU = 8;

export function HeaderRowPicker({
  soubor,
  onZmena,
}: {
  soubor: ParsedFile;
  onZmena: (indexHlavicky: number) => void;
}) {
  const [otevreno, setOtevreno] = useState(false);

  const radky = soubor.matice.slice(0, Math.min(NAHLED_RADKU, MAX_HLEDANI));
  const sirka = Math.min(
    Math.max(...soubor.matice.map((r) => r.length), 1),
    NAHLED_SLOUPCU,
  );
  const orezano = Math.max(...soubor.matice.map((r) => r.length), 1) > sirka;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-black dark:text-zinc-100">
            Názvy sloupců beru z {soubor.indexHlavicky + 1}. řádku
          </p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {soubor.odhad.duvod}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOtevreno((o) => !o)}
          className="shrink-0 text-sm font-medium text-brand hover:underline"
        >
          {otevreno ? "Skrýt náhled" : "Je to jinak"}
        </button>
      </div>

      {otevreno && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Klikni na řádek, ve kterém jsou skutečné názvy sloupců.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {radky.map((radek, i) => {
                  const jeHlavicka = i === soubor.indexHlavicky;
                  return (
                    <tr
                      key={i}
                      onClick={() => onZmena(i)}
                      className={[
                        "cursor-pointer transition-colors",
                        jeHlavicka
                          ? "bg-brand/10 font-medium"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      <td className="border border-zinc-200 px-2 py-1 text-center text-zinc-400 tabular-nums dark:border-zinc-800">
                        {i + 1}
                      </td>
                      {Array.from({ length: sirka }, (_, j) => (
                        <td
                          key={j}
                          className="max-w-[10rem] truncate border border-zinc-200 px-2 py-1 dark:border-zinc-800"
                          title={radek[j] ?? ""}
                        >
                          {(radek[j] ?? "").trim() || (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                      ))}
                      {orezano && (
                        <td className="border border-zinc-200 px-2 py-1 text-zinc-400 dark:border-zinc-800">
                          …
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Řádky nad vybraným se přeskočí. Prázdné buňky v hlavičce dostanou
            náhradní název, stejné názvy se očíslují.
          </p>
        </div>
      )}
    </div>
  );
}
