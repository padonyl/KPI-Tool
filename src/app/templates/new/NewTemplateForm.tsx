"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile, seZmenenouHlavickou, type ParsedFile } from "@/lib/parse-file";
import { HeaderRowPicker } from "@/components/templates/HeaderRowPicker";
import { FileDropzone } from "@/components/FileDropzone";
import type { RuleType, RuleConfig } from "@/lib/template-rules";
import { logActivity } from "@/lib/log-activity";
import { SuccessBanner } from "@/components/forms/StatusBanner";
import {
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SELECT_INPUT,
  TEXT_INPUT,
  STEP_EYEBROW,
} from "@/lib/ui-classes";
import {
  computeCandidates,
  validateCandidates,
  stageUpload,
  commitUpload,
  abandonUpload,
  totalSkipped,
  type StagedUpload,
  type SkippedRows,
} from "@/lib/run-upload";
import { SkippedRowsNotice } from "@/components/forms/SkippedRowsNotice";
import { ConflictList } from "@/components/forms/ConflictList";
import { FormulaBuilder } from "@/components/templates/FormulaBuilder";
import {
  describeSlot,
  slotTokens,
  validateSlotTokens,
  type FormulaSpec,
  type FormulaConfig,
} from "@/lib/formula";
import { describeColumns, type ColumnSample } from "@/lib/detect-columns";
import { periodSourceNote } from "@/lib/kpi-settings";
import { groupByCategory } from "@/lib/kpi-groups";

type KpiDefinition = {
  id: string;
  code: string;
  name: string;
  /** Oblast, pod kterou se KPI v nabídce seskupí (Finance, Lidé a růst...). */
  category: string;
  unit: string;
  is_derived: boolean;
  /** Slotový model (migrace 0004). null = KPI zatím jede na starých typech pravidel. */
  formula_spec: FormulaSpec | null;
};

type AddedRule = {
  kpiDefinitionId: string;
  kpiName: string;
  /** Kód a jednotka jsou potřeba, aby šlo z téhle šablony rovnou nahrát data. */
  kpiCode: string;
  kpiUnit: string;
  formulaSpec: FormulaSpec | null;
  ruleType: RuleType;
  config: RuleConfig;
  summary: string;
};

/** Existující šablona k úpravě. Když chybí, formulář zakládá novou. */
export type ExistingTemplate = {
  id: string;
  name: string;
  dateColumnName: string | null;
  periodType: string;
  /** Názvy sloupců uložené při zakládání (migrace 0006) - aby šlo editovat bez souboru. */
  sourceColumns: string[];
  rules: AddedRule[];
};

type Props = {
  companyId: string;
  userId: string;
  kpiDefinitions: KpiDefinition[];
  existing?: ExistingTemplate;
};

const AGG_LABELS: Record<string, string> = {
  sum: "sečíst",
  count: "spočítat počet řádků",
  avg: "zprůměrovat",
  count_distinct: "spočítat různé hodnoty",
};

