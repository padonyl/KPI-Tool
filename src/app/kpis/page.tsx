import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonthSelector } from "./MonthSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluateTarget, type KpiTarget, type Status } from "@/lib/kpi-targets";
import { CrystalField } from "@/components/marketing/CrystalField";
import { formatPeriod } from "@/lib/format-period";
import { formatValue } from "@/lib/format-number";

// Stejná paleta jako StatusBadge.tsx - good/critical, nikdy jinak.
const STATUS_HEX: Record<Status, string> = {
  good: "#0ca30c",
  critical: "#d03b3b",
};

export default async function KpisDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tento uživatel zatím není napojený na žádnou firmu.
        </p>
      </div>
    );
  }

  const { data: allCurrent } = await supabase
    .from("kpi_values")
    .select("period_end, period_type")
    .eq("company_id", profile.company_id)
    .is("superseded_at", null)
    .order("period_end", { ascending: false });

  const periods = [...new Set((allCurrent ?? []).map((r) => r.period_end))];
  // Typ období pro popisek ("Leden 2026" vs. "31. 1. 2026") - viz format-period.ts
  const periodTypeByEnd = new Map(
    (allCurrent ?? []).map((r) => [r.period_end, r.period_type as string]),
  );
  const selectedPeriod = period && periods.includes(period) ? period : periods[0];

  if (!selectedPeriod) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 font-sans">
        <h1 className="mb-2 text-2xl font-semibold">Přehled KPI</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Zatím žádná data — nahraj něco přes{" "}
          <a href="/upload" className="underline">
            /upload
          </a>
          .
        </p>
      </div>
    );
  }

  const [{ data: rows }, { data: targetRows }] = await Promise.all([
    supabase
      .from("kpi_values")
      .select("value, kpi_definitions(id, name, unit)")
      .eq("company_id", profile.company_id)
      .eq("period_end", selectedPeriod)
      .is("superseded_at", null),
    supabase
      .from("kpi_targets")
      .select("kpi_definition_id, evaluation_type, min_value, max_value")
      .eq("company_id", profile.company_id),
  ]);

  const targetByKpiId = new Map<string, KpiTarget>(
    (targetRows ?? []).map((t) => [
      t.kpi_definition_id,
      {
        evaluation_type: t.evaluation_type,
        min_value: t.min_value,
        max_value: t.max_value,
      },
    ]),
  );

  type Row = {
    value: number;
    kpi_definitions: { id: string; name: string; unit: string } | null;
  };
  const typedRows = (rows ?? []) as unknown as Row[];

  const kpiRows = typedRows
    .map((r) => {
      const kpi = r.kpi_definitions;
      if (!kpi) return null;
      return {
        kpi,
        value: r.value,
        status: evaluateTarget(r.value, targetByKpiId.get(kpi.id)),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const statusCounts = kpiRows.reduce(
    (acc, r) => {
      if (r.status === "good") acc.good++;
      else if (r.status === "critical") acc.critical++;
      else acc.noTarget++;
      return acc;
    },
    { good: 0, critical: 0, noTarget: 0 },
  );

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
              Přehled
            </p>
            <h1 className="font-display text-3xl font-semibold text-brand-ink">
              Přehled KPI
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Klikni na KPI pro detail a graf v čase.
            </p>
          </div>
          <MonthSelector
            periods={periods.map((p) => ({
              value: p,
              label: formatPeriod(p, periodTypeByEnd.get(p)),
            }))}
            selected={selectedPeriod}
          />
        </div>

        {kpiRows.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            {statusCounts.good > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-[#0ca30c]/10 px-4 py-1.5 text-sm font-medium text-[#0ca30c] dark:bg-[#0ca30c]/15">
                <span aria-hidden="true">✓</span>
                {statusCounts.good} v pořádku
              </div>
            )}
            {statusCounts.critical > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-[#d03b3b]/10 px-4 py-1.5 text-sm font-medium text-[#d03b3b] dark:bg-[#d03b3b]/15 dark:text-[#e66767]">
                <span aria-hidden="true">✕</span>
                {statusCounts.critical} mimo cíl
              </div>
            )}
            {statusCounts.noTarget > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-4 py-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {statusCounts.noTarget} bez cíle
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {kpiRows.map(({ kpi, value, status }) => (
            <Link
              key={kpi.id}
              href={`/kpis/${kpi.id}`}
              style={{
                borderLeftColor: status ? STATUS_HEX[status] : undefined,
                backgroundImage: status
                  ? `radial-gradient(140px circle at 100% 0%, ${STATUS_HEX[status]}14, transparent 70%)`
                  : undefined,
              }}
              className={`group rounded-xl border border-l-4 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-950 ${
                status
                  ? "border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200 border-l-zinc-300 dark:border-zinc-800 dark:border-l-zinc-700"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
                  {kpi.name}
                </h2>
                <StatusBadge status={status} />
              </div>
              <p className="font-display text-2xl font-semibold text-brand-ink dark:text-zinc-50">
                {formatValue(value, kpi.unit)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
