import { parseNumber, parseDateValue, todayIso, endOfMonthIso } from "@/lib/parse-values";
import type { CandidateValue } from "@/lib/kpi-value-writer";

export type RuleType = "direct" | "aggregated" | "tolerance_derived";

export type DirectConfig = {
  source_column: string;
};

export type AggregatedConfig = {
  filter_column: string;
  filter_value: string;
  value_column: string;
  aggregation: "sum" | "count" | "avg";
};

export type ToleranceDerivedConfig = {
  requested_date_column: string;
  actual_date_column: string;
  requested_qty_column: string;
  actual_qty_column: string;
  on_time_tolerance_days: number;
  in_full_tolerance_pct: number;
};

export type RuleConfig = DirectConfig | AggregatedConfig | ToleranceDerivedConfig;

export type ParsedRow = Record<string, string>;

function resolvePeriod(
  row: ParsedRow,
  dateColumn: string | null,
  periodType: string,
): { periodEnd: string; periodType: string } | null {
  if (dateColumn) {
    const raw = row[dateColumn] ?? "";
    const parsed = parseDateValue(raw);
    if (!parsed) return null;
    return { periodEnd: parsed, periodType };
  }
  return { periodEnd: todayIso(), periodType: "day" };
}

export function computeDirectCandidates(
  rows: ParsedRow[],
  dateColumn: string | null,
  periodType: string,
  config: DirectConfig,
  kpiDefinitionId: string,
  kpiName: string,
): CandidateValue[] {
  const candidates: CandidateValue[] = [];
  for (const row of rows) {
    const period = resolvePeriod(row, dateColumn, periodType);
    if (!period) continue;
    const value = parseNumber(row[config.source_column] ?? "");
    if (value === null) continue;
    candidates.push({
      kpiDefinitionId,
      kpiName,
      value,
      periodEnd: period.periodEnd,
      periodType: period.periodType,
    });
  }
  return candidates;
}

export function computeAggregatedCandidates(
  rows: ParsedRow[],
  dateColumn: string | null,
  periodType: string,
  config: AggregatedConfig,
  kpiDefinitionId: string,
  kpiName: string,
): CandidateValue[] {
  const buckets = new Map<string, { periodType: string; values: number[] }>();

  for (const row of rows) {
    if ((row[config.filter_column] ?? "").trim() !== config.filter_value) continue;
    const period = resolvePeriod(row, dateColumn, periodType);
    if (!period) continue;
    const value = parseNumber(row[config.value_column] ?? "");
    if (value === null) continue;

    const key = `${period.periodEnd}|${period.periodType}`;
    const bucket = buckets.get(key) ?? { periodType: period.periodType, values: [] };
    bucket.values.push(value);
    buckets.set(key, bucket);
  }

  const candidates: CandidateValue[] = [];
  for (const [key, bucket] of buckets.entries()) {
    const [periodEnd] = key.split("|");
    let value: number;
    if (config.aggregation === "sum") {
      value = bucket.values.reduce((a, b) => a + b, 0);
    } else if (config.aggregation === "count") {
      value = bucket.values.length;
    } else {
      value = bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length;
    }
    candidates.push({
      kpiDefinitionId,
      kpiName,
      value: Math.round(value * 100) / 100,
      periodEnd,
      periodType: bucket.periodType,
    });
  }
  return candidates;
}

export type DeliveryRow = {
  requested_date: string;
  actual_date: string;
  requested_qty: number;
  actual_qty: number;
};

export function computeToleranceDerivedCandidates(
  rows: ParsedRow[],
  config: ToleranceDerivedConfig,
  kpiDefinitionId: string,
  kpiName: string,
): { candidates: CandidateValue[]; deliveryRows: DeliveryRow[] } {
  const deliveryRows: DeliveryRow[] = [];

  for (const row of rows) {
    const requestedDate = parseDateValue(row[config.requested_date_column] ?? "");
    const actualDate = parseDateValue(row[config.actual_date_column] ?? "");
    const requestedQty = parseNumber(row[config.requested_qty_column] ?? "");
    const actualQty = parseNumber(row[config.actual_qty_column] ?? "");

    if (!requestedDate || !actualDate || requestedQty === null || actualQty === null) {
      continue;
    }
    deliveryRows.push({
      requested_date: requestedDate,
      actual_date: actualDate,
      requested_qty: requestedQty,
      actual_qty: actualQty,
    });
  }

  const buckets = new Map<string, { total: number; otifCount: number }>();
  for (const d of deliveryRows) {
    const diffMs = new Date(d.actual_date).getTime() - new Date(d.requested_date).getTime();
    const diffDays = Math.abs(diffMs / (1000 * 60 * 60 * 24));
    const onTime = diffDays <= config.on_time_tolerance_days;
    const inFull = d.actual_qty >= d.requested_qty * (config.in_full_tolerance_pct / 100);
    const otif = onTime && inFull;

    const periodEnd = endOfMonthIso(d.requested_date);
    const bucket = buckets.get(periodEnd) ?? { total: 0, otifCount: 0 };
    bucket.total += 1;
    if (otif) bucket.otifCount += 1;
    buckets.set(periodEnd, bucket);
  }

  const candidates: CandidateValue[] = [...buckets.entries()].map(([periodEnd, b]) => ({
    kpiDefinitionId,
    kpiName,
    value: Math.round((b.otifCount / b.total) * 1000) / 10,
    periodEnd,
    periodType: "month",
  }));

  return { candidates, deliveryRows };
}
