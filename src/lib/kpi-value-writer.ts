import { createClient } from "@/lib/supabase/client";

export type CandidateValue = {
  kpiDefinitionId: string;
  kpiName: string;
  value: number;
  periodEnd: string;
  periodType: string;
};

export type Conflict = {
  kpiName: string;
  periodEnd: string;
  periodType: string;
  oldValue: number;
  newValue: number;
};

type ExistingRow = {
  id: string;
  kpi_definition_id: string;
  value: number;
  period_end: string;
  period_type: string;
  version: number;
};

export type ExistingByKey = Map<string, ExistingRow>;

function keyOf(kpiDefinitionId: string, periodEnd: string, periodType: string) {
  return `${kpiDefinitionId}|${periodEnd}|${periodType}`;
}

export async function fetchExistingCurrentValues(
  companyId: string,
  kpiDefinitionIds: string[],
): Promise<{ existingByKey: ExistingByKey; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .select("id, kpi_definition_id, value, period_end, period_type, version")
    .eq("company_id", companyId)
    .is("superseded_at", null)
    .in("kpi_definition_id", kpiDefinitionIds);

  if (error) {
    return { existingByKey: new Map(), error: error.message };
  }

  const existingByKey: ExistingByKey = new Map(
    (data ?? []).map((row) => [
      keyOf(row.kpi_definition_id, row.period_end, row.period_type),
      row,
    ]),
  );

  return { existingByKey, error: null };
}

export function findConflicts(
  candidates: CandidateValue[],
  existingByKey: ExistingByKey,
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const c of candidates) {
    const existing = existingByKey.get(
      keyOf(c.kpiDefinitionId, c.periodEnd, c.periodType),
    );
    if (existing && existing.value !== c.value) {
      conflicts.push({
        kpiName: c.kpiName,
        periodEnd: c.periodEnd,
        periodType: c.periodType,
        oldValue: existing.value,
        newValue: c.value,
      });
    }
  }
  return conflicts;
}

/**
 * Odkud hodnota pochází. Ruční zápis projde stejným verzováním jako nahrání -
 * stará hodnota se nemaže, jen označí jako nahrazená (migrace 0007).
 */
export type ValueOrigin =
  | { kind: "upload"; uploadId: string }
  | { kind: "manual"; userId: string };

function originColumns(origin: ValueOrigin) {
  return origin.kind === "upload"
    ? { source_upload_id: origin.uploadId, entry_source: "upload" }
    : { entry_source: "manual", entered_by: origin.userId };
}

export async function writeKpiValues(
  companyId: string,
  candidates: CandidateValue[],
  origin: ValueOrigin,
  existingByKey: ExistingByKey,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const originFields = originColumns(origin);

  for (const c of candidates) {
    const existing = existingByKey.get(
      keyOf(c.kpiDefinitionId, c.periodEnd, c.periodType),
    );

    if (existing) {
      if (existing.value === c.value) continue; // stejná hodnota, nic dělat netřeba

      const { error: supersedeError } = await supabase
        .from("kpi_values")
        .update({ superseded_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (supersedeError) {
        return { error: `Chyba při nahrazování staré hodnoty: ${supersedeError.message}` };
      }

      const { error: insertError } = await supabase.from("kpi_values").insert({
        company_id: companyId,
        kpi_definition_id: c.kpiDefinitionId,
        value: c.value,
        period_end: c.periodEnd,
        period_type: c.periodType,
        version: existing.version + 1,
        ...originFields,
      });

      if (insertError) {
        return { error: `Chyba při ukládání nové verze: ${insertError.message}` };
      }
    } else {
      const { error: insertError } = await supabase.from("kpi_values").insert({
        company_id: companyId,
        kpi_definition_id: c.kpiDefinitionId,
        value: c.value,
        period_end: c.periodEnd,
        period_type: c.periodType,
        version: 1,
        ...originFields,
      });

      if (insertError) {
        return { error: `Chyba při ukládání hodnoty: ${insertError.message}` };
      }
    }
  }

  return { error: null };
}
