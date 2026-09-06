"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NumberInput } from "@/components/forms/NumberInput";
import { ConflictList } from "@/components/forms/ConflictList";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import {
  fetchExistingCurrentValues,
  findConflicts,
  writeKpiValues,
  type CandidateValue,
  type Conflict,
} from "@/lib/kpi-value-writer";
import { logActivity } from "@/lib/log-activity";
import { periodEndFor } from "@/lib/formula";
import { groupByCategory } from "@/lib/kpi-groups";
import { parseNumber, jeRozumnyRok, ROK_MIN, ROK_MAX } from "@/lib/parse-values";
import { formatPeriod } from "@/lib/format-period";
import { formatValue } from "@/lib/format-number";
import {
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SELECT_INPUT,
  BACK_LINK,
  SPINNER,
  STEP_EYEBROW,
} from "@/lib/ui-classes";

export type ManualKpi = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  /** Názvy šablon, které tohle KPI počítají ze souboru (prázdné = žádná). */
  coveredByTemplates: string[];
};

type Props = {
  companyId: string;
  userId: string;
  kpis: ManualKpi[];
};

const PERIOD_TYPES = [
  { value: "month", label: "Měsíc" },
  { value: "quarter", label: "Čtvrtletí" },
  { value: "year", label: "Rok" },
  { value: "day", label: "Konkrétní den" },
] as const;

