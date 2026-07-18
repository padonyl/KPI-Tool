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
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      {periods.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
