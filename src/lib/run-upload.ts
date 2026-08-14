import { createClient } from "@/lib/supabase/client";
import {
  computeDirectCandidates,
  computeAggregatedCandidates,
  computeToleranceDerivedCandidates,
  type RuleType,
  type RuleConfig,
  type DirectConfig,
  type AggregatedConfig,
  type ToleranceDerivedConfig,
  type ParsedRow,
} from "@/lib/template-rules";
import {
  computeFormulaCandidates,
  type FormulaSpec,
  type FormulaConfig,
} from "@/lib/formula";
import {
  fetchExistingCurrentValues,
  findConflicts,
  writeKpiValues,
  type CandidateValue,
  type Conflict,
} from "@/lib/kpi-value-writer";
import { logActivity } from "@/lib/log-activity";
import { checkKpiValue } from "@/lib/kpi-value-validation";

// ============================================================
// Sdílená nahrávací pipeline.
//
// Dřív žila jen uvnitř TemplateUploadForm. Vytažená ven proto, aby ji mohlo
// použít i zakládání šablony - uživatel tam nahraje vzorový soubor, vidí
// z něj spočítané součty, a bylo matoucí, že se ta data neuloží a musí
// nahrávat podruhé (podnět uživatele 2026-08-14).
// ============================================================

export type UploadRule = {
  kpiDefinitionId: string;
  kpiName: string;
  kpiCode: string;
  kpiUnit: string;
  formulaSpec: FormulaSpec | null;
  ruleType: RuleType;
  config: RuleConfig;
};

export type DeliveryInsert = {
  company_id: string;
  direction: string;
  requested_date: string;
  actual_date: string;
  requested_qty: number;
  actual_qty: number;
};

/** Spočítá hodnoty ze souboru podle pravidel šablony. Nic nezapisuje. */
export function computeCandidates(
  rows: ParsedRow[],
  dateColumnName: string | null,
  periodType: string,
  rules: UploadRule[],
  companyId: string,
): { candidates: CandidateValue[]; deliveryInserts: DeliveryInsert[] } {
  let candidates: CandidateValue[] = [];
  const deliveryInserts: DeliveryInsert[] = [];

  for (const rule of rules) {
    if (rule.ruleType === "formula") {
      if (!rule.formulaSpec) continue;
      candidates = candidates.concat(
        computeFormulaCandidates(
          rows,
          dateColumnName,
          periodType,
          rule.formulaSpec,
          rule.config as FormulaConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        ),
      );
    } else if (rule.ruleType === "direct") {
      candidates = candidates.concat(
        computeDirectCandidates(
          rows,
          dateColumnName,
          periodType,
          rule.config as DirectConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        ),
      );
    } else if (rule.ruleType === "aggregated") {
      candidates = candidates.concat(
        computeAggregatedCandidates(
          rows,
          dateColumnName,
          periodType,
          rule.config as AggregatedConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        ),
      );
    } else {
      const direction = rule.kpiCode === "otif_dodavatele" ? "inbound" : "outbound";
      const { candidates: otifCandidates, deliveryRows } =
        computeToleranceDerivedCandidates(
          rows,
          rule.config as ToleranceDerivedConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        );
      candidates = candidates.concat(otifCandidates);
      deliveryInserts.push(
        ...deliveryRows.map((d) => ({ company_id: companyId, direction, ...d })),
      );
    }
  }

  return { candidates, deliveryInserts };
}

/** Lehká kontrola rozsahu (procentuální KPI 0-100) - vrací hlášku, nebo null. */
export function validateCandidates(
  candidates: CandidateValue[],
  rules: UploadRule[],
): string | null {
  const unitByKpiId = new Map(rules.map((r) => [r.kpiDefinitionId, r.kpiUnit]));
  const bad = candidates
    .map((c) => ({ c, reason: checkKpiValue(c.value, unitByKpiId.get(c.kpiDefinitionId)) }))
    .filter((x) => x.reason !== null);

  if (bad.length === 0) return null;

  const preview = bad
    .slice(0, 5)
    .map((x) => `${x.c.kpiName} (${x.c.periodEnd}): ${x.c.value} — ${x.reason}`)
    .join("; ");
  return `Některé dopočítané hodnoty vypadají chybně (${bad.length}): ${preview}${
    bad.length > 5 ? " …" : ""
  }. Zkontroluj soubor a nastavení šablony.`;
}