export function NewTemplateForm({ companyId, userId, kpiDefinitions, existing }: Props) {
  const router = useRouter();
  const isEditing = !!existing;

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [dateColumn, setDateColumn] = useState<string | "none" | null>(
    existing ? (existing.dateColumnName ?? "none") : null,
  );

  const [rules, setRules] = useState<AddedRule[]>(existing?.rules ?? []);
  /** Délka období, do kterého se řádky slučují. Dřív natvrdo "month". */
  const [periodType, setPeriodType] = useState(existing?.periodType ?? "month");
  /** Délka období se potvrzuje samostatným krokem - u editace je už hotová. */
  const [periodConfirmed, setPeriodConfirmed] = useState(!!existing);
  /** true = uživatel odmítl návrh a nastavuje datum sám. */
  const [manualDate, setManualDate] = useState(false);

  // Při editaci se sloupce berou z uložených názvů, dokud uživatel nenahraje
  // vzorek. Bez řádků nejde počítat živý náhled - proto je nahrání volitelné.
  const headers = parsed?.headers ?? existing?.sourceColumns ?? [];
  const sampleRows = parsed?.rows ?? [];

  // stav rozpracovaného přidávání jednoho KPI pravidla
  const [selectedKpiId, setSelectedKpiId] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("direct");
  const [sourceColumn, setSourceColumn] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [valueColumn, setValueColumn] = useState("");
  // Patří výhradně zastaralému pravidlu "aggregated" - slotový model má
  // vlastní agregaci u každého slotu, včetně count_distinct.
  const [aggregation, setAggregation] = useState<"sum" | "count" | "avg">("sum");
  const [reqDateCol, setReqDateCol] = useState("");
  const [actDateCol, setActDateCol] = useState("");
  const [reqQtyCol, setReqQtyCol] = useState("");
  const [actQtyCol, setActQtyCol] = useState("");
  const [onTimeDays, setOnTimeDays] = useState(0);
  const [inFullPct, setInFullPct] = useState(100);
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig>({ slots: {} });
  const [ruleError, setRuleError] = useState<string | null>(null);
  /** null = přidávám nové pravidlo; číslo = upravuji pravidlo na tomhle indexu. */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [templateName, setTemplateName] = useState(existing?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Při editaci se před uložením ptáme, protože historie se nepřepočítá. */
  const [confirmingEdit, setConfirmingEdit] = useState(false);

  // Rovnou nahrát data z toho samého souboru (viz komentář u handleSaveTemplate).
  // Při editaci vypnuté - data se nahrávají jen když uživatel vzorek přiloží.
  const [importData, setImportData] = useState(!existing);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedUpload | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  /** Vyřazené řádky při rovnou nahrávaných datech - čeká se na rozhodnutí. */
  const [skipped, setSkipped] = useState<SkippedRows | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    candidates: import("@/lib/kpi-value-writer").CandidateValue[];
    deliveryInserts: import("@/lib/run-upload").DeliveryInsert[];
    file: File;
  } | null>(null);
  const [importedCount, setImportedCount] = useState(0);

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

  // Uživatel odmítl odhad řádku s hlavičkou a vybral jiný.
  //
  // Všechno, co se vázalo na staré názvy sloupců, se musí zahodit -
  // jinak by v šabloně zůstaly odkazy na sloupce, které po přepnutí
  // hlavičky vůbec neexistují, a KPI by potichu nic nepočítalo.
  function zmenHlavicku(index: number) {
    if (!parsed) return;
    setParsed(seZmenenouHlavickou(parsed, index));
    setRules([]);
    setDateColumn(null);
    setManualDate(false);
    setFormulaConfig({ slots: {} });
    setSourceColumn("");
    setFilterColumn("");
    setFilterValue("");
    setValueColumn("");
    setRuleError(null);
  }

  // Odhad sloupce s datem počítáme jednou - potřebuje ho jak obrazovka
  // s návrhem, tak zápis do logu (kvůli sledování, jak často odhad sedí).
  const columnSamples = useMemo(
    () => describeColumns(headers, sampleRows),
    [headers, sampleRows],
  );
  const dateSuggestion =
    [...columnSamples].filter((c) => c.looksLikeDate).sort((a, b) => b.dateRatio - a.dateRatio)[0] ??
    null;

  const selectedKpi = kpiDefinitions.find((k) => k.id === selectedKpiId);
  const distinctFilterValues =
    filterColumn
      ? [...new Set(sampleRows.map((r) => (r[filterColumn] ?? "").trim()).filter(Boolean))]
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
    setEditingIndex(null);
  }

  /** Načte už přidané pravidlo zpátky do formuláře k doladění. */
  function handleEditRule(index: number) {
    const rule = rules[index];
    setEditingIndex(index);
    setSelectedKpiId(rule.kpiDefinitionId);
    setRuleType(rule.ruleType);
    setRuleError(null);

    if (rule.ruleType === "formula") {
      setFormulaConfig(rule.config as FormulaConfig);
    } else if (rule.ruleType === "direct") {
      setSourceColumn((rule.config as { source_column: string }).source_column);
    } else if (rule.ruleType === "aggregated") {
      const config = rule.config as {
        filter_column: string;
        filter_value: string;
        value_column: string;
        aggregation: "sum" | "count" | "avg";
      };
      setFilterColumn(config.filter_column);
      setFilterValue(config.filter_value);
      setValueColumn(config.value_column);
      setAggregation(config.aggregation);
    } else {
      const config = rule.config as {
        requested_date_column: string;
        actual_date_column: string;
        requested_qty_column: string;
        actual_qty_column: string;
        on_time_tolerance_days: number;
        in_full_tolerance_pct: number;
      };
      setReqDateCol(config.requested_date_column);
      setActDateCol(config.actual_date_column);
      setReqQtyCol(config.requested_qty_column);
      setActQtyCol(config.actual_qty_column);
      setOnTimeDays(config.on_time_tolerance_days);
      setInFullPct(config.in_full_tolerance_pct);
    }
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
      const unfilled = spec.slots.filter((s) => {
        const definition = formulaConfig.slots[s.key];
        return !definition || slotTokens(definition).length === 0;
      });
      if (unfilled.length > 0) {
        setRuleError(
          `U KPI „${selectedKpi.name}“ zbývá vyplnit: ${unfilled.map((s) => s.label).join(", ")}.`,
        );
        return;
      }
      // Rozbitý výraz na plátně (dvě znaménka za sebou, nepárová závorka…)
      // by se uložil a tiše nic nespočítal - odchytit ho tady.
      const broken = spec.slots
        .map((s) => ({ s, err: validateSlotTokens(slotTokens(formulaConfig.slots[s.key])) }))
        .find((x) => x.err !== null);
      if (broken) {
        setRuleError(`„${broken.s.label}“: ${broken.err}`);
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

    const entry: AddedRule = {
      kpiDefinitionId: selectedKpi.id,
      kpiName: selectedKpi.name,
      kpiCode: selectedKpi.code,
      kpiUnit: selectedKpi.unit,
      formulaSpec: selectedKpi.formula_spec,
      ruleType,
      config,
      summary,
    };

    setRules((prev) =>
      editingIndex === null
        ? [...prev, entry]
        : prev.map((r, i) => (i === editingIndex ? entry : r)),
    );
    resetKpiForm();
  }

  function handleRemoveRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Uloží změny existující šablony. Pravidla se nahrazují celá (smazat + vložit) -
   * je to jednodušší a bezpečnější než dohledávat, které se změnilo.
   *
   * POZOR: už spočítané hodnoty se NEPŘEPOČÍTÁVAJÍ, zůstanou takové, jaké je
   * spočítala předchozí verze šablony. Uživatel to potvrzuje dialogem výš.
   */
  async function handleUpdateTemplate() {
    if (!existing || !templateName.trim() || rules.length === 0) return;
    setConfirmingEdit(false);
    setSaving(true);
    setError(null);

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("upload_templates")
      .update({
        name: templateName.trim(),
        date_column_name: dateColumn === "none" ? null : dateColumn,
        period_type: periodType,
        ...(parsed ? { source_columns: parsed.headers } : {}),
      })
      .eq("id", existing.id);

    if (updateError) {
      setError(`Nepodařilo se uložit změny: ${updateError.message}`);
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("template_kpi_rules")
      .delete()
      .eq("template_id", existing.id);

    if (deleteError) {
      setError(`Nepodařilo se nahradit pravidla: ${deleteError.message}`);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("template_kpi_rules").insert(
      rules.map((r) => ({
        template_id: existing.id,
        kpi_definition_id: r.kpiDefinitionId,
        rule_type: r.ruleType,
        config: r.config,
      })),
    );

    if (insertError) {
      setError(
        `Stará pravidla byla smazána, ale nová se neuložila: ${insertError.message}. Zkus uložit znovu.`,
      );
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      companyId,
      userId,
      action: "template.updated",
      metadata: {
        template_id: existing.id,
        name: templateName.trim(),
        rules_count: rules.length,
      },
    });

    setSaving(false);
    router.push("/templates");
    router.refresh();
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
      period_type: periodType,
      // Uložit názvy sloupců, aby šla šablona později editovat i bez
      // opětovného nahrání vzorku (migrace 0006).
      source_columns: parsed?.headers ?? null,
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
      // Uklidit po sobě - jinak zůstane v DB prázdná šablona bez pravidel,
      // která se pak nabízí k nahrání a tiše nic nespočítá.
      await supabase.from("upload_templates").delete().eq("id", templateId);
      setError(
        `Pravidla se nepodařilo uložit, šablona nebyla založena: ${rulesError.message}`,
      );
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      companyId,
      userId,
      action: "template.created",
      metadata: {
        template_id: templateId,
        name: templateName.trim(),
        rules_count: rules.length,
        // Kvalita automatického odhadu - kolik uživatelů návrh přijalo a kolik
        // si to nastavilo ručně. Podle toho se dá odhadování ladit.
        detection: {
          date_column_suggested: dateSuggestion?.name ?? null,
          date_column_chosen: dateColumn,
          date_column_manual: manualDate,
          period_type_chosen: periodType,
          period_type_manual: manualDate || periodType !== "month",
        },
      },
    });

    setSavedTemplateId(templateId);

    // Rovnou nahrát data z téhož souboru. Dřív se soubor při zakládání šablony
    // jen přečetl kvůli náhledu a zahodil - uživatel viděl spočítané součty,
    // myslel si, že data má uvnitř, a musel je nahrávat podruhé.
    if (!importData || !parsed || !file) {
      setSaving(false);
      setDone(true);
      return;
    }

    const { candidates, deliveryInserts, skipped: skippedRows } = computeCandidates(
      parsed.rows,
      dateColumn === "none" ? null : dateColumn,
      periodType,
      rules,
      companyId,
    );

    if (candidates.length === 0) {
      setImportNote(
        "Šablona uložena, ale ze souboru se nepodařilo spočítat žádnou hodnotu k uložení.",
      );
      setSaving(false);
      setDone(true);
      return;
    }

    const validationError = validateCandidates(candidates, rules);
    if (validationError) {
      setImportNote(`Šablona uložena, data ale nenahrána — ${validationError}`);
      setSaving(false);
      setDone(true);
      return;
    }

    // Šablona je uložená; o vyřazených řádcích rozhoduje uživatel dřív,
    // než se hodnoty zapíšou.
    if (totalSkipped(skippedRows) > 0) {
      setSkipped(skippedRows);
      setPendingImport({ candidates, deliveryInserts, file });
      setSaving(false);
      return;
    }

    const { staged: result, error: stageError } = await stageUpload({
      companyId,
      userId,
      file,
      candidates,
      deliveryInserts,
      pathPrefix: "template-init",
    });

    if (stageError || !result) {
      setImportNote(`Šablona uložena, data ale nenahrána — ${stageError}`);
      setSaving(false);
      setDone(true);
      return;
    }

    if (result.conflicts.length > 0) {
      setStaged(result);
      setSaving(false);
      return; // čeká se na potvrzení přepsání
    }

    await commitImport(result, templateId);
  }

  async function commitImport(toCommit: StagedUpload, templateId: string) {
    setSaving(true);
    const { error: commitError } = await commitUpload({
      companyId,
      userId,
      staged: toCommit,
      activityMetadata: { template_id: templateId, source: "template-init" },
    });

    setImportNote(
      commitError
        ? `Šablona uložena, data ale nenahrána — ${commitError}`
        : `Rovnou se nahrálo ${toCommit.candidates.length} hodnot z tvého souboru.`,
    );
    setImportedCount(commitError ? 0 : toCommit.candidates.length);
    setStaged(null);
    setSaving(false);
    setDone(true);
  }

  async function handleImportConflicts(overwrite: boolean) {
    if (!staged || !savedTemplateId) return;

    if (!overwrite) {
      await abandonUpload(staged.uploadId, "Zrušeno uživatelem (konflikt období)");
      setImportNote("Šablona uložena. Data se nenahrála — přepsání jsi zrušil.");
      setStaged(null);
      setDone(true);
      return;
    }

    await commitImport(staged, savedTemplateId);
  }

  // Vyřazené řádky u rovnou nahrávaných dat - ptáme se dřív než na konflikty.
  if (skipped && pendingImport && savedTemplateId) {
    const continueImport = async () => {
      setSkipped(null);
      setSaving(true);
      const { staged: result, error: stageError } = await stageUpload({
        companyId,
        userId,
        file: pendingImport.file,
        candidates: pendingImport.candidates,
        deliveryInserts: pendingImport.deliveryInserts,
        pathPrefix: "template-init",
      });
      setPendingImport(null);

      if (stageError || !result) {
        setImportNote(`Šablona uložena, data ale nenahrána — ${stageError}`);
        setSaving(false);
        setDone(true);
        return;
      }
      if (result.conflicts.length > 0) {
        setStaged(result);
        setSaving(false);
        return;
      }
      await commitImport(result, savedTemplateId);
    };

    return (
      <div className="flex flex-col gap-4">
        <SuccessBanner>Šablona „{templateName}“ uložena.</SuccessBanner>
        <SkippedRowsNotice
          skipped={skipped}
          onContinue={continueImport}
          onCancel={() => {
            setSkipped(null);
            setPendingImport(null);
            setImportNote("Data se nenahrála — nahrávání jsi zrušil.");
            setDone(true);
          }}
        />
      </div>
    );
  }

  // Konflikt při rovnou nahrávaných datech - stejná otázka jako u běžného nahrání.
  if (staged) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className={STEP_EYEBROW}>Potvrď přepsání</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Šablona „{templateName}“ je uložená. Pro tato období už ale máš hodnoty
          z dřívějška — přepsat je daty z tohoto souboru?
        </p>
        <ConflictList conflicts={staged.conflicts} sourceName={file?.name ?? templateName} />
        <div className="flex gap-3">
          <button onClick={() => handleImportConflicts(true)} className={PRIMARY_BUTTON}>
            Přepsat všechny
          </button>
          <button onClick={() => handleImportConflicts(false)} className={SECONDARY_BUTTON}>
            Data nenahrávat
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4">
        <SuccessBanner>
          Šablona „{templateName}“ uložena s {rules.length} pravidly.
          {importNote ? ` ${importNote}` : ""}
        </SuccessBanner>
        <div className="flex gap-3">
          {importedCount > 0 ? (
            <>
              <Link href="/kpis" className={PRIMARY_BUTTON}>
                Zobrazit přehled KPI
              </Link>
              <Link href="/templates" className={SECONDARY_BUTTON}>
                Zpět na šablony
              </Link>
            </>
          ) : (
            <Link href="/upload" className={PRIMARY_BUTTON}>
              Jít nahrát data
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Při editaci se vzorek nevyžaduje - sloupce známe z uložené šablony.
  if (!parsed && !isEditing) {
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

  // Potvrzení hlavičky patří PŘED otázku na datum: dokud nejsou správné
  // názvy sloupců, nemá smysl se ptát, který z nich nese datum.
  const potvrzeniHlavicky = parsed ? (
    <div className="mb-4">
      <HeaderRowPicker soubor={parsed} onZmena={zmenHlavicku} />
    </div>
  ) : null;

  // ---------- Krok: odkud se vezme datum ----------
  // Neptáme se "je to k dnešku?" - to mísí DVĚ různé věci: kdy uživatel
  // nahrává (vždycky dnes) a za jaké období data jsou. U reportu dodávek za
  // dva měsíce je odpověď "nahrávám dnes" pravdivá, ale zavádějící.
  // Ptáme se na fakt: obsahuje soubor datum? A protože to aplikace pozná
  // sama, jde spíš o potvrzení nálezu než o vyptávání.
  if (dateColumn === null) {
    const columns = columnSamples;
    const dateCandidates = columns.filter((c) => c.looksLikeDate);
    const otherColumns = columns.filter((c) => !c.looksLikeDate);
    const suggestion = dateSuggestion;

    // Návrh k potvrzení. Uživatel typicky jen odsouhlasí; ruční nastavení
    // je pojistka, ne hlavní cesta.
    if (suggestion && !manualDate) {
      return (
        <div>
        {potvrzeniHlavicky}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {file && (
            <p className="mb-3 truncate text-xs text-zinc-400">
              Soubor:{" "}
              <span className="font-medium text-zinc-500 dark:text-zinc-300">{file.name}</span>
            </p>
          )}

          <h2 className={`mb-4 ${STEP_EYEBROW}`}>Období pro měření</h2>

          <div className="rounded-lg border-2 border-brand/40 bg-brand/5 p-5">
            <p className="text-[15px] leading-7 text-brand-ink dark:text-zinc-100">
              Z dat předpokládám, že období určuje sloupec{" "}
              <span className="font-semibold">„{suggestion.name}“</span> a že
              hodnoty se mají slučovat po{" "}
              <span className="font-semibold">měsících</span>.
            </p>
            {suggestion.examples.length > 0 && (
              <p className="mt-2 font-mono text-xs text-zinc-500">
                Našel jsem tam např.: {suggestion.examples.join("  ·  ")}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setDateColumn(suggestion.name);
                setPeriodType("month");
                setPeriodConfirmed(true);
              }}
              className={PRIMARY_BUTTON}
            >
              Ano, souhlasí
            </button>
            <button
              onClick={() => setManualDate(true)}
              className="text-sm text-zinc-500 hover:text-brand"
            >
              Ne, nastavím to ručně
            </button>
          </div>
        </div>
        </div>
      );
    }

    const ColumnButton = ({ column }: { column: ColumnSample }) => (
      <button
        onClick={() => setDateColumn(column.name)}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-zinc-300 px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/5 dark:border-zinc-700"
      >
        <span className="text-sm font-medium text-brand-ink dark:text-zinc-100">
          {column.name}
        </span>
        {column.examples.length > 0 && (
          <span className="font-mono text-xs text-zinc-500">
            {column.examples.join("  ·  ")}
          </span>
        )}
      </button>
    );

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {file && (
          <p className="mb-3 truncate text-xs text-zinc-400">
            Soubor:{" "}
            <span className="font-medium text-zinc-500 dark:text-zinc-300">{file.name}</span>
          </p>
        )}

        <h2 className={`mb-2 ${STEP_EYEBROW}`}>Datum v souboru</h2>
        <p className="mb-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Podle data se čísla zařadí do období, aby šel sledovat vývoj v čase.
        </p>

        <div className="flex flex-col gap-2">
          {dateCandidates.length > 0 ? (
            <>
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {dateCandidates.length === 1
                  ? "Tenhle sloupec vypadá jako datum"
                  : "Tyhle sloupce vypadají jako datum"}
              </p>
              {dateCandidates.map((c) => (
                <ColumnButton key={c.name} column={c} />
              ))}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700">
              V souboru se nenašel žádný sloupec s datem. Buď ho vyber ručně
              níže, nebo pokračuj bez data.
            </p>
          )}

          <button
            onClick={() => setDateColumn("none")}
            className="mt-1 rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-left text-sm text-zinc-600 transition-colors hover:border-brand hover:bg-brand/5 dark:border-zinc-700 dark:text-zinc-400"
          >
            Soubor datum neobsahuje
            <span className="mt-0.5 block text-xs text-zinc-400">
              Čísla se uloží k dnešnímu dni jako aktuální stav — typicky výpis
              zásob nebo skladu.
            </span>
          </button>

          {otherColumns.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-brand">
                Vybrat jiný sloupec ({otherColumns.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {otherColumns.map((c) => (
                  <ColumnButton key={c.name} column={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  // ---------- Krok: délka období ----------
  // Ptáme se jen když se použije datum ze souboru. U snímku k dnešku nemá
  // slučování do období smysl.
  if (dateColumn !== "none" && !periodConfirmed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className={`mb-2 ${STEP_EYEBROW}`}>Za jak dlouhé období</h2>
        <p className="mb-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Řádky se stejným obdobím se spojí do jedné hodnoty. Datum bereme ze
          sloupce{" "}
          <span className="font-medium text-brand-ink dark:text-zinc-100">
            „{dateColumn}“
          </span>
          .
        </p>

        <div className="flex flex-col gap-2">
          {[
            { value: "month", label: "Měsíc", hint: "Nejběžnější — jedna hodnota za každý měsíc." },
            { value: "quarter", label: "Kvartál", hint: "Jedna hodnota za tři měsíce." },
            { value: "year", label: "Rok", hint: "Jedna hodnota za rok." },
            { value: "day", label: "Jednotlivé dny", hint: "Nic se neslučuje, každý den zvlášť." },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setPeriodType(option.value);
                setPeriodConfirmed(true);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/5 dark:border-zinc-700"
            >
              <span className="block text-sm font-medium text-brand-ink dark:text-zinc-100">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">{option.hint}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setDateColumn(null);
            setManualDate(true);
          }}
          className="mt-4 text-xs text-zinc-500 hover:text-brand"
        >
          ← Zpět na výběr sloupce
        </button>
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

      {/* Při editaci je vzorek volitelný - bez něj jde měnit mapování, ale
          nedá se počítat živý náhled (chybí řádky, ne jen názvy sloupců). */}
      {isEditing && !parsed && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Chceš u úprav vidět živý náhled výsledku? Přilož vzorový soubor —
            není povinný, mapování jde měnit i bez něj.
          </p>
          <FileDropzone file={file} onFileSelected={handleFileSelected} />
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className={`mb-3 ${STEP_EYEBROW}`}>
            Pravidla v šabloně ({rules.length})
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {rules.map((r, i) => (
              <li
                key={i}
                className={[
                  "flex items-center justify-between gap-3 py-2 text-sm",
                  editingIndex === i ? "-mx-2 rounded-md bg-brand/5 px-2" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <span className="font-medium">{r.kpiName}</span>
                  {editingIndex === i && (
                    <span className="ml-2 rounded bg-brand-solid px-1.5 py-0.5 text-[10px] font-medium text-white">
                      upravuje se
                    </span>
                  )}
                  <span className="ml-2 text-xs text-zinc-500">{r.summary}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => handleEditRule(i)}
                    className="text-xs text-brand hover:underline"
                  >
                    upravit
                  </button>
                  <button
                    onClick={() => handleRemoveRule(i)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    odebrat
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className={`mb-3 ${STEP_EYEBROW}`}>
          {editingIndex === null ? "Přidat KPI do šablony" : "Upravit pravidlo"}
        </h2>

        <label className="mb-3 flex flex-col gap-1 text-sm">
          KPI
          <select
            value={selectedKpiId}
            onChange={(e) => handleSelectKpi(e.target.value)}
            disabled={editingIndex !== null}
            className={`${SELECT_INPUT} disabled:opacity-60`}
          >
            <option value="">— vyber KPI —</option>
            {/* Seskupené po oblastech - plochý seznam přes 30 položek se
                neprochází, viz stejné řešení v ručním zápisu hodnoty. */}
            {groupByCategory(kpiDefinitions).map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.unit}){k.is_derived ? " — odvozené" : ""}
                  </option>
                ))}
              </optgroup>
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
            kpiName={selectedKpi.name}
            headers={headers}
            rows={sampleRows}
            dateColumn={dateColumn === "none" ? null : dateColumn}
            periodType={periodType}
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
              {headers.map((h) => (
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
                {headers.map((h) => (
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
                {headers.map((h) => (
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
            {periodSourceNote(selectedKpi.code) && (
              <p className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-xs leading-5 text-brand-ink dark:text-zinc-200">
                {periodSourceNote(selectedKpi.code)}
              </p>
            )}
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
                  {headers.map((h) => (
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
            <div className="flex items-center gap-3">
              <button onClick={handleAddRule} className={PRIMARY_BUTTON}>
                {editingIndex === null ? "Přidat pravidlo do šablony" : "Uložit změny"}
              </button>
              {editingIndex !== null && (
                <button
                  onClick={resetKpiForm}
                  className="text-sm text-zinc-500 hover:text-brand"
                >
                  Zrušit úpravu
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className={`mb-3 ${STEP_EYEBROW}`}>
            {isEditing ? "Uložit změny" : "Uložit šablonu"}
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
          {!isEditing && (
            <label className="mb-4 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={importData}
                onChange={(e) => setImportData(e.target.checked)}
                className="mt-0.5 accent-brand"
              />
              <span>
                Rovnou nahrát data z tohoto souboru
                {file && <span className="text-zinc-400"> ({file.name})</span>}
                <span className="mt-0.5 block text-xs text-zinc-400">
                  Čísla z náhledu se uloží do přehledu KPI. Když je později opravíš,
                  stačí soubor nahrát znovu.
                </span>
              </span>
            </label>
          )}

          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Varování při úpravě - historie se nepřepočítá, viz handleUpdateTemplate. */}
          {confirmingEdit ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-1 text-sm font-medium text-amber-900 dark:text-amber-200">
                Změna se projeví až u dalšího nahrání
              </p>
              <p className="mb-4 text-sm leading-6 text-amber-800 dark:text-amber-300">
                Hodnoty, které už máš v přehledu KPI, zůstanou spočítané podle
                původního nastavení šablony — <strong>zpětně se nepřepočítají</strong>.
                Pokud chceš mít i historii podle nového nastavení, nahraj po uložení
                původní soubory znovu.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleUpdateTemplate}
                  disabled={saving}
                  className={PRIMARY_BUTTON}
                >
                  {saving ? "Ukládám…" : "Rozumím, uložit změny"}
                </button>
                <button
                  onClick={() => setConfirmingEdit(false)}
                  className={SECONDARY_BUTTON}
                >
                  Zpět k úpravám
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => (isEditing ? setConfirmingEdit(true) : handleSaveTemplate())}
              disabled={saving || !templateName.trim()}
              className={PRIMARY_BUTTON}
            >
              {saving
                ? "Ukládám…"
                : isEditing
                  ? "Uložit změny šablony"
                  : importData
                    ? "Uložit šablonu a nahrát data"
                    : "Uložit šablonu"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
