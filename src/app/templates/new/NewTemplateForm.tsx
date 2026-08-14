"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile, type ParsedFile } from "@/lib/parse-file";
import { FileDropzone } from "@/components/FileDropzone";
import type { RuleType, RuleConfig } from "@/lib/template-rules";
import { logActivity } from "@/lib/log-activity";
import { SuccessBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SELECT_INPUT, TEXT_INPUT, STEP_EYEBROW } from "@/lib/ui-classes";
import { FormulaBuilder } from "@/components/templates/FormulaBuilder";
import { describeSlot, type FormulaSpec, type FormulaConfig } from "@/lib/formula";

type KpiDefinition = {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_derived: boolean;
  /** Slotový model (migrace 0004). null = KPI zatím jede na starých typech pravidel. */
  formula_spec: FormulaSpec | null;
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
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig>({ slots: {} });
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
    try {
      const result = await parseFile(selected);
      setParsed(result);
    } catch {
      setFile(null);
      setError(
        "Soubor se nepodařilo přečíst. Zkontroluj, že je to platný CSV nebo Excel soubor.",
      );
    }
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
    setFormulaConfig({ slots: {} });
    setRuleError(null);
  }

  function handleSelectKpi(kpiId: string) {
    setSelectedKpiId(kpiId);
    setFormulaConfig({ slots: {} });
    setRuleError(null);
    const kpi = kpiDefinitions.find((k) => k.id === kpiId);
    if (kpi?.is_derived) {
      setRuleType("tolerance_derived");
    } else if (kpi?.formula_spec) {
      setRuleType("formula");
    } else {
      setRuleType("direct");
    }
  }

  function handleAddRule() {
    if (!selectedKpi) return;

    let config: RuleConfig;
    let summary: string;

    if (ruleType === "formula") {
      const spec = selectedKpi.formula_spec;
      if (!spec) return;
      // Každý slot vzorce musí mít aspoň jeden sloupec, jinak by KPI
      // nešlo spočítat a šablona by tiše nedělala nic.
      const unfilled = spec.slots.filter(
        (s) => (formulaConfig.slots[s.key]?.terms.length ?? 0) === 0,
      );
      if (unfilled.length > 0) {
        setRuleError(
          `U KPI „${selectedKpi.name}“ zbývá vyplnit: ${unfilled.map((s) => s.label).join(", ")}.`,
        );
        return;
      }
      setRuleError(null);
      config = formulaConfig;
      summary = spec.slots
        .map((s) => `${s.label} = ${describeSlot(formulaConfig.slots[s.key])}`)
        .join(" · ");
    } else if (ruleType === "direct") {
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

    await logActivity(supabase, {
      companyId,
      userId,
      action: "template.created",
      metadata: { template_id: templateId, name: templateName.trim(), rules_count: rules.length },
    });

    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4">
        <SuccessBanner>
          Šablona „{templateName}“ uložena s {rules.length} pravidly.
        </SuccessBanner>
        <Link href="/upload" className={PRIMARY_BUTTON}>
          Jít nahrát data
        </Link>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Nahraj vzorový soubor — aplikace podle něj ukáže skutečné názvy sloupců
          pro mapování.
        </p>
        <FileDropzone file={file} onFileSelected={handleFileSelected} />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (dateColumn === null) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {file && (
          <p className="mb-3 truncate text-xs text-zinc-400">
            Soubor: <span className="font-medium text-zinc-500 dark:text-zinc-300">{file.name}</span>
          </p>
        )}
        <h2 className={`mb-3 ${STEP_EYEBROW}`}>
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
      {file && (
        <p className="-mb-2 truncate text-xs text-zinc-400">
          Soubor: <span className="font-medium text-zinc-500 dark:text-zinc-300">{file.name}</span>
        </p>
      )}
      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className={`mb-3 ${STEP_EYEBROW}`}>
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

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className={`mb-3 ${STEP_EYEBROW}`}>
          Přidat KPI do šablony
        </h2>

        <label className="mb-3 flex flex-col gap-1 text-sm">
          KPI
          <select
            value={selectedKpiId}
            onChange={(e) => handleSelectKpi(e.target.value)}
            className={SELECT_INPUT}
          >
            <option value="">— vyber KPI —</option>
            {kpiDefinitions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.unit}){k.is_derived ? " — odvozené" : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedKpi && !selectedKpi.is_derived && !selectedKpi.formula_spec && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Jak se to počítá
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className={SELECT_INPUT}
            >
              <option value="direct">Přímo — jeden sloupec je rovnou hodnota</option>
              <option value="aggregated">Agregovaně — spočítat z řádků podle typu</option>
            </select>
          </label>
        )}

        {selectedKpi && ruleType === "formula" && selectedKpi.formula_spec && (
          <FormulaBuilder
            spec={selectedKpi.formula_spec}
            headers={parsed.headers}
            rows={parsed.rows}
            dateColumn={dateColumn === "none" ? null : dateColumn}
            periodType="month"
            unit={selectedKpi.unit}
            config={formulaConfig}
            onConfigChange={setFormulaConfig}
          />
        )}

        {selectedKpi && ruleType === "direct" && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Sloupec s hodnotou
            <select
              value={sourceColumn}
              onChange={(e) => setSourceColumn(e.target.value)}
              className={SELECT_INPUT}
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
                className={SELECT_INPUT}
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
                  className={SELECT_INPUT}
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
                className={SELECT_INPUT}
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
                className={SELECT_INPUT}
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
                  className={SELECT_INPUT}
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
                  className={`w-28 ${TEXT_INPUT}`}
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
                  className={`w-28 ${TEXT_INPUT}`}
                />
              </label>
            </div>
          </div>
        )}

        {selectedKpi && (
          <div className="mt-4 flex flex-col gap-2">
            {ruleError && <p className="text-sm text-red-600 dark:text-red-400">{ruleError}</p>}
            <button onClick={handleAddRule} className={`self-start ${PRIMARY_BUTTON}`}>
              Přidat pravidlo do šablony
            </button>
          </div>
        )}
      </div>

      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className={`mb-3 ${STEP_EYEBROW}`}>
            Uložit šablonu
          </h2>
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Název šablony
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder='např. "Sales + FCA + dodávky"'
              className={SELECT_INPUT}
            />
          </label>
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={handleSaveTemplate}
            disabled={saving || !templateName.trim()}
            className={PRIMARY_BUTTON}
          >
            {saving ? "Ukládám…" : "Uložit šablonu"}
          </button>
        </div>
      )}
    </div>
  );
}