/** Předvyplní se minulý měsíc - ten je na rozdíl od probíhajícího uzavřený. */
function lastMonthIso(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualValueForm({ companyId, userId, kpis }: Props) {
  const [kpiId, setKpiId] = useState("");
  const [periodType, setPeriodType] = useState<string>("month");
  const [month, setMonth] = useState(lastMonthIso());
  const [quarterYear, setQuarterYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState("1");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [day, setDay] = useState(todayIso());
  const [value, setValue] = useState("");

  const [step, setStep] = useState<"form" | "saving" | "confirm" | "done">("form");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pending, setPending] = useState<CandidateValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const kpi = kpis.find((k) => k.id === kpiId) ?? null;
  const parsedValue = parseNumber(value);

  /** Datum uvnitř zvoleného období - periodEndFor si z něj udělá konec období. */
  function anchorDate(): string {
    if (periodType === "month") return `${month}-01`;
    if (periodType === "quarter") {
      const firstMonth = (Number(quarter) - 1) * 3 + 1;
      return `${quarterYear}-${String(firstMonth).padStart(2, "0")}-01`;
    }
    if (periodType === "year") return `${year}-01-01`;
    return day;
  }

  /** Rok zvoleného období — pro sanity kontrolu (viz rokOk). */
  function zvolenyRok(): number {
    if (periodType === "month") return Number(month.split("-")[0]);
    if (periodType === "quarter") return Number(quarterYear);
    if (periodType === "year") return Number(year);
    return Number(day.split("-")[0]);
  }

  // Bez téhle meze bral ruční zápis roky jako 999999 → přetečení v
  // periodEndFor dělalo z náhledu „888888-03-NaN" a rozbíjelo časovou osu
  // na /kpis (nález testu 2026-09-06). Stejný rozsah jako import ze souboru.
  const rokOk = jeRozumnyRok(zvolenyRok());
  const periodEnd = rokOk ? periodEndFor(anchorDate(), periodType) : "";
  const canSubmit = kpi !== null && parsedValue !== null && rokOk && step === "form";

  async function handleSubmit() {
    if (!kpi || parsedValue === null) return;

    setError(null);
    setStep("saving");

    const candidate: CandidateValue = {
      kpiDefinitionId: kpi.id,
      kpiName: kpi.name,
      value: parsedValue,
      periodEnd,
      periodType,
    };

    const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
      companyId,
      [kpi.id],
    );
    if (existingError) {
      setError(`Nepodařilo se ověřit existující data: ${existingError}`);
      setStep("form");
      return;
    }

    const found = findConflicts([candidate], existingByKey);
    if (found.length > 0) {
      setConflicts(found);
      setPending(candidate);
      setStep("confirm");
      return;
    }

    await save(candidate, existingByKey);
  }

  async function save(
    candidate: CandidateValue,
    existingByKey: Awaited<ReturnType<typeof fetchExistingCurrentValues>>["existingByKey"],
  ) {
    setStep("saving");

    const { error: writeError } = await writeKpiValues(
      companyId,
      [candidate],
      { kind: "manual", userId },
      existingByKey,
    );

    if (writeError) {
      setError(writeError);
      setStep("form");
      return;
    }

    await logActivity(createClient(), {
      companyId,
      userId,
      action: "kpi_value.manual_entry",
      metadata: {
        kpi_code: kpi?.code ?? null,
        period_end: candidate.periodEnd,
        period_type: candidate.periodType,
        value: candidate.value,
      },
    });

    setSummary(
      `${candidate.kpiName}: ${formatValue(candidate.value, kpi?.unit ?? "")} za ${formatPeriod(
        candidate.periodEnd,
        candidate.periodType,
      )}.`,
    );
    setStep("done");
  }

  async function handleConfirm(overwrite: boolean) {
    if (!pending) return;

    if (!overwrite) {
      setConflicts([]);
      setPending(null);
      setStep("form");
      return;
    }

    // Existující hodnoty se načtou znovu - mezitím mohl kolega uložit jinou verzi.
    const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
      companyId,
      [pending.kpiDefinitionId],
    );
    if (existingError) {
      setError(`Nepodařilo se ověřit existující data: ${existingError}`);
      setStep("form");
      return;
    }

    await save(pending, existingByKey);
  }

  function reset() {
    setValue("");
    setConflicts([]);
    setPending(null);
    setSummary(null);
    setStep("form");
  }

  const stepLabels: Record<string, string> = {
    form: "Zadej hodnotu",
    saving: "Ukládám…",
    confirm: "Potvrď přepsání",
    done: "Hotovo",
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <h2 className={`mb-6 ${STEP_EYEBROW}`}>{stepLabels[step]}</h2>

      {(step === "form" || step === "saving") && (
        <div className="flex flex-col gap-6">
          <Link href="/upload" className={`self-start ${BACK_LINK}`}>
            ← Zpět na nahrávání dat
          </Link>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-black dark:text-zinc-100">
              Které KPI zapisuješ?
            </span>
            <select
              value={kpiId}
              onChange={(e) => setKpiId(e.target.value)}
              className={SELECT_INPUT}
            >
              <option value="">— vyber KPI —</option>
              {groupByCategory(kpis).map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {list.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.unit})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {kpi?.description && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {kpi.description}
              </span>
            )}
          </label>

          {/* Ruční hodnota vydrží jen do dalšího nahrání souboru, který tohle
              KPI počítá - to je potřeba říct dopředu, ne až se přepíše. */}
          {kpi && kpi.coveredByTemplates.length > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Tohle KPI se počítá ze šablony{" "}
              <strong>{kpi.coveredByTemplates.join(", ")}</strong>. Ručně zadanou
              hodnotu přepíše nejbližší nahrání souboru za stejné období.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-black dark:text-zinc-100">
              Za jaké období hodnota platí?
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className={SELECT_INPUT}
              >
                {PERIOD_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {periodType === "month" && (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={SELECT_INPUT}
                />
              )}

              {periodType === "quarter" && (
                <>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className={SELECT_INPUT}
                  >
                    {["1", "2", "3", "4"].map((q) => (
                      <option key={q} value={q}>
                        Q{q}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={quarterYear}
                    onChange={(e) => setQuarterYear(e.target.value)}
                    className={`${SELECT_INPUT} w-28`}
                  />
                </>
              )}

              {periodType === "year" && (
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={`${SELECT_INPUT} w-28`}
                />
              )}

              {periodType === "day" && (
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={SELECT_INPUT}
                />
              )}

              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {rokOk
                  ? `→ uloží se jako ${formatPeriod(periodEnd, periodType)}`
                  : `→ rok musí být mezi ${ROK_MIN} a ${ROK_MAX}`}
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-black dark:text-zinc-100">
              Hodnota
            </span>
            <NumberInput
              value={value}
              onChange={setValue}
              unit={kpi?.unit}
              placeholder="0"
            />
          </label>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={PRIMARY_BUTTON}
            >
              Uložit hodnotu
            </button>
            {step === "saving" && <span className={SPINNER} />}
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Za tohle období už je hodnota uložená. Přepsat, nebo zrušit?
          </p>
          <ConflictList conflicts={conflicts} sourceName="ruční zápis" />
          <div className="flex gap-3">
            <button onClick={() => handleConfirm(true)} className={PRIMARY_BUTTON}>
              Přepsat
            </button>
            <button onClick={() => handleConfirm(false)} className={SECONDARY_BUTTON}>
              Zrušit
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-start gap-4">
          <SuccessBanner>{summary}</SuccessBanner>
          <div className="flex gap-3">
            <button onClick={reset} className={PRIMARY_BUTTON}>
              Zapsat další hodnotu
            </button>
            <Link href="/kpis" className={SECONDARY_BUTTON}>
              Zobrazit přehled KPI
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
