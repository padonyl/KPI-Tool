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
  periodOfRow,
  type NespocitaneObdobi,
  findUnreadableDates,
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

/**
 * Řádky, které se do výpočtu nedostaly. Vyřazený řádek posune výsledek
 * (chybí v součtu, ředí průměr), takže o něm uživatel musí vědět dřív,
 * než data uloží.
 */
export type SkippedRows = {
  totalRows: number;
  /** Řádky s nečitelným datem - u nich se neví, do jakého období patří. */
  unreadableDate: number;
  /** Řádky vyřazené při výpočtu OTIF (chybí termín nebo množství). */
  incompleteDelivery: number;
  /** Ukázky problémových hodnot, ať uživatel ví, co v souboru hledat. */
  examples: string[];
};

export function totalSkipped(skipped: SkippedRows): number {
  return skipped.unreadableDate + skipped.incompleteDelivery;
}

/** Jeden syrový řádek k uložení pro rozpad KPI (tabulka source_rows). */
export type SourceRowInsert = {
  period_end: string;
  period_type: string;
  data: ParsedRow;
};

/**
 * Připraví syrové řádky k uložení pro pozdější rozpad KPI do detailu.
 *
 * Volá se JEN když má šablona zapnutý `store_rows` a NENÍ to HR šablona —
 * o tom rozhoduje volající (server spočítá efektivní příznak, viz stránka
 * nahrávání). Řádek bez čitelného období se vynechá: bez období by se do
 * rozpadu za dané období nedal zařadit.
 */
export function buildSourceRows(
  rows: ParsedRow[],
  dateColumnName: string | null,
  periodType: string,
): SourceRowInsert[] {
  const out: SourceRowInsert[] = [];
  for (const row of rows) {
    const period = periodOfRow(row, dateColumnName, periodType);
    if (!period) continue;
    out.push({ period_end: period.periodEnd, period_type: period.periodType, data: row });
  }
  return out;
}

/** Spočítá hodnoty ze souboru podle pravidel šablony. Nic nezapisuje. */
export function computeCandidates(
  rows: ParsedRow[],
  dateColumnName: string | null,
  periodType: string,
  rules: UploadRule[],
  companyId: string,
): {
  candidates: CandidateValue[];
  deliveryInserts: DeliveryInsert[];
  skipped: SkippedRows;
  /** Období, u kterých se KPI nepodařilo spočítat, i s důvodem. */
  nespocitane: NespocitaneObdobi[];
} {
  let candidates: CandidateValue[] = [];
  const deliveryInserts: DeliveryInsert[] = [];
  const nespocitane: NespocitaneObdobi[] = [];

  const usesTemplateDate = rules.some((r) => r.ruleType !== "tolerance_derived");
  const badDates = usesTemplateDate
    ? findUnreadableDates(rows, dateColumnName)
    : { count: 0, examples: [] };

  const skipped: SkippedRows = {
    totalRows: rows.length,
    unreadableDate: badDates.count,
    incompleteDelivery: 0,
    examples: [...badDates.examples],
  };

  for (const rule of rules) {
    if (rule.ruleType === "formula") {
      if (!rule.formulaSpec) continue;
      const vysledek = computeFormulaCandidates(
        rows,
        dateColumnName,
        periodType,
        rule.formulaSpec,
        rule.config as FormulaConfig,
        rule.kpiDefinitionId,
        rule.kpiName,
      );
      candidates = candidates.concat(vysledek.candidates);
      // Období, která nevyšla, se NEZAHAZUJÍ - putují nahoru k uživateli.
      nespocitane.push(...vysledek.nespocitane);
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
      const { candidates: otifCandidates, deliveryRows, skippedRows } =
        computeToleranceDerivedCandidates(
          rows,
          rule.config as ToleranceDerivedConfig,
          rule.kpiDefinitionId,
          rule.kpiName,
        );
      candidates = candidates.concat(otifCandidates);
      skipped.incompleteDelivery = Math.max(skipped.incompleteDelivery, skippedRows);
      deliveryInserts.push(
        ...deliveryRows.map((d) => ({ company_id: companyId, direction, ...d })),
      );
    }
  }

  return { candidates, deliveryInserts, skipped, nespocitane };
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
  /** Syrové řádky pro rozpad (jen když šablona má store_rows a není HR). */
  sourceRows?: SourceRowInsert[];
  /** Šablona, ke které řádky patří — povinné, když se sourceRows ukládají. */
  templateId?: string;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { companyId, userId, staged, activityMetadata, sourceRows, templateId } = params;

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
    { kind: "upload", uploadId: staged.uploadId },
    existingByKey,
  );
  if (writeError) return { error: writeError };

  // Syrové řádky pro rozpad — až tady (po přijetí dat), ať se při odmítnutí
  // konfliktu neválejí osiřelé řádky. Po dávkách, může jich být hodně.
  if (sourceRows && sourceRows.length > 0 && templateId) {
    const DAVKA = 500;
    for (let i = 0; i < sourceRows.length; i += DAVKA) {
      const { error: rowsError } = await supabase.from("source_rows").insert(
        sourceRows.slice(i, i + DAVKA).map((r) => ({
          company_id: companyId,
          upload_id: staged.uploadId,
          template_id: templateId,
          period_end: r.period_end,
          period_type: r.period_type,
          data: r.data,
        })),
      );
      // Selhání uložení řádků NESMÍ shodit celý upload — agregát v
      // kpi_values už je zapsaný a je to hlavní hodnota. Rozpad je nadstavba;
      // když se nepovede, jen se zaloguje a jede se dál.
      if (rowsError) {
        console.error("[source_rows] insert:", rowsError.message);
        break;
      }
    }
  }

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
