"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type KpiDefinition = { id: string; name: string; unit: string };

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
  min: "aspoň (min)",
  max: "nejvýš (max)",
  between: "v rozmezí (between)",
  outside: "mimo rozmezí (outside)",
};

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

  function loadKpi(kpiId: string) {
    setSelectedKpiId(kpiId);
    const existing = targets[kpiId];
    setEvalType(existing?.evaluation_type ?? "min");
    setMinValue(existing?.min_value?.toString() ?? "");
    setMaxValue(existing?.max_value?.toString() ?? "");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const needsMin = evalType === "min" || evalType === "between" || evalType === "outside";
    const needsMax = evalType === "max" || evalType === "between" || evalType === "outside";

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("kpi_targets").upsert(
      {
        company_id: companyId,
        kpi_definition_id: selectedKpiId,
        evaluation_type: evalType,
        min_value: needsMin && minValue !== "" ? Number(minValue) : null,
        max_value: needsMax && maxValue !== "" ? Number(maxValue) : null,
      },
      { onConflict: "company_id,kpi_definition_id" },
    );

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setTargets((prev) => ({
      ...prev,
      [selectedKpiId]: {
        kpi_definition_id: selectedKpiId,
        evaluation_type: evalType,
        min_value: needsMin && minValue !== "" ? Number(minValue) : null,
        max_value: needsMax && maxValue !== "" ? Number(maxValue) : null,
      },
    }));
  }

  const needsMin = evalType === "min" || evalType === "between" || evalType === "outside";
  const needsMax = evalType === "max" || evalType === "between" || evalType === "outside";

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          KPI
          <select
            value={selectedKpiId}
            onChange={(e) => loadKpi(e.target.value)}
            className="w-56 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {kpiDefinitions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Typ vyhodnocení
          <select
            value={evalType}
            onChange={(e) => setEvalType(e.target.value)}
            className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.entries(EVAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {needsMin && (
          <label className="flex flex-col gap-1 text-sm">
            Min
            <input
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
        {needsMax && (
          <label className="flex flex-col gap-1 text-sm">
            Max
            <input
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {saving ? "Ukládám…" : "Uložit cíl"}
      </button>

      {Object.keys(targets).length > 0 && (
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="mb-2 text-xs text-zinc-400">Nastavené cíle:</p>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.values(targets).map((t) => {
              const kpi = kpiDefinitions.find((k) => k.id === t.kpi_definition_id);
              return (
                <li key={t.kpi_definition_id} className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {kpi?.name ?? "?"}
                  </span>{" "}
                  — {EVAL_LABELS[t.evaluation_type]}
                  {t.min_value != null ? ` min=${t.min_value}` : ""}
                  {t.max_value != null ? ` max=${t.max_value}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
