// Ilustrativní náhled appky pro hero sekci - stylizovaný mockup,
// ne skutečný screenshot appky (appka na to zatím vizuálně nemá
// hotový vlastní design). Barvy good/critical přesně odpovídají
// StatusBadge.tsx, ať to sedí s appkou samotnou.
const TILES = [
  { label: "Tržby", value: "4,2 M Kč", delta: "+12 %", status: "good" as const },
  { label: "OTIF dodavatelů", value: "94 %", delta: "+3 b.", status: "good" as const },
  { label: "Zmetkovitost", value: "3,8 %", delta: "+0,9 b.", status: "critical" as const },
];

export function DashboardPreview() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-brand-ink/10 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <span className="ml-3 text-xs font-medium text-zinc-400">Přehled KPI · červenec</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800">
        {TILES.map((tile) => (
          <div key={tile.label} className="bg-white px-3 py-3 dark:bg-zinc-900">
            <p className="truncate text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
              {tile.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {tile.value}
            </p>
            <p
              className={
                "mt-0.5 text-[11px] font-medium " +
                (tile.status === "good" ? "text-[#0ca30c]" : "text-[#d03b3b]")
              }
            >
              {tile.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="px-4 py-4">
        <svg viewBox="0 0 280 80" className="w-full text-brand">
          <polyline
            points="0,60 40,52 80,58 120,34 160,40 200,20 240,26 280,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-line"
            pathLength={100}
          />
          <circle cx="280" cy="10" r="4" fill="currentColor" className="animate-fade-up" style={{ animationDelay: "900ms" }} />
        </svg>
      </div>
    </div>
  );
}
