import type { Status } from "@/lib/kpi-targets";

// Status barvy (good/critical) - vyhrazená paleta, nikdy nepoužívaná
// pro kategorické série. Vždy s ikonou + textem, nikdy jen barva.
const STYLES: Record<Status, { bg: string; text: string; icon: string; label: string }> = {
  good: {
    bg: "bg-[#0ca30c]/10 dark:bg-[#0ca30c]/15",
    text: "text-[#0ca30c] dark:text-[#0ca30c]",
    icon: "✓",
    label: "OK",
  },
  critical: {
    bg: "bg-[#d03b3b]/10 dark:bg-[#d03b3b]/15",
    text: "text-[#d03b3b] dark:text-[#e66767]",
    icon: "✕",
    label: "Mimo cíl",
  },
};

export function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return null;
  const s = STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
