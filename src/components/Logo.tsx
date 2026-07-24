// [C4] Broušený drahokam - viz koncept loga (workspace/KPI Tool docs).
// Fasety chytající světlo = jasnost/přehled vytažený ze složitých dat.
export function Logo({ withWordmark = true, className = "" }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 60" className="h-6 w-6 shrink-0" aria-hidden="true">
        <polygon
          points="30,4 52,16 58,36 42,54 18,50 6,30 14,12"
          className="fill-brand stroke-brand-ink"
          strokeWidth="1.5"
        />
        <polyline points="30,4 42,54" className="stroke-brand-glow" strokeWidth="1" opacity="0.6" fill="none" />
        <polyline points="14,12 18,50" className="stroke-brand-glow" strokeWidth="1" opacity="0.6" fill="none" />
      </svg>
      {withWordmark && (
        <span className="font-semibold tracking-tight text-brand-ink">Padonyl</span>
      )}
    </span>
  );
}
