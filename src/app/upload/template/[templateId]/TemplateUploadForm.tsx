"use client";

import { useState } from "react";
import Link from "next/link";
import { parseFile } from "@/lib/parse-file";
import { FileDropzone } from "@/components/FileDropzone";
import {
  computeCandidates,
  validateCandidates,
  stageUpload,
  commitUpload,
  abandonUpload,
  totalSkipped,
  type UploadRule,
  type StagedUpload,
  type SkippedRows,
} from "@/lib/run-upload";
import { SkippedRowsNotice } from "@/components/forms/SkippedRowsNotice";
import { ConflictList } from "@/components/forms/ConflictList";
import type { CandidateValue } from "@/lib/kpi-value-writer";
import type { DeliveryInsert } from "@/lib/run-upload";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, BACK_LINK, SPINNER, STEP_EYEBROW } from "@/lib/ui-classes";

type Props = {
  companyId: string;
  userId: string;
  template: { id: string; dateColumnName: string | null; periodType: string };
  rules: UploadRule[];
};

export function TemplateUploadForm({ companyId, userId, template, rules }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<
    "select" | "processing" | "confirm-skipped" | "confirm-conflicts" | "done" | "error"
  >("select");
  const [staged, setStaged] = useState<StagedUpload | null>(null);
  /** Řádky, které se nepodařilo přečíst - o jejich vynechání rozhoduje uživatel. */
  const [skipped, setSkipped] = useState<SkippedRows | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingWork, setPendingWork] = useState<{
    candidates: CandidateValue[];
    deliveryInserts: DeliveryInsert[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
    setStep("processing");

    let parsed;
    try {
      parsed = await parseFile(selected);
    } catch {
      setError(
        "Soubor se nepodařilo přečíst. Zkontroluj, že je to platný CSV nebo Excel soubor.",
      );
      setStep("error");
      return;
    }

    const { candidates, deliveryInserts, skipped: skippedRows } = computeCandidates(
      parsed.rows,
      template.dateColumnName,
      template.periodType,
      rules,
      companyId,
    );

    if (candidates.length === 0) {
      setError(
        "V souboru se nenašla žádná čitelná data k uložení (zkontroluj, jestli soubor odpovídá téhle šabloně).",
      );
      setStep("error");
      return;
    }

    const validationError = validateCandidates(candidates, rules);
    if (validationError) {
      setError(validationError);
      setStep("error");
      return;
    }

    // Nejdřív se zeptat na vyřazené řádky - do Storage a do databáze se sahá
    // až potom, ať se po zrušení nemusí nic uklízet.
    if (totalSkipped(skippedRows) > 0) {
      setSkipped(skippedRows);
      setPendingFile(selected);
      setPendingWork({ candidates, deliveryInserts });
      setStep("confirm-skipped");
      return;
    }

    await stageAndContinue(selected, candidates, deliveryInserts);
  }

  async function stageAndContinue(
    selected: File,
    candidates: CandidateValue[],
    deliveryInserts: DeliveryInsert[],
  ) {
    setStep("processing");
    const { staged: result, error: stageError } = await stageUpload({
      companyId,
      userId,
      file: selected,
      candidates,
      deliveryInserts,
      pathPrefix: "template",
    });

    if (stageError || !result) {
      setError(stageError);
      setStep("error");
      return;
    }

    if (result.conflicts.length > 0) {
      setStaged(result);
      setStep("confirm-conflicts");
      return;
    }

    await finish(result);
  }

  async function finish(toCommit: StagedUpload) {
    const { error: commitError } = await commitUpload({
      companyId,
      userId,
      staged: toCommit,
      activityMetadata: { template_id: template.id },
    });

    if (commitError) {
      setError(commitError);
      setStep("error");
      return;
    }

    setSummary(`Uloženo ${toCommit.candidates.length} hodnot napříč ${rules.length} KPI.`);
    setStep("done");
  }

  async function handleConfirmConflicts(overwrite: boolean) {
    if (!staged) return;

    if (!overwrite) {
      await abandonUpload(staged.uploadId, "Zrušeno uživatelem (konflikt období)");
      setStaged(null);
      setFile(null);
      setStep("select");
      return;
    }

    setStep("processing");
    await finish(staged);
  }

  const stepLabels: Record<string, string> = {
    select: "Vyber soubor",
    processing: "Zpracovávám…",
    "confirm-skipped": "Zkontroluj vynechané řádky",
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

      {step === "confirm-skipped" && skipped && (
        <SkippedRowsNotice
          skipped={skipped}
          onContinue={() => {
            if (pendingFile && pendingWork) {
              stageAndContinue(pendingFile, pendingWork.candidates, pendingWork.deliveryInserts);
            }
          }}
          onCancel={() => {
            setSkipped(null);
            setPendingFile(null);
            setPendingWork(null);
            setFile(null);
            setStep("select");
          }}
        />
      )}

      {step === "confirm-conflicts" && staged && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pro tato období už existuje uložená hodnota. Přepsat, nebo zrušit?
          </p>
          <ConflictList conflicts={staged.conflicts} sourceName={file?.name ?? "nahraný soubor"} />
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
          <div className="flex gap-3">
            <Link href="/kpis" className={PRIMARY_BUTTON}>
              Zobrazit přehled KPI
            </Link>
            <Link href="/upload" className={SECONDARY_BUTTON}>
              Nahrát další data
            </Link>
          </div>
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
