import type { AccessStatus } from "@/lib/access";

// Příznak schválení firmy v dashboardu (migrace 0009).
//
// Schvaluje se firma, ne uživatel, takže příznak sedí u názvu firmy.
// Barvy jsou schválně jiné než semafor u KPI (zelená/červená) - tohle
// není výsledek měření, ale stav účtu, a nemá to splývat.

const STAVY: Record<AccessStatus, { label: string; trida: string }> = {
  approved: {
    label: "Schváleno",
    trida:
      "border-[#0ca30c]/40 bg-[#0ca30c]/10 text-[#0a7d0a] dark:text-[#4ed14e]",
  },
  pending: {
    label: "Čeká na schválení",
    trida:
      "border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  },
  rejected: {
    label: "Neschváleno",
    trida: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400",
  },
};

export function CompanyStatusBadge({ status }: { status: AccessStatus }) {
  const stav = STAVY[status] ?? STAVY.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${stav.trida}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {stav.label}
    </span>
  );
}
