import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonthSelector } from "./MonthSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluateTarget, type KpiTarget } from "@/lib/kpi-targets";

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
    .select("period_end")
    .eq("company_id", profile.company_id)
    .is("superseded_at", null)
    .order("period_end", { ascending: false });

  const periods = [...new Set((allCurrent ?? []).map((r) => r.period_end))];
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

  return (
    <div className="mx-auto max-w-3xl px-8 py-16 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Přehled KPI</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Draft — klikni na KPI pro detail a graf v čase.
          </p>
        </div>
        <MonthSelector periods={periods} selected={selectedPeriod} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {typedRows.map((r) => {
          const kpi = r.kpi_definitions;
          if (!kpi) return null;
          const status = evaluateTarget(r.value, targetByKpiId.get(kpi.id));

          return (
            <Link
              key={kpi.id}
              href={`/kpis/${kpi.id}`}
              className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
                  {kpi.name}
                </h2>
                <StatusBadge status={status} />
              </div>
              <p className="text-2xl font-semibold">
                {r.value} {kpi.unit}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
