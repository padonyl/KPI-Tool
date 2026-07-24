"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile, type ParsedFile } from "@/lib/parse-file";
import { parseNumber, parseDateValue, todayIso } from "@/lib/parse-values";
import {
  fetchExistingCurrentValues,
  findConflicts,
  writeKpiValues,
  type CandidateValue,
  type Conflict,
} from "@/lib/kpi-value-writer";
import { FileDropzone } from "@/components/FileDropzone";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SELECT_INPUT_SM, BACK_LINK, SPINNER, STEP_EYEBROW } from "@/lib/ui-classes";

type KpiDefinition = {
  id: string;
  code: string;
  name: string;
  unit: string;
  value_type: string;
};

type ColumnMapping = {
  source_column_name: string;
  kpi_definition_id: string | null;
  is_date_column: boolean;
};

type NewChoice = "ignore" | "date" | string; // string = kpi_definition_id

type Props = {
  companyId: string;
  userId: string;
  kpiDefinitions: KpiDefinition[];
  existingMappings: ColumnMapping[];
};

export function UploadForm({
  companyId,
  userId,
  kpiDefinitions,
  existingMappings: initialMappings,
}: Props) {
  // stav, ne jen prop - jinak by appka po prvním namapování v rámci
  // jedné návštěvy pořád "nevěděla" o nově uložených sloupcích a
  // ptala by se na mapování znovu při každém dalším nahrání, dokud
  // by se stránka ručně neobnovila
  const [existingMappings, setExistingMappings] =
    useState<ColumnMapping[]>(initialMappings);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [step, setStep] = useState<
    "select" | "mapping" | "confirm-conflicts" | "processing" | "done" | "error"
  >("select");
  const [newChoices, setNewChoices] = useState<Record<string, NewChoice>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<
    CandidateValue[]
  >([]);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const kpiById = new Map(kpiDefinitions.map((k) => [k.id, k]));

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);

    let result: ParsedFile;
    try {
      result = await parseFile(selected);
    } catch {
      setError(
        "Soubor se nepodařilo přečíst. Zkontroluj, že je to platný CSV nebo Excel soubor.",
      );
      setStep("error");
      return;
    }
    setParsed(result);

    const knownHeaders = new Set(
      existingMappings.map((m) => m.source_column_name),
    );
    const unmapped = result.headers.filter((h) => !knownHeaders.has(h));

    if (unmapped.length > 0) {
      const defaults: Record<string, NewChoice> = {};
      unmapped.forEach((h) => (defaults[h] = "ignore"));
      setNewChoices(defaults);
      setStep("mapping");
    } else {
      await processFile(result, existingMappings, selected);
    }
  }

  async function handleConfirmMapping() {
    const supabase = createClient();
    const rowsToInsert = Object.entries(newChoices).map(
      ([sourceColumnName, choice]) => ({
        company_id: companyId,
        source_column_name: sourceColumnName,
        is_date_column: choice === "date",
        kpi_definition_id:
          choice === "date" || choice === "ignore" ? null : choice,
      }),
    );

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("column_mappings")
        .insert(rowsToInsert);

      if (insertError) {
        setError(`Nepodařilo se uložit mapování: ${insertError.message}`);
        setStep("error");
        return;
      }
    }

    const allMappings = [...existingMappings, ...rowsToInsert];
    setExistingMappings(allMappings);
    if (parsed && file) {
      await processFile(parsed, allMappings, file);
    }
  }

  async function processFile(
    result: ParsedFile,
    allMappings: ColumnMapping[],
    theFile: File,
  ) {
    setStep("processing");
    setError(null);

    const supabase = createClient();
    const dateMapping = allMappings.find((m) => m.is_date_column);
    const kpiMappings = allMappings.filter(
      (m) => !m.is_date_column && m.kpi_definition_id,
    );

    // 1) sestavit kandidáty hodnot ze všech řádků souboru
    const candidates: CandidateValue[] = [];
    for (const row of result.rows) {
      let periodEnd: string | null;
      let periodType: string;

      if (dateMapping) {
        const rawDate = row[dateMapping.source_column_name] ?? "";
        periodEnd = parseDateValue(rawDate);
        periodType = "month";
        if (!periodEnd) continue; // řádek bez čitelného data přeskočit
      } else {
        periodEnd = todayIso();
        periodType = "day";
      }

      for (const mapping of kpiMappings) {
        const kpi = kpiById.get(mapping.kpi_definition_id!);
        if (!kpi) continue;
        const raw = row[mapping.source_column_name] ?? "";
        const value = parseNumber(raw);
        if (value === null) continue;

        candidates.push({
          kpiDefinitionId: kpi.id,
          kpiName: kpi.name,
          value,
          periodEnd,
          periodType,
        });
      }
    }

    if (candidates.length === 0) {
      setError(
        "V souboru se nenašla žádná čitelná data k uložení (zkontroluj mapování a formát čísel/data).",
      );
      setStep("error");
      return;
    }

    // 2) nahrát soubor do Storage
    const path = `${companyId}/${Date.now()}_${theFile.name}`;
    const { error: storageError } = await supabase.storage
      .from("company-uploads")
      .upload(path, theFile);

    if (storageError) {
      setError(`Nepodařilo se nahrát soubor: ${storageError.message}`);
      setStep("error");
      return;
    }

    // 3) založit záznam uploadu
    const { data: uploadRow, error: uploadInsertError } = await supabase
      .from("uploads")
      .insert({
        company_id: companyId,
        uploaded_by: userId,
        file_name: theFile.name,
        storage_path: path,
        status: "pending",
      })
      .select("id")
      .single();

    if (uploadInsertError || !uploadRow) {
      setError(
        `Nepodařilo se založit záznam nahrání: ${uploadInsertError?.message}`,
      );
      setStep("error");
      return;
    }

    // 4) zjistit, jestli už pro některé (kpi, období) existuje aktuální hodnota
    const kpiIds = [...new Set(candidates.map((c) => c.kpiDefinitionId))];
    const { existingByKey, error: existingError } =
      await fetchExistingCurrentValues(companyId, kpiIds);

    if (existingError) {
      setError(`Nepodařilo se ověřit existující data: ${existingError}`);
      setStep("error");
      return;
    }

    const foundConflicts = findConflicts(candidates, existingByKey);

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setPendingCandidates(candidates);
      setPendingUploadId(uploadRow.id);
      setStep("confirm-conflicts");
      return;
    }

    const { error: writeError } = await writeKpiValues(
      companyId,
      candidates,
      uploadRow.id,
      existingByKey,
    );
    if (writeError) {
      setError(writeError);
      setStep("error");
      return;
    }

    await finishUpload(uploadRow.id, candidates.length);
  }

  async function finishUpload(uploadId: string, count: number) {
    const supabase = createClient();
    await supabase
      .from("uploads")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", uploadId);

    setSummary(`Uloženo ${count} hodnot.`);
    setStep("done");
  }

  async function handleConfirmConflicts(overwrite: boolean) {
    if (!pendingUploadId) return;

    if (!overwrite) {
      await createClient()
        .from("uploads")
        .update({ status: "error", error_message: "Zrušeno uživatelem (konflikt období)" })
        .eq("id", pendingUploadId);
      setStep("select");
      setFile(null);
      setParsed(null);
      return;
    }

    const kpiIds = [...new Set(pendingCandidates.map((c) => c.kpiDefinitionId))];
    const { existingByKey, error: existingError } =
      await fetchExistingCurrentValues(companyId, kpiIds);

    if (existingError) {
      setError(`Nepodařilo se ověřit existující data: ${existingError}`);
      setStep("error");
      return;
    }

    const { error: writeError } = await writeKpiValues(
      companyId,
      pendingCandidates,
      pendingUploadId,
      existingByKey,
    );
    if (writeError) {
      setError(writeError);
      setStep("error");
      return;
    }

    await finishUpload(pendingUploadId, pendingCandidates.length);
  }

  const stepLabels: Record<string, string> = {
    select: "1. Vyber soubor",
    mapping: "2. Namapuj sloupce",
    "confirm-conflicts": "3. Potvrď přepsání",
    processing: "Zpracovávám…",
    done: "Hotovo",
    error: "Nastala chyba",
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <h2 className={`mb-6 ${STEP_EYEBROW}`}>{stepLabels[step]}</h2>

      {step === "done" && (
        <div className="flex flex-col items-start gap-4">
          <SuccessBanner>{summary}</SuccessBanner>
          <Link href="/upload" className={PRIMARY_BUTTON}>
            Nahrát další data
          </Link>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-4">
          <ErrorBanner>{error}</ErrorBanner>
          <button
            onClick={() => {
              setStep("select");
              setFile(null);
              setParsed(null);
            }}
            className={`self-start ${PRIMARY_BUTTON}`}
          >
            Zkusit znovu
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className={SPINNER} />
          Zpracovávám soubor a ukládám hodnoty…
        </div>
      )}

      {step === "confirm-conflicts" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pro tato období už existuje uložená hodnota. Chceš je nahradit
            (vytvoří se nová verze), nebo nahrání zrušit?
          </p>
          <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {conflicts.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{c.kpiName}</span>
                  <span className="ml-2 text-zinc-500">{c.periodEnd}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500 line-through">
                    {c.oldValue}
                  </span>
                  <span>→</span>
                  <span className="font-semibold">{c.newValue}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button onClick={() => handleConfirmConflicts(true)} className={PRIMARY_BUTTON}>
              Přepsat všechny
            </button>
            <button onClick={() => handleConfirmConflicts(false)} className={SECONDARY_BUTTON}>
              Zrušit nahrání
            </button>
          </div>
        </div>
      )}

      {step === "mapping" && parsed && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tyhle sloupce v souboru aplikace ještě nezná — přiřaď jim význam.
            Příště už si je zapamatuje.
          </p>
          <div className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {Object.keys(newChoices).map((header) => (
              <div
                key={header}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="truncate text-sm font-medium">
                  {header}
                </span>
                <select
                  value={newChoices[header]}
                  onChange={(e) =>
                    setNewChoices((prev) => ({
                      ...prev,
                      [header]: e.target.value,
                    }))
                  }
                  className={SELECT_INPUT_SM}
                >
                  <option value="ignore">— ignorovat —</option>
                  <option value="date">— toto je datum —</option>
                  {kpiDefinitions.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.unit})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={handleConfirmMapping} className={PRIMARY_BUTTON}>
              Uložit mapování a pokračovat
            </button>
            <button
              onClick={() => {
                setStep("select");
                setFile(null);
                setParsed(null);
              }}
              className={SECONDARY_BUTTON}
            >
              Zpět
            </button>
          </div>
        </div>
      )}

      {step === "select" && (
        <div className="flex flex-col gap-4">
          <Link href="/upload" className={`self-start ${BACK_LINK}`}>
            ← Zpět na rozcestník
          </Link>
          <FileDropzone file={file} onFileSelected={handleFileSelected} />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
