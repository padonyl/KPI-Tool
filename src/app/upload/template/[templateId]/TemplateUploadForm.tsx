"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseFile } from "@/lib/parse-file";
import { FileDropzone } from "@/components/FileDropzone";
import {
  computeDirectCandidates,
  computeAggregatedCandidates,
  computeToleranceDerivedCandidates,
  type RuleType,
  type RuleConfig,
  type DirectConfig,
  type AggregatedConfig,
  type ToleranceDerivedConfig,
} from "@/lib/template-rules";
import {
  fetchExistingCurrentValues,
  findConflicts,
  writeKpiValues,
  type CandidateValue,
  type Conflict,
} from "@/lib/kpi-value-writer";
import { logActivity } from "@/lib/log-activity";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, BACK_LINK, SPINNER, STEP_EYEBROW } from "@/lib/ui-classes";
import { checkKpiValue } from "@/lib/kpi-value-validation";

type Rule = {
  kpiDefinitionId: string;
  kpiName: string;
  kpiCode: string;
  kpiUnit: string;
  ruleType: RuleType;
  config: RuleConfig;
};

type Props = {
  companyId: string;
  userId: string;
  template: { id: string; dateColumnName: string | null; periodType: string };
  rules: Rule[];
};

export function TemplateUploadForm({ companyId, userId, template, rules }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<
    "select" | "processing" | "confirm-conflicts" | "done" | "error"
  >("select");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<CandidateValue[]>([]);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
    setStep("processing");

    let result;
    try {
      result = await parseFile(selected);
    } catch {
      setError(
        "Soubor se nepodařilo přečíst. Zkontroluj, že je to platný CSV nebo Excel soubor.",
      );
      setStep("error");
      return;
    }
    const supabase = createClient();

    let allCandidates: CandidateValue[] = [];
    const deliveryInserts: {
      company_id: string;
      direction: string;
      requested_date: string;
      actual_date: string;
      requested_qty: number;
      actual_qty: number;
    }[] = [];

    for (const rule of rules) {
      if (rule.ruleType === "direct") {
        allCandidates = allCandidates.concat(
          computeDirectCandidates(
            result.rows,
            template.dateColumnName,
            template.periodType,
            rule.config as DirectConfig,
            rule.kpiDefinitionId,
            rule.kpiName,
          ),
        );
      } else if (rule.ruleType === "aggregated") {
        allCandidates = allCandidates.concat(
          computeAggregatedCandidates(
            result.rows,
            template.dateColumnName,
            template.periodType,
            rule.config as AggregatedConfig,
            rule.kpiDefinitionId,
            rule.kpiName,
          ),
        );
      } else {
        const direction = rule.kpiCode === "otif_dodavatele" ? "inbound" : "outbound";
        const { candidates, deliveryRows } = computeToleranceDerivedCandidates(
          result.rows,
          rule.config as ToleranceDerivedConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        );
        allCandidates = allCandidates.concat(candidates);
        deliveryInserts.push(
          ...deliveryRows.map((d) => ({ company_id: companyId, direction, ...d })),
        );
      }
    }

    if (allCandidates.length === 0) {
      setError(
        "V souboru se nenašla žádná čitelná data k uložení (zkontroluj, jestli soubor odpovídá téhle šabloně).",
      );
      setStep("error");
      return;
    }

    // Lehká validace rozsahu (procentuální KPI 0-100) - viz kpi-value-validation.ts
    const unitByKpiId = new Map(rules.map((r) => [r.kpiDefinitionId, r.kpiUnit]));
    const badValues = allCandidates
      .map((c) => ({ c, reason: checkKpiValue(c.value, unitByKpiId.get(c.kpiDefinitionId)) }))
      .filter((x) => x.reason !== null);
    if (badValues.length > 0) {
      const preview = badValues
        .slice(0, 5)
        .map((x) => `${x.c.kpiName} (${x.c.periodEnd}): ${x.c.value} — ${x.reason}`)
        .join("; ");
      setError(
        `Některé dopočítané hodnoty vypadají chybně (${badValues.length}): ${preview}${badValues.length > 5 ? " …" : ""}. Zkontroluj soubor a nastavení šablony.`,
      );
      setStep("error");
      return;
    }

    const path = `${companyId}/template_${Date.now()}_${selected.name}`;
    const { error: storageError } = await supabase.storage
      .from("company-uploads")
      .upload(path, selected);

    if (storageError) {
      setError(`Nepodařilo se nahrát soubor: ${storageError.message}`);
      setStep("error");
      return;
    }

    const { data: uploadRow, error: uploadInsertError } = await supabase
      .from("uploads")
      .insert({
        company_id: companyId,
        uploaded_by: userId,
        file_name: selected.name,
        storage_path: path,
        status: "pending",
      })
      .select("id")
      .single();

    if (uploadInsertError || !uploadRow) {
      setError(`Nepodařilo se založit záznam nahrání: ${uploadInsertError?.message}`);
      setStep("error");
      return;
    }

    if (deliveryInserts.length > 0) {
      const { error: deliveriesError } = await supabase.from("deliveries").insert(
        deliveryInserts.map((d) => ({ ...d, source_upload_id: uploadRow.id })),
      );
      if (deliveriesError) {
        setError(`Nepodařilo se uložit řádky dodávek: ${deliveriesError.message}`);
        setStep("error");
        return;
      }
    }

    const kpiIds = [...new Set(allCandidates.map((c) => c.kpiDefinitionId))];
    const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
      companyId,
      kpiIds,
    );

    if (existingError) {
      setError(`Nepodařilo se ověřit existující data: ${existingError}`);
      setStep("error");
      return;
    }

    const foundConflicts = findConflicts(allCandidates, existingByKey);

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setPendingCandidates(allCandidates);
      setPendingUploadId(uploadRow.id);
      setStep("confirm-conflicts");
      return;
    }

    const { error: writeError } = await writeKpiValues(
      companyId,
      allCandidates,
      uploadRow.id,
      existingByKey,
    );
    if (writeError) {
      setError(writeError);
      setStep("error");
      return;
    }

    await finishUpload(uploadRow.id, allCandidates.length);
  }

  async function finishUpload(uploadId: string, count: number) {
    const supabase = createClient();
    await supabase
      .from("uploads")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", uploadId);

    await logActivity(supabase, {
      companyId,
      userId,
      action: "upload.completed",
      metadata: { template_id: template.id, values_count: count },
    });

    setSummary(`Uloženo ${count} hodnot napříč ${rules.length} KPI.`);
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
      return;
    }

    const kpiIds = [...new Set(pendingCandidates.map((c) => c.kpiDefinitionId))];
    const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
      companyId,
      kpiIds,
    );
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
    select: "Vyber soubor",
    processing: "Zpracovávám…",
    "confirm-conflicts": "Potvrď přepsání",
    done: "Hotovo",
    error: "Nastala chyba",
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <h2 className={`mb-6 ${STEP_EYEBROW}`}>{stepLabels[step]}</h2>

      {step === "select" && (
        <div className="flex flex-col gap-4">
          <Link href="/templates" className={`self-start ${BACK_LINK}`}>
            ← Zpět na šablony
          </Link>
          <FileDropzone file={file} onFileSelected={handleFileSelected} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {step === "processing" && (
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className={SPINNER} />
          Zpracovávám soubor podle šablony…
        </div>
      )}

      {step === "confirm-conflicts" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pro tato období už existuje uložená hodnota. Přepsat, nebo zrušit?
          </p>
          <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {conflicts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className="font-medium">{c.kpiName}</span>
                  <span className="ml-2 text-zinc-500">{c.periodEnd}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500 line-through">{c.oldValue}</span>
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
            }}
            className={`self-start ${PRIMARY_BUTTON}`}
          >
            Zkusit znovu
          </button>
        </div>
      )}
    </div>
  );
}
