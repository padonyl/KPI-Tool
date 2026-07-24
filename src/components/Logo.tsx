// [C4] Broušený drahokam - viz koncept loga (workspace/KPI Tool docs).
// Fasety = 5 pevných odstínů modré jako barevné plochy (nezávislé na
// světlém/tmavém režimu stránky, stejně jako u skutečného vybroušeného
// kamene), ne čáry.
export function Logo({ withWordmark = true, className = "" }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 60" className="h-12 w-12 shrink-0" aria-hidden="true">
        <polygon points="28,26 30,4 52,16 58,36" fill="#8fb4f5" />
        <polygon points="28,26 58,36 42,54" fill="#1b3d8f" />
        <polygon points="28,26 42,54 18,50" fill="#17316e" />
        <polygon points="28,26 18,50 6,30 14,12" fill="#0e2050" />
        <polygon points="28,26 14,12 30,4" fill="#b9cef7" />
        <polygon
          points="30,4 52,16 58,36 42,54 18,50 6,30 14,12"
          fill="none"
          stroke="#0e2050"
          strokeWidth="1.5"
        />
        <line x1="28" y1="26" x2="42" y2="54" stroke="#0e2050" strokeWidth="0.75" opacity="0.5" />
      </svg>
      {withWordmark && (
        <span className="font-display text-2xl font-semibold tracking-tight text-brand-ink">Padonyl</span>
      )}
    </span>
  );
}
