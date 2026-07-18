"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Direction = "inbound" | "outbound";

type Tolerance = {
  direction: string;
  on_time_tolerance_days: number;
  in_full_tolerance_pct: number;
};

type Props = {
  companyId: string;
  tolerances: Tolerance[];
};

const DIRECTION_LABELS: Record<Direction, string> = {
  outbound: "OTIF zákazníkům",
  inbound: "OTIF dodavatelů",
};

const DEFAULTS = { on_time_tolerance_days: 0, in_full_tolerance_pct: 100 };

export function ToleranceForm({ companyId, tolerances }: Props) {
  const initial: Record<Direction, { on_time_tolerance_days: number; in_full_tolerance_pct: number }> = {
    outbound:
      tolerances.find((t) => t.direction === "outbound") ?? { ...DEFAULTS },
    inbound:
      tolerances.find((t) => t.direction === "inbound") ?? { ...DEFAULTS },
  };

  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(
    direction: Direction,
    field: "on_time_tolerance_days" | "in_full_tolerance_pct",
    value: number,
  ) {
    setValues((prev) => ({
      ...prev,
      [direction]: { ...prev[direction], [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("delivery_tolerances")
      .upsert(
        (Object.keys(values) as Direction[]).map((direction) => ({
          company_id: companyId,
          direction,
          on_time_tolerance_days: values[direction].on_time_tolerance_days,
          in_full_tolerance_pct: values[direction].in_full_tolerance_pct,
        })),
        { onConflict: "company_id,direction" },
      );

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSavedAt(Date.now());
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {(Object.keys(DIRECTION_LABELS) as Direction[]).map((direction) => (
        <div key={direction} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{DIRECTION_LABELS[direction]}</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Tolerance na termín (dny, oběma směry)
              <input
                type="number"
                min={0}
                value={values[direction].on_time_tolerance_days}
                onChange={(e) =>
                  update(direction, "on_time_tolerance_days", Number(e.target.value))
                }
                className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Min. % objednaného množství
              <input
                type="number"
                min={0}
                max={100}
                value={values[direction].in_full_tolerance_pct}
                onChange={(e) =>
                  update(direction, "in_full_tolerance_pct", Number(e.target.value))
                }
                className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {savedAt && !error && (
        <p className="text-sm text-green-600 dark:text-green-400">Uloženo.</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {saving ? "Ukládám…" : "Uložit"}
      </button>
    </div>
  );
}
