"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile, type ParsedFile } from "@/lib/parse-file";
import { parseNumber, parseDateValue, endOfMonthIso } from "@/lib/parse-values";
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
import { formatNumber } from "@/lib/format-number";

type Direction = "inbound" | "outbound";

type DeliveryMapping = {
  source_column_name: string;
  role: string;
};

type Tolerance = {
  direction: string;
  on_time_tolerance_days: number;
  in_full_tolerance_pct: number;
};

type Props = {
  companyId: string;
  userId: string;
  existingMappings: DeliveryMapping[];
  tolerances: Tolerance[];
  otifKpiByDirection: { inbound: string | null; outbound: string | null };
};

const ROLE_LABELS: Record<string, string> = {
  requested_date: "Slíbený termín",
  actual_date: "Reálný termín",
  requested_qty: "Slíbené množství",
  actual_qty: "Reálné množství",
  order_reference: "Číslo zakázky",
  ignore: "— ignorovat —",
};

const DIRECTION_LABELS: Record<Direction, string> = {
  inbound: "Dodávky od dodavatelů (nákup)",
  outbound: "Dodávky zákazníkům (prodej)",
};

export function DeliveriesUploadForm({
  companyId,
  userId,
  existingMappings: initialMappings,
  tolerances,
  otifKpiByDirection,
}: Props) {
  // stav, ne jen prop - stejný důvod jako u UploadForm.tsx (KPI upload):
  // jinak by appka po prvním namapování v rámci jedné návštěvy
  // nevěděla o nově uložených sloupcích až do obnovení stránky
  const [existingMappings, setExistingMappings] =
    useState<DeliveryMapping[]>(initialMappings);
  const [direction, setDirection] = useState<Direction>("outbound");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [step, setStep] = useState<
    "select" | "mapping" | "confirm-conflicts" | "processing" | "done" | "error"
  >("select");
  const [newChoices, setNewChoices] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<
    CandidateValue[]
  >([]);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

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
      const defaults: Record<string, string> = {};
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
      ([sourceColumnName, role]) => ({
        company_id: companyId,
        source_column_name: sourceColumnName,
        role,
      }),
    );

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("delivery_column_mappings")
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
    allMappings: DeliveryMapping[],
    theFile: File,
  ) {
    setStep("processing");
    setError(null);

    const roleByHeader = new Map(
      allMappings.map((m) => [m.source_column_name, m.role]),
    );
    const headerForRole = (role: string) =>
      result.headers.find((h) => roleByHeader.get(h) === role);

    const requestedDateHeader = headerForRole("requested_date");
    const actualDateHeader = headerForRole("actual_date");
    const requestedQtyHeader = headerForRole("requested_qty");
    const actualQtyHeader = headerForRole("actual_qty");

    if (
      !requestedDateHeader ||
      !actualDateHeader ||
      !requestedQtyHeader ||
      !actualQtyHeader
    ) {
      setError(
        "Chybí namapování slíbeného/reálného termínu nebo množství — bez těchto čtyř sloupců nejde OTIF spočítat.",
      );
      setStep("error");
      return;
    }

    // 1) sestavit řádky dodávek ze souboru
    const deliveryRows: {
      requested_date: string;
      actual_date: string;
      requested_qty: number;
      actual_qty: number;
    }[] = [];

    for (const row of result.rows) {
      const requestedDate = parseDateValue(row[requestedDateHeader] ?? "");
      const actualDate = parseDateValue(row[actualDateHeader] ?? "");
      const requestedQty = parseNumber(row[requestedQtyHeader] ?? "");
      const actualQty = parseNumber(row[actualQtyHeader] ?? "");

      if (
        !requestedDate ||
        !actualDate ||
        requestedQty === null ||
        actualQty === null
      ) {
        continue; // řádek s nečitelnými daty přeskočit
      }

      deliveryRows.push({
        requested_date: requestedDate,
        actual_date: actualDate,
        requested_qty: requestedQty,
        actual_qty: actualQty,
      });
    }

    if (deliveryRows.length === 0) {
      setError(
        "V souboru se nenašly žádné čitelné řádky (zkontroluj formát dat a čísel).",
      );
      setStep("error");
      return;
    }

    const supabase = createClient();

    // 2) nahrát soubor do Storage
    const path = `${companyId}/deliveries_${Date.now()}_${theFile.name}`;
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

    // 4) uložit syrové řádky dodávek
    const { error: deliveriesInsertError } = await supabase
      .from("deliveries")
      .insert(
        deliveryRows.map((r) => ({
          ...r,
          company_id: companyId,
          direction,
          source_upload_id: uploadRow.id,
        })),
      );

    if (deliveriesInsertError) {
      setError(
        `Nepodařilo se uložit řádky dodávek: ${deliveriesInsertError.message}`,
      );
      setStep("error");
      return;
    }

    // 5) spočítat OTIF podle tolerance firmy, agregovat po měsících
    const tolerance = tolerances.find((t) => t.direction === direction) ?? {
      on_time_tolerance_days: 0,
      in_full_tolerance_pct: 100,
    };

    const buckets = new Map<string, { total: number; otifCount: number }>();
    for (const d of deliveryRows) {
      const diffMs =
        new Date(d.actual_date).getTime() - new Date(d.requested_date).getTime();
      const diffDays = Math.abs(diffMs / (1000 * 60 * 60 * 24));
      const onTime = diffDays <= tolerance.on_time_tolerance_days;
      const inFull =
        d.actual_qty >= d.requested_qty * (tolerance.in_full_tolerance_pct / 100);
      const otif = onTime && inFull;

      const periodEnd = endOfMonthIso(d.requested_date);
      const bucket = buckets.get(periodEnd) ?? { total: 0, otifCount: 0 };
      bucket.total += 1;
      if (otif) bucket.otifCount += 1;
      buckets.set(periodEnd, bucket);
    }

    const kpiId = otifKpiByDirection[direction];
    if (!kpiId) {
      setError(
        "Chybí KPI definice pro OTIF tohoto směru v databázi — kontaktuj administrátora.",
      );
      setStep("error");
      return;
    }

    const kpiName =
      direction === "inbound" ? "OTIF dodavatelů" : "OTIF zákazníkům";

    const candidates: CandidateValue[] = [...buckets.entries()].map(
      ([periodEnd, b]) => ({
        kpiDefinitionId: kpiId,
        kpiName,
        value: Math.round((b.otifCount / b.total) * 1000) / 10,
        periodEnd,
        periodType: "month",
      }),
    );

    // 6) stejný postup jako u běžného uploadu - zjistit konflikty, zapsat
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

    await finishUpload(uploadRow.id, deliveryRows.length, candidates.length);
  }

  async function finishUpload(
    uploadId: string,
    deliveryCount: number,
    periodCount: number,
  ) {
    const supabase = createClient();
    await supabase
      .from("uploads")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", uploadId);

    setSummary(
      `Uloženo ${deliveryCount} dodávek, spočítáno OTIF pro ${periodCount} období.`,
    );
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

    await finishUpload(pendingUploadId, 0, pendingCandidates.length);
  }

  const stepLabels: Record<string, string> = {
    select: "1. Vyber směr a soubor",
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
          Zpracovávám soubor a počítám OTIF…
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
                    {formatNumber(c.oldValue)} %
                  </span>
                  <span>→</span>
                  <span className="font-semibold">{formatNumber(c.newValue)} %</span>
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
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
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
        <div className="flex flex-col gap-6">
          <Link href="/upload" className={`self-start ${BACK_LINK}`}>
            ← Zpět na rozcestník
          </Link>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Směr dodávek</span>
            <div className="flex gap-4">
              {(Object.keys(DIRECTION_LABELS) as Direction[]).map((d) => (
                <label
                  key={d}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="direction"
                    checked={direction === d}
                    onChange={() => setDirection(d)}
                    className="accent-brand"
                  />
                  {DIRECTION_LABELS[d]}
                </label>
              ))}
            </div>
          </div>

          <FileDropzone file={file} onFileSelected={handleFileSelected} />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
