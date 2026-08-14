"use client";

import { useMemo, useState } from "react";
import {
  tokenizeExpression,
  evaluateFormulaByPeriod,
  evaluateSlot,
  validateSlotTokens,
  slotTokens,
  formatKpiFormula,
  type FormulaSpec,
  type FormulaConfig,
  type SlotDefinition,
  type SlotToken,
} from "@/lib/formula";
import type { ParsedRow } from "@/lib/template-rules";
import { formatPeriod } from "@/lib/format-period";
import { FormulaCanvas } from "@/components/templates/FormulaCanvas";
import { SELECT_INPUT_SM } from "@/lib/ui-classes";
import { formatNumber } from "@/lib/format-number";

type Props = {
  spec: FormulaSpec;
  kpiName: string;
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
  return { tokens: [], aggregation: "sum" };
}

export function FormulaBuilder({
  spec,
  kpiName,
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
  const activeTokens = slotTokens(activeSlot);
  const activeError = validateSlotTokens(activeTokens);

  // Náhled slotu přes VŠECHNY řádky souboru (ne po obdobích) - rychlá
  // kontrola „sedí to vůbec“, než se uživatel dívá na rozpad po měsících.
  const activeSlotPreview = useMemo(() => {
    if (activeTokens.length === 0 || activeError) return null;
    return evaluateSlot(rows, activeSlot);
  }, [rows, activeSlot, activeTokens.length, activeError]);

  function updateSlot(key: string, next: SlotDefinition) {
    onConfigChange({ ...config, slots: { ...config.slots, [key]: next } });
  }

  function setActiveTokens(next: SlotToken[]) {
    // Starší tvar `terms` se při první úpravě zahodí - od téhle chvíle
    // je zdrojem pravdy výraz z plátna.
    updateSlot(activeSlotKey, {
      ...activeSlot,
      terms: undefined,
      tokens: next,
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

  const filledCount = spec.slots.filter((s) => {
    const definition = config.slots[s.key];
    return definition && slotTokens(definition).length > 0;
  }).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Vzorec KPI jako klikací objekty ---------- */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Vzorec KPI
        </p>

        {/* Pevný vzorec, ze kterého KPI vychází - jen ke čtení, needituje se.
            U jednoslotových KPI (Stav zásob) je to jediné místo, kde je vůbec
            vidět, že nějaký vzorec existuje. */}
        <div className="mb-4 rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm leading-6 text-brand-ink dark:text-zinc-100">
            <span className="font-semibold">{kpiName}</span>
            <span className="mx-2 text-zinc-400">=</span>
            <span className="font-medium">{formatKpiFormula(spec)}</span>
            {unit && <span className="ml-2 text-xs text-zinc-500">[{unit}]</span>}
          </p>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Tenhle vzorec je pevně daný aplikací a nemění se — určuje, co KPI
            znamená. Ty říkáš jen, čím se naplní jeho jednotlivé části.
          </p>
        </div>

        <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Klikni na políčko a slož, odkud se ta hodnota vezme
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 font-mono text-sm">
          {tokens.map((token, i) => {
            if (token.kind === "slot") {
              const slotSpec = spec.slots.find((s) => s.key === token.key);
              const definition = config.slots[token.key];
              const count = definition ? slotTokens(definition).length : 0;
              const isFilled = count > 0;
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
                    {isFilled ? "vyplněno" : "nevyplněno"}
                  </span>
                </button>
              );
            }

            const text =
              token.kind === "op"
                ? { "+": "+", "-": "−", "*": "×", "/": "÷" }[token.value]
                : token.kind === "num"
                  ? String(token.value)
                  : token.kind === "lparen"
                    ? "("
                    : ")";

            return (
              <span
                key={i}
                className={token.kind === "op" ? "text-lg text-zinc-500" : "text-lg text-zinc-400"}
              >
                {text}
              </span>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Vyplněno {filledCount} z {spec.slots.length} políček. Strukturu vzorce určuje
          aplikace — ty říkáš jen, čím se která část naplní z tvého souboru.
        </p>
      </div>

      {/* ---------- Plátno pro vybraný slot ---------- */}
      {activeSlotSpec && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-brand-ink dark:text-zinc-100">
            {activeSlotSpec.label}
          </h3>
          {activeSlotSpec.hint && (
            <p className="mt-1 mb-4 text-xs leading-5 text-zinc-500">{activeSlotSpec.hint}</p>
          )}

          <FormulaCanvas
            tokens={activeTokens}
            columns={headers}
            onChange={setActiveTokens}
            error={activeError}
            previewValue={activeSlotPreview}
          />

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
                    <td className="py-2 pr-3">{formatPeriod(p.periodEnd, p.periodType)}</td>
                    {spec.slots.map((s) => (
                      <td
                        key={s.key}
                        className="py-2 pr-3 font-mono text-zinc-600 dark:text-zinc-400"
                      >
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
