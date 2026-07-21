"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile, type ParsedFile } from "@/lib/parse-file";
import { FileDropzone } from "@/components/FileDropzone";
import type { RuleType, RuleConfig } from "@/lib/template-rules";

type KpiDefinition = {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_derived: boolean;
};

type AddedRule = {
  kpiDefinitionId: string;
  kpiName: string;
  ruleType: RuleType;
  config: RuleConfig;
  summary: string;
};

type Props = {
  companyId: string;
  userId: string;
  kpiDefinitions: KpiDefinition[];
};

const AGG_LABELS: Record<string, string> = {
  sum: "sečíst",
  count: "spočítat počet řádků",
  avg: "zprůměrovat",
};

export function NewTemplateForm({ companyId, userId, kpiDefinitions }: Props) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [dateColumn, setDateColumn] = useState<string | "none" | null>(null);

  const [rules, setRules] = useState<AddedRule[]>([]);

  // stav rozpracovaného přidávání jednoho KPI pravidla
  const [selectedKpiId, setSelectedKpiId] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("direct");
  const [sourceColumn, setSourceColumn] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [valueColumn, setValueColumn] = useState("");
  const [aggregation, setAggregation] = useState<"sum" | "count" | "avg">("sum");
  const [reqDateCol, setReqDateCol] = useState("");
  const [actDateCol, setActDateCol] = useState("");
  const [reqQtyCol, setReqQtyCol] = useState("");
  const [actQtyCol, setActQtyCol] = useState("");
  const [onTimeDays, setOnTimeDays] = useState(0);
  const [inFullPct, setInFullPct] = useState(100);

  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
    const result = await parseFile(selected);
    setParsed(result);
  }

  const selectedKpi = kpiDefinitions.find((k) => k.id === selectedKpiId);
  const distinctFilterValues =
    parsed && filterColumn
      ? [...new Set(parsed.rows.map((r) => (r[filterColumn] ?? "").trim()).filter(Boolean))]
      : [];

  function resetKpiForm() {
    setSelectedKpiId("");
    setRuleType("direct");
    setSourceColumn("");
    setFilterColumn("");
    setFilterValue("");
    setValueColumn("");
    setAggregation("sum");
    setReqDateCol("");
    setActDateCol("");
    setReqQtyCol("");
    setActQtyCol("");
    setOnTimeDays(0);
    setInFullPct(100);
  }

  function handleSelectKpi(kpiId: string) {
    setSelectedKpiId(kpiId);
    const kpi = kpiDefinitions.find((k) => k.id === kpiId);
    setRuleType(kpi?.is_derived ? "tolerance_derived" : "direct");
  }

  function handleAddRule() {
    if (!selectedKpi) return;

    let config: RuleConfig;
    let summary: string;

    if (ruleType === "direct") {
      if (!sourceColumn) return;
      config = { source_column: sourceColumn };
      summary = `sloupec „${sourceColumn}“`;
    } else if (ruleType === "aggregated") {
      if (!filterColumn || !filterValue || !valueColumn) return;
      config = { filter_column: filterColumn, filter_value: filterValue, value_column: valueColumn, aggregation };
      summary = `${AGG_LABELS[aggregation]} „${valueColumn}“ kde „${filterColumn}“ = „${filterValue}“`;
    } else {
      if (!reqDateCol || !actDateCol || !reqQtyCol || !actQtyCol) return;
      config = {
        requested_date_column: reqDateCol,
        actual_date_column: actDateCol,
        requested_qty_column: reqQtyCol,
        actual_qty_column: actQtyCol,
        on_time_tolerance_days: onTimeDays,
        in_full_tolerance_pct: inFullPct,
      };
      summary = `tolerance ±${onTimeDays} dní / min ${inFullPct} % množství`;
    }

    setRules((prev) => [
      ...prev,
      { kpiDefinitionId: selectedKpi.id, kpiName: selectedKpi.name, ruleType, config, summary },
    ]);
    resetKpiForm();
  }

  function handleRemoveRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || rules.length === 0) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const templateId = crypto.randomUUID();

    const { error: templateError } = await supabase.from("upload_templates").insert({
      id: templateId,
      company_id: companyId,
      name: templateName.trim(),
      date_column_name: dateColumn === "none" ? null : dateColumn,
      created_by: userId,
    });

    if (templateError) {
      setError(`Nepodařilo se uložit šablonu: ${templateError.message}`);
      setSaving(false);
      return;
    }

    const { error: rulesError } = await supabase.from("template_kpi_rules").insert(
      rules.map((r) => ({
        template_id: templateId,
        kpi_definition_id: r.kpiDefinitionId,
        rule_type: r.ruleType,
        config: r.config,
      })),
    );

    if (rulesError) {
      setError(`Šablona založena, ale pravidla se neuložila: ${rulesError.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
            ✓
          </span>
          Šablona „{templateName}“ uložena s {rules.length} pravidly.
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Jít nahrát data
        </Link>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Nahraj vzorový soubor — appka podle něj ukáže skutečné názvy sloupců
          pro mapování.
        </p>
        <FileDropzone file={file} onFileSelected={handleFileSelected} />
      </div>
    );
  }

  if (dateColumn === null) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase">
          Sloupec s datem
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Který sloupec obsahuje datum? Pokud soubor datum nemá (např.
          "aktuální stav ke dni exportu"), zvol druhou možnost.
        </p>
        <div className="flex flex-col gap-2">
          {parsed.headers.map((h) => (
            <button
              key={h}
              onClick={() => setDateColumn(h)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {h}
            </button>
          ))}
          <button
            onClick={() => setDateColumn("none")}
            className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            — soubor nemá sloupec s datem (použít datum nahrání) —
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase">
            Pravidla v šabloně ({rules.length})
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {rules.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{r.kpiName}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    [{r.ruleType}] {r.summary}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveRule(i)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  odebrat
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase">
          Přidat KPI do šablony
        </h2>

        <label className="mb-3 flex flex-col gap-1 text-sm">
          KPI
          <select
            value={selectedKpiId}
            onChange={(e) => handleSelectKpi(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— vyber KPI —</option>
            {kpiDefinitions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.unit}){k.is_derived ? " — odvozené" : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedKpi && !selectedKpi.is_derived && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Jak se to počítá
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="direct">Přímo — jeden sloupec je rovnou hodnota</option>
              <option value="aggregated">Agregovaně — spočítat z řádků podle typu</option>
            </select>
          </label>
        )}

        {selectedKpi && ruleType === "direct" && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Sloupec s hodnotou
            <select
              value={sourceColumn}
              onChange={(e) => setSourceColumn(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— vyber sloupec —</option>
              {parsed.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedKpi && ruleType === "aggregated" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Sloupec, podle kterého se řádky rozlišují (typ)
              <select
                value={filterColumn}
                onChange={(e) => {
                  setFilterColumn(e.target.value);
                  setFilterValue("");
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— vyber sloupec —</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>

            {filterColumn && (
              <label className="flex flex-col gap-1 text-sm">
                Která hodnota patří k tomuhle KPI
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">— vyber hodnotu —</option>
                  {distinctFilterValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              Sloupec, který se agreguje
              <select
                value={valueColumn}
                onChange={(e) => setValueColumn(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— vyber sloupec —</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Jak agregovat
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as "sum" | "count" | "avg")}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="sum">Sečíst</option>
                <option value="count">Spočítat počet řádků</option>
                <option value="avg">Zprůměrovat</option>
              </select>
            </label>
          </div>
        )}

        {selectedKpi && ruleType === "tolerance_derived" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">
              Toto KPI se počítá z řádkových dat o zakázkách (OTIF styl).
            </p>
            {[
              ["Slíbený termín", reqDateCol, setReqDateCol],
              ["Reálný termín", actDateCol, setActDateCol],
              ["Slíbené množství", reqQtyCol, setReqQtyCol],
              ["Reálné množství", actQtyCol, setActQtyCol],
            ].map(([label, value, setter]) => (
              <label key={label as string} className="flex flex-col gap-1 text-sm">
                {label as string}
                <select
                  value={value as string}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">— vyber sloupec —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="flex gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Tolerance termínu (dny)
                <input
                  type="number"
                  min={0}
                  value={onTimeDays}
                  onChange={(e) => setOnTimeDays(Number(e.target.value))}
                  className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Min. % množství
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={inFullPct}
                  onChange={(e) => setInFullPct(Number(e.target.value))}
                  className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          </div>
        )}

        {selectedKpi && (
          <button
            onClick={handleAddRule}
            className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Přidat pravidlo do šablony
          </button>
        )}
      </div>

      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase">
            Uložit šablonu
          </h2>
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Název šablony
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder='např. "Sales + FCA + dodávky"'
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={handleSaveTemplate}
            disabled={saving || !templateName.trim()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {saving ? "Ukládám…" : "Uložit šablonu"}
          </button>
        </div>
      )}
    </div>
  );
}
