export type EvaluationType = "min" | "max" | "between" | "outside";

export type KpiTarget = {
  evaluation_type: EvaluationType;
  min_value: number | null;
  max_value: number | null;
};

export type Status = "good" | "critical";

// Hranice vždy patří do zelené strany (>=, <=, ne ostré >, <) -
// viz datovy_model.md, rozhodnutí o kpi_targets.
export function evaluateTarget(
  value: number,
  target: KpiTarget | null | undefined,
): Status | null {
  if (!target) return null;

  switch (target.evaluation_type) {
    case "min":
      return target.min_value != null && value >= target.min_value
        ? "good"
        : "critical";
    case "max":
      return target.max_value != null && value <= target.max_value
        ? "good"
        : "critical";
    case "between":
      return target.min_value != null &&
        target.max_value != null &&
        value >= target.min_value &&
        value <= target.max_value
        ? "good"
        : "critical";
    case "outside":
      return target.min_value != null &&
        target.max_value != null &&
        (value <= target.min_value || value >= target.max_value)
        ? "good"
        : "critical";
    default:
      return null;
  }
}
