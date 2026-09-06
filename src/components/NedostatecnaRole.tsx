import type { Role } from "@/lib/role";
import { POPIS_MINIMA } from "@/lib/role";

// Zdvořilá hláška, když uživatel nemá dost vysokou roli na stránku.
//
// Stejný vzhled jako blokace /team ("Správu týmu vidí jen admin firmy.") —
// amber panel, ne chyba. Uživatel se sem dostal legitimně přihlášený, jen
// na tuhle konkrétní věc nemá oprávnění; není důvod ho děsit.

export function NedostatecnaRole({ minimum }: { minimum: Role }) {
  return (
    <div className="mx-auto max-w-6xl px-8 py-16 font-sans">
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Na tuhle stránku má přístup {POPIS_MINIMA[minimum]} a výš. Poproš
        admina svojí firmy, ať ti zvýší roli, pokud to potřebuješ.
      </p>
    </div>
  );
}
