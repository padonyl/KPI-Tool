// Cedule a značky pro právní stránky.
//
// PROČ ZVÝRAZŇOVAT: dokud společnost nevznikne, jsou v textu údaje, které
// se tváří jako fakt, ale nejsou ověřitelné (název, IČO, sídlo). Kdyby
// splynuly s okolním textem, snadno se na ně zapomene a půjdou do světa
// jako hotová věc. Amber pozadí je má držet viditelné až do doplnění.

export function LegalDraftNotice() {
  return (
    <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-medium">Finální návrh, čeká na právní revizi.</p>
      <p className="mt-1">
        Obsahově odpovídá současnému stavu služby. Údaje o společnosti jsou{" "}
        <Fill>takto zvýrazněné</Fill> — doplní se po jejím zápisu do obchodního
        rejstříku.
      </p>
    </div>
  );
}

/** Údaj, který se teprve doplní (IČO, sídlo, datum účinnosti). */
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {children}
    </span>
  );
}

/**
 * Název společnosti. Rozhodnutý, ale do zápisu do rejstříku neověřitelný —
 * proto zvýrazněný jinak než chybějící údaje: text je hotový, jen čeká na
 * potvrzení.
 */
export function Firma() {
  return (
    <span className="rounded bg-amber-100 px-1 font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
      Padonyl s.r.o.
    </span>
  );
}
