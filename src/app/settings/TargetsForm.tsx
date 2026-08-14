"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NumberInput } from "@/components/forms/NumberInput";
import { formatNumber } from "@/lib/format-number";
import { parseNumber } from "@/lib/parse-values";
import { PRIMARY_BUTTON, SELECT_INPUT } from "@/lib/ui-classes";
import { settingBlocksFor } from "@/lib/kpi-settings";
import Link from "next/link";

type KpiDefinition = { id: string; name: string; unit: string; is_derived: boolean };

type Target = {
  kpi_definition_id: string;
  evaluation_type: string;
  min_value: number | null;
  max_value: number | null;
};

type Props = {
  companyId: string;
  kpiDefinitions: KpiDefinition[];
  targets: Target[];
};

const EVAL_LABELS: Record<string, string> = {
  min: "minimálně",
  max: "maximálně",
  between: "v rozmezí",
  outside: "mimo rozmezí",
};

/** Lidský popis cíle do přehledu, i s jednotkou. */
function describeTarget(target: Target, unit: string): string {
  const min = target.min_value != null ? `${formatNumber(target.min_value)} ${unit}` : null;
  const max = target.max_value != null ? `${formatNumber(target.max_value)} ${unit}` : null;

  if (target.evaluation_type === "min") return `minimálně ${min}`;
  if (target.evaluation_type === "max") return `maximálně ${max}`;
  if (target.evaluation_type === "between") return `mezi ${min} a ${max}`;
  return `mimo rozmezí ${min} až ${max}`;
}

export function TargetsForm({ companyId, kpiDefinitions, targets: initialTargets }: Props) {
  const [targets, setTargets] = useState<Record<string, Target>>(
    Object.fromEntries(initialTargets.map((t) => [t.kpi_definition_id, t])),
  );
  const [selectedKpiId, setSelectedKpiId] = useState(kpiDefinitions[0]?.id ?? "");
  const [evalType, setEvalType] = useState("min");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Potvrzení uložení - bez něj uživatel neví, jestli se něco stalo. */
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const selectedKpi = kpiDefinitions.find((k) => k.id === selectedKpiId);

  function loadKpi(kpiId: string) {
    setSelectedKpiId(kpiId);
    const existing = targets[kpiId];
    setEvalType(existing?.evaluation_type ?? "min");
    setMinValue(existing?.min_value?.toString() ?? "");
    setMaxValue(existing?.max_value?.toString() ?? "");
    setError(null);
    setSavedNote(null);
  }

  const needsMin = evalType === "min" || evalType === "between" || evalType === "outside";
  const needsMax = evalType === "max" || evalType === "between" || evalType === "outside";

  async function handleSave() {
    const min = parseNumber(minValue);
    const max = parseNumber(maxValue);

    if (needsMin && min === null) {
      setError("Vyplň hodnotu Min.");
      return;
    }
    if (needsMax && max === null) {
      setError("Vyplň hodnotu Max.");
      return;
    }
    if (needsMin && needsMax && min !== null && max !== null && min > max) {
      setError("Min nemůže být větší než Max.");
      return;
    }

    setSaving(true);
    setError(null);
    setSavedNote(null);

    const row = {
      company_id: companyId,
      kpi_definition_id: selectedKpiId,
      evaluation_type: evalType,
      min_value: needsMin ? min : null,
      max_value: needsMax ? max : null,
    };

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("kpi_targets")
      .upsert(row, { onConflict: "company_id,kpi_definition_id" });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    const saved: Target = {
      kpi_definition_id: selectedKpiId,
      evaluation_type: evalType,
      min_value: row.min_value,
      max_value: row.max_value,
    };
    setTargets((prev) => ({ ...prev, [selectedKpiId]: saved }));
    setSavedNote(
      `Cíl pro „${selectedKpi?.name ?? "KPI"}“ uložen: ${describeTarget(saved, selectedKpi?.unit ?? "")}.`,
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          KPI
          <select
            value={selectedKpiId}
            onChange={(e) => loadKpi(e.target.value)}
            className={SELECT_INPUT}
          >
            {kpiDefinitions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.unit})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Typ vyhodnocení
          <select
            value={evalType}
            onChange={(e) => {
              setEvalType(e.target.value);
              setError(null);
              setSavedNote(null);
            }}
            className={SELECT_INPUT}
          >
            {Object.entries(EVAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Bloky nastavení podle vybraného KPI - viz kpi-settings.ts */}
      {selectedKpi && settingBlocksFor(selectedKpi).includes("tolerance-in-template") && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Tolerance se u tohohle KPI nastavuje v šabloně
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            „{selectedKpi.name}“ se počítá z řádkových dat a tolerance (kolik dní
            zpoždění a jaké minimální množství se ještě počítá jako splněné) můžou
            být pro každý zdroj jiné — proto patří k šabloně, ne sem.{" "}
            <Link href="/templates" className="text-brand hover:underline">
              Otevřít šablony
            </Link>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        {needsMin && (
          <label className="flex flex-col gap-1 text-sm">
            Min
            <NumberInput
              value={minValue}
              onChange={setMinValue}
              unit={selectedKpi?.unit}
              placeholder="0"
            />
          </label>
        )}
        {needsMax && (
          <label className="flex flex-col gap-1 text-sm">
            Max
            <NumberInput
              value={maxValue}
              onChange={setMaxValue}
              unit={selectedKpi?.unit}
              placeholder="0"
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleSave} disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? "Ukládám…" : "Uložit cíl"}
        </button>
        {savedNote && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <span aria-hidden="true">✓</span>
            {savedNote}
          </span>
        )}
      </div>

      {Object.keys(targets).length > 0 && (
        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Nastavené cíle
          </p>
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {Object.values(targets).map((t) => {
              const kpi = kpiDefinitions.find((k) => k.id === t.kpi_definition_id);
              return (
                <li
                  key={t.kpi_definition_id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <button
                    onClick={() => loadKpi(t.kpi_definition_id)}
                    className="font-medium text-zinc-900 hover:text-brand hover:underline dark:text-zinc-100"
                  >
                    {kpi?.name ?? "?"}
                  </button>
                  <span className="font-mono text-zinc-600 tabular-nums dark:text-zinc-400">
                    {describeTarget(t, kpi?.unit ?? "")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
