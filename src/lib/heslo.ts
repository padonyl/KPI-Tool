// Pravidla pro heslo na jednom místě.
//
// ------------------------------------------------------------
// SKUTEČNÉ VYNUCENÍ JE V SUPABASE, NE TADY
// ------------------------------------------------------------
// Tenhle soubor řídí jen to, co vidí uživatel dopředu — `minLength` na
// vstupu a větu pod polem. Prohlížeč se dá obejít, takže rozhodující je
// nastavení projektu (Authentication → Providers → Email): minimální
// délka a ochrana proti prozrazeným heslům. Musí být nastavené v OBOU
// projektech, dev i prod, jinak se dev chová jinak než produkce.
//
// Když se hodnota v Supabase změní, změň ji i tady. Chybová hláška ze
// serveru si číslo bere z odpovědi Supabase (viz auth-errors.ts), takže
// ta zůstane pravdivá i při nesouladu — tahle konstanta ovlivní jen to,
// co se ukáže PŘED odesláním.
//
// ------------------------------------------------------------
// PROČ DÉLKA A NE ZNAKOVÉ SKUPINY
// ------------------------------------------------------------
// Požadavek na velké písmeno, číslici a symbol vede lidi k „Heslo123!"
// — vzoru, který lamači hesel znají. Delší heslo bez podmínek na složení
// je odolnější a pamatovatelnější. Odpovídá to doporučení NIST
// SP 800-63B, které složitostní pravidla výslovně nedoporučuje a místo
// nich žádá porovnání s databází prozrazených hesel.
export const MIN_DELKA_HESLA = 10;

/** Věta pod polem s heslem. Ukazovat tam, kde se heslo ZAKLÁDÁ. */
export const NAPOVEDA_K_HESLU = `Alespoň ${MIN_DELKA_HESLA} znaků.`;
