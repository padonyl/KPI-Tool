export function LegalDraftNotice() {
  return (
    <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Pracovní návrh — čeká na projití a případnou právní revizi, ne finální znění.
    </div>
  );
}

export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {children}
    </span>
  );
}
