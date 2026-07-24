"use client";

import { useRouter } from "next/navigation";

export function MonthSelector({
  periods,
  selected,
}: {
  periods: string[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/kpis?period=${e.target.value}`)}
      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      {periods.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
