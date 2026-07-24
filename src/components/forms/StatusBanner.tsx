// Stejná paleta jako StatusBadge.tsx (good/critical) - úspěch/chyba
// formulářů jsou sémanticky totéž, tak ať appka mluví jednou barevnou řečí.

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#0ca30c]/30 bg-[#0ca30c]/10 px-4 py-3 text-sm text-[#0ca30c] dark:bg-[#0ca30c]/15">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ca30c] text-white">
        ✓
      </span>
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#d03b3b]/30 bg-[#d03b3b]/10 px-4 py-3 text-sm text-[#d03b3b] dark:bg-[#d03b3b]/15 dark:text-[#e66767]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d03b3b] text-white">
        ✕
      </span>
      {children}
    </div>
  );
}
