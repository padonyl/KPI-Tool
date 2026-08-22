// ------------------------------------------------------------
// Schvalování FIREM (migrace 0009, rozhodnuto 2026-08-22).
//
// Registrace zůstává otevřená, ale nová firma nic neuvidí, dokud ji
// vlastník nepustí. Schvaluje se firma, ne jednotliví lidé - kolegu do
// firmy zve admin, takže za něj někdo ručí.
//
// Skutečný zámek je v databázi: auth_company_id() vrací null pro
// neschválenou firmu, takže se všech 43 RLS politik zavře samo. Tenhle
// soubor řeší jen to, aby uživatel místo prázdných obrazovek dostal
// srozumitelnou informaci.
//
// Jinými slovy: kdyby někdo obešel kód níže, stejně neuvidí žádná data.
// Bezpečnostní hranice je v DB, tohle je UX nad ní.
// ------------------------------------------------------------

export type AccessStatus = "pending" | "approved" | "rejected";

// /dashboard tu SCHVÁLNĚ NENÍ: čekající firma se tam dostane a uvidí
// svůj stav jako příznak u názvu firmy. Kdyby se odsud přesměrovávala
// taky, neměl by se ten příznak kde zobrazit.
/** Cesty, které bez schválení nemají co ukazovat. */
export const CHRANENE_PREFIXY = [
  "/kpis",
  "/upload",
  "/templates",
  "/settings",
  "/team",
] as const;

/** Kam se posílá uživatel neschválené firmy. */
export const CEKACI_CESTA = "/dashboard";

export function jeChranenaCesta(pathname: string): boolean {
  return CHRANENE_PREFIXY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