export type StagedUpload = {
  uploadId: string;
  candidates: CandidateValue[];
  conflicts: Conflict[];
};

/**
 * Uloží soubor do Storage, založí záznam nahrání, zapíše řádky dodávek
 * a zjistí konflikty s už existujícími hodnotami. Samotné hodnoty ZATÍM
 * nezapisuje - o tom rozhoduje volající podle konfliktů (viz commitUpload).
 */
export async function stageUpload(params: {
  companyId: string;
  userId: string;
  file: File;
  candidates: CandidateValue[];
  deliveryInserts: DeliveryInsert[];
  /** Prefix názvu souboru ve Storage - odliší nahrání přes šablonu od založení šablony. */
  pathPrefix: string;
}): Promise<{ staged: StagedUpload | null; error: string | null }> {
  const supabase = createClient();
  const { companyId, userId, file, candidates, deliveryInserts, pathPrefix } = params;

  const path = `${companyId}/${pathPrefix}_${Date.now()}_${file.name}`;
  const { error: storageError } = await supabase.storage
    .from("company-uploads")
    .upload(path, file);
  if (storageError) {
    return { staged: null, error: `Nepodařilo se nahrát soubor: ${storageError.message}` };
  }

  const { data: uploadRow, error: uploadInsertError } = await supabase
    .from("uploads")
    .insert({
      company_id: companyId,
      uploaded_by: userId,
      file_name: file.name,
      storage_path: path,
      status: "pending",
    })
    .select("id")
    .single();

  if (uploadInsertError || !uploadRow) {
    return {
      staged: null,
      error: `Nepodařilo se založit záznam nahrání: ${uploadInsertError?.message}`,
    };
  }

  if (deliveryInserts.length > 0) {
    const { error: deliveriesError } = await supabase.from("deliveries").insert(
      deliveryInserts.map((d) => ({ ...d, source_upload_id: uploadRow.id })),
    );
    if (deliveriesError) {
      return {
        staged: null,
        error: `Nepodařilo se uložit řádky dodávek: ${deliveriesError.message}`,
      };
    }
  }

  const kpiIds = [...new Set(candidates.map((c) => c.kpiDefinitionId))];
  const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
    companyId,
    kpiIds,
  );
  if (existingError) {
    return { staged: null, error: `Nepodařilo se ověřit existující data: ${existingError}` };
  }

  return {
    staged: {
      uploadId: uploadRow.id,
      candidates,
      conflicts: findConflicts(candidates, existingByKey),
    },
    error: null,
  };
}

/** Zapíše hodnoty, označí nahrání za zpracované a zaloguje aktivitu. */
export async function commitUpload(params: {
  companyId: string;
  userId: string;
  staged: StagedUpload;
  activityMetadata: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { companyId, userId, staged, activityMetadata } = params;

  const kpiIds = [...new Set(staged.candidates.map((c) => c.kpiDefinitionId))];
  const { existingByKey, error: existingError } = await fetchExistingCurrentValues(
    companyId,
    kpiIds,
  );
  if (existingError) {
    return { error: `Nepodařilo se ověřit existující data: ${existingError}` };
  }

  const { error: writeError } = await writeKpiValues(
    companyId,
    staged.candidates,
    staged.uploadId,
    existingByKey,
  );
  if (writeError) return { error: writeError };

  await supabase
    .from("uploads")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("id", staged.uploadId);

  await logActivity(supabase, {
    companyId,
    userId,
    action: "upload.completed",
    metadata: { ...activityMetadata, values_count: staged.candidates.length },
  });

  return { error: null };
}

/** Zruší rozpracované nahrání (uživatel odmítl přepsat konflikty). */
export async function abandonUpload(uploadId: string, reason: string): Promise<void> {
  await createClient()
    .from("uploads")
    .update({ status: "error", error_message: reason })
    .eq("id", uploadId);
}
