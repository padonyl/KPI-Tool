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
  type UploadRule,
  type StagedUpload,
} from "@/lib/run-upload";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, BACK_LINK, SPINNER, STEP_EYEBROW } from "@/lib/ui-classes";
import { formatPeriod } from "@/lib/format-period";

type Props = {
  companyId: string;
  userId: string;
  template: { id: string; dateColumnName: string | null; periodType: string };
  rules: UploadRule[];
};

export function TemplateUploadForm({ companyId, userId, template, rules }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<
    "select" | "processing" | "confirm-conflicts" | "done" | "error"
  >("select");
  const [staged, setStaged] = useState<StagedUpload | null>(null);
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

    const { candidates, deliveryInserts } = computeCandidates(
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

      {step === "confirm-conflicts" && staged && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pro tato období už existuje uložená hodnota. Přepsat, nebo zrušit?
          </p>
          <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {staged.conflicts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className="font-medium">{c.kpiName}</span>
                  <span className="ml-2 text-zinc-500">
                    {formatPeriod(c.periodEnd, c.periodType)}
                  </span>
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
