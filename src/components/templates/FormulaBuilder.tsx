"use client";

import { useMemo, useState } from "react";
import {
  tokenizeExpression,
  evaluateFormulaByPeriod,
  evaluateSlot,
  type FormulaSpec,
  type FormulaConfig,
  type SlotDefinition,
} from "@/lib/formula";
import type { ParsedRow } from "@/lib/template-rules";
import { SELECT_INPUT_SM } from "@/lib/ui-classes";

type Props = {
  spec: FormulaSpec;
  headers: string[];
  rows: ParsedRow[];
  dateColumn: string | null;
  periodType: string;
  unit: string;
  config: FormulaConfig;
  onConfigChange: (config: FormulaConfig) => void;
};

const AGG_OPTIONS: { value: SlotDefinition["aggregation"]; label: string }[] = [
  { value: "sum", label: "Sečíst přes řádky" },
  { value: "avg", label: "Zprůměrovat přes řádky" },
  { value: "count", label: "Spočítat počet řádků" },
];

function emptySlot(): SlotDefinition {
  return { terms: [], aggregation: "sum" };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

export function FormulaBuilder({
  spec,
  headers,
  rows,
  dateColumn,
  periodType,
  unit,
  config,
  onConfigChange,
}: Props) {
  const [activeSlotKey, setActiveSlotKey] = useState<string>(spec.slots[0]?.key ?? "");

  const tokens = useMemo(() => {
    try {
      return tokenizeExpression(spec.expression);
    } catch {
      return [];
    }
  }, [spec.expression]);

  const periods = useMemo(
    () => evaluateFormulaByPeriod(rows, dateColumn, periodType, spec, config),
    [rows, dateColumn, periodType, spec, config],
  );

  const activeSlotSpec = spec.slots.find((s) => s.key === activeSlotKey);
  const activeSlot = config.slots[activeSlotKey] ?? emptySlot();

  // Náhled slotu přes VŠECHNY řádky souboru (ne po obdobích) - rychlá
  // kontrola "sedí to vůbec", než se uživatel dívá na rozpad po měsících.
  const activeSlotPreview = useMemo(() => {
    if (activeSlot.terms.length === 0) return null;
    return evaluateSlot(rows, activeSlot);
  }, [rows, activeSlot]);

  function updateSlot(key: string, next: SlotDefinition) {
    onConfigChange({ ...config, slots: { ...config.slots, [key]: next } });
  }

  function addTerm(column: string) {
    if (!column) return;
    updateSlot(activeSlotKey, {
      ...activeSlot,
      terms: [...activeSlot.terms, { column, op: "+" }],
    });
  }

  function removeTerm(index: number) {
    updateSlot(activeSlotKey, {
      ...activeSlot,
      terms: activeSlot.terms.filter((_, i) => i !== index),
    });
  }

  function toggleTermOp(index: number) {
    updateSlot(activeSlotKey, {
      ...activeSlot,
      terms: activeSlot.terms.map((t, i) =>
        i === index ? { ...t, op: t.op === "+" ? "-" : "+" } : t,
      ),
    });
  }

  const distinctFilterValues = useMemo(() => {
    if (!activeSlot.filter?.column) return [];
    return [
      ...new Set(
        rows.map((r) => (r[activeSlot.filter!.column] ?? "").trim()).filter(Boolean),
      ),
    ].slice(0, 200);
  }, [rows, activeSlot.filter]);

  const filledCount = spec.slots.filter(
    (s) => (config.slots[s.key]?.terms.length ?? 0) > 0,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Vzorec jako klikací objekty ---------- */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Vzorec KPI — klikni na políčko a řekni, kde tu hodnotu vzít
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 font-mono text-sm">
          {tokens.map((token, i) => {
            if (token.kind === "slot") {
              const slotSpec = spec.slots.find((s) => s.key === token.key);
              const definition = config.slots[token.key];
              const isFilled = (definition?.terms.length ?? 0) > 0;
              const isActive = token.key === activeSlotKey;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSlotKey(token.key)}
                  className={[
                    "rounded-md border-2 px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-brand bg-brand/10"
                      : isFilled
                        ? "border-emerald-400 bg-emerald-50 hover:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/40"
                        : "border-dashed border-zinc-400 bg-white hover:border-brand dark:border-zinc-600 dark:bg-zinc-900",
                  ].join(" ")}
                >
                  <span className="block font-sans text-xs font-medium text-brand-ink dark:text-zinc-100">
                    {slotSpec?.label ?? token.key}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {isFilled
                      ? `${definition!.terms.length} ${definition!.terms.length === 1 ? "sloupec" : "sloupce/ů"}`
                      : "nevyplněno"}
                  </span>
                </button>
              );
            }

            const text =
              token.kind === "op"
                ? token.value === "*"
                  ? "×"
                  : token.value === "/"
                    ? "÷"
                    : token.value === "-"
                      ? "−"
                      : "+"
                : token.kind === "num"
                  ? String(token.value)
                  : token.kind === "lparen"
                    ? "("
                    : ")";

            return (
              <span
                key={i}
                className={
                  token.kind === "op"
                    ? "text-lg text-zinc-500"
                    : "text-lg text-zinc-400"
                }
              >
                {text}
              </span>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Vyplněno {filledCount} z {spec.slots.length} políček. Strukturu vzorce
          určuje aplikace — ty říkáš jen, čím se která část naplní z tvého souboru.
        </p>
      </div>

      {/* ---------- Editor vybraného slotu ---------- */}
      {activeSlotSpec && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-brand-ink dark:text-zinc-100">
            {activeSlotSpec.label}
          </h3>
          {activeSlotSpec.hint && (
            <p className="mt-1 mb-4 text-xs leading-5 text-zinc-500">{activeSlotSpec.hint}</p>
          )}

          {/* Sloupce, ze kterých se slot skládá */}
          <div className="flex flex-col gap-2">
            {activeSlot.terms.length === 0 && (
              <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Zatím žádný sloupec. Přidej níže ten, který tuhle hodnotu obsahuje —
                a pokud je rozdělená do víc sloupců, přidej je všechny.
              </p>
            )}

            {activeSlot.terms.map((term, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleTermOp(i)}
                  title="Přepnout mezi přičíst a odečíst"
                  className={[
                    "h-8 w-8 shrink-0 rounded-md border text-base font-semibold transition-colors",
                    term.op === "+"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
                  ].join(" ")}
                >
                  {term.op === "+" ? "+" : "−"}
                </button>
                <div className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                  {term.column}
                </div>
                <button
                  type="button"
                  onClick={() => removeTerm(i)}
                  className="shrink-0 px-2 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  odebrat
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <select
              value=""
              onChange={(e) => addTerm(e.target.value)}
              className={`w-full ${SELECT_INPUT_SM}`}
            >
              <option value="">+ přidat sloupec…</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Filtr řádků a agregace */}
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Jak spojit hodnoty přes řádky
              <select
                value={activeSlot.aggregation}
                onChange={(e) =>
                  updateSlot(activeSlotKey, {
                    ...activeSlot,
                    aggregation: e.target.value as SlotDefinition["aggregation"],
                  })
                }
                className={SELECT_INPUT_SM}
              >
                {AGG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={!!activeSlot.filter}
                onChange={(e) =>
                  updateSlot(activeSlotKey, {
                    ...activeSlot,
                    filter: e.target.checked ? { column: "", value: "" } : undefined,
                  })
                }
                className="accent-brand"
              />
              Použít jen některé řádky (např. jen řádky typu „prodej“)
            </label>

            {activeSlot.filter && (
              <div className="flex flex-col gap-2 pl-6 sm:flex-row">
                <select
                  value={activeSlot.filter.column}
                  onChange={(e) =>
                    updateSlot(activeSlotKey, {
                      ...activeSlot,
                      filter: { column: e.target.value, value: "" },
                    })
                  }
                  className={`flex-1 ${SELECT_INPUT_SM}`}
                >
                  <option value="">— sloupec —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <select
                  value={activeSlot.filter.value}
                  onChange={(e) =>
                    updateSlot(activeSlotKey, {
                      ...activeSlot,
                      filter: { column: activeSlot.filter!.column, value: e.target.value },
                    })
                  }
                  disabled={!activeSlot.filter.column}
                  className={`flex-1 ${SELECT_INPUT_SM} disabled:opacity-50`}
                >
                  <option value="">— hodnota —</option>
                  {distinctFilterValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeSlotPreview !== null && (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Z celého souboru by tenhle slot vyšel na{" "}
              <span className="font-mono font-semibold text-brand-ink dark:text-zinc-100">
                {formatNumber(activeSlotPreview)}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ---------- Náhled výsledku ---------- */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Náhled — co by se uložilo
        </p>

        {periods.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Ze souboru se zatím nedá spočítat žádné období.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Období</th>
                  {spec.slots.map((s) => (
                    <th key={s.key} className="py-2 pr-3 font-medium">
                      {s.label}
                    </th>
                  ))}
                  <th className="py-2 font-medium text-brand">Výsledek</th>
                </tr>
              </thead>
              <tbody>
                {periods.slice(0, 12).map((p) => (
                  <tr
                    key={p.periodEnd}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-3 font-mono">{p.periodEnd}</td>
                    {spec.slots.map((s) => (
                      <td key={s.key} className="py-2 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {p.slotValues[s.key] !== undefined
                          ? formatNumber(p.slotValues[s.key])
                          : "—"}
                      </td>
                    ))}
                    <td className="py-2 font-mono font-semibold text-brand-ink dark:text-zinc-100">
                      {p.value !== null ? `${formatNumber(p.value)} ${unit}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {periods.length > 12 && (
              <p className="mt-2 text-[11px] text-zinc-400">
                …a dalších {periods.length - 12} období
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
