// Stav přístupu uživatele do aplikace — jedno místo, kde se rozhoduje,
// jestli člověk smí dovnitř, nebo má vidět jen nástěnku s vysvětlením.
//
// PROČ to vzniklo (nález 2026-09-18): dokud tahle logika neexistovala,
// odvozoval si každý kus appky stav po svém — a mýlil se. Dashboard psal
// `profile.companies?.status ?? "pending"`, takže komukoliv, kdo nemohl
// firmu přečíst, vyrobil FIKTIVNÍ firmu „?" ve stavu „Čeká na schválení".
// Middleware zase kontroloval `firma && firma.status !== "approved"` —
// a když firmu nepřečetl, mlčky pustil dál.
//
// Obojí padalo na tomtéž: uživateli, kterému admin odebral přístup, vrací
// `auth_company_id()` null (migrace 0013), takže firma NENÍ čitelná.
// Appka mu pak tvrdila, že firma čeká na schválení — což je lež — a ještě
// ho pustila na /kpis a /templates, kde koukal do prázdna.
//
// Vlastní řádek v `users` si přitom přečte i zablokovaný člověk (politika
// „Users see own row" na auth.uid() nezávisí na firmě), takže `users.status`
// je spolehlivý zdroj pravdy i tam, kde firma není vidět.

export type StavPristupu =
  | "bez_firmy"
  | "zablokovan"
  | "pozastaveno"
  | "ceka_na_schvaleni"
  | "zamitnuto"
  | "aktivni";

/**
 * Spočítá stav přístupu z vlastního záznamu uživatele a (případně čitelné)
 * firmy. `firma` = null znamená „nepřečetli jsme ji", ne „neexistuje" —
 * `users.company_id` je v databázi `not null`, takže firma vždycky je.
 */
export function stavPristupu(
  uzivatel: { status?: string | null } | null | undefined,
  firma: { status?: string | null } | null | undefined,
): StavPristupu {
  // Žádný řádek v users = čerstvě zaregistrovaný člověk před založením
  // firmy. Patří na onboarding, ne do appky.
  if (!uzivatel) return "bez_firmy";

  const stav = uzivatel.status ?? "active";
  if (stav === "deactivated") return "zablokovan";
  if (stav === "suspended") return "pozastaveno";

  // Aktivní uživatel, a přesto firmu nevidíme → ještě není schválená.
  // Fail-closed: co se nedá potvrdit, se nepouští dál.
  if (!firma) return "ceka_na_schvaleni";
  if (firma.status === "rejected") return "zamitnuto";
  if (firma.status !== "approved") return "ceka_na_schvaleni";

  return "aktivni";
}

export function maPlnyPristup(stav: StavPristupu): boolean {
  return stav === "aktivni";
}

/**
 * Texty nástěnky. ZÁMĚRNĚ bez `status_reason`: ten píše admin jako interní
 * poznámku („odešel ke konkurenci"), ne jako zprávu pro dotyčného. Vypsat
 * mu ji by zpětně změnilo význam toho pole. Kdyby někdy bylo potřeba posílat
 * vzkaz, patří to do samostatného pole, které je jako vzkaz označené.
 */
export const NASTENKA: Record<
  Exclude<StavPristupu, "aktivni" | "bez_firmy">,
  { nadpis: string; text: string; kontakt: boolean }
> = {
  zablokovan: {
    nadpis: "Přístup byl odebrán",
    text: "Tvůj přístup do aplikace zrušil admin tvojí firmy. Pokud si myslíš, že jde o omyl, obrať se prosím přímo na něj.",
    kontakt: false,
  },
  pozastaveno: {
    nadpis: "Účet je pozastavený",
    text: "Účet pozastavil provozovatel aplikace. Napiš nám prosím a vyřešíme to.",
    kontakt: true,
  },
  ceka_na_schvaleni: {
    nadpis: "Firma čeká na schválení",
    text: "Registraci tvojí firmy ještě musíme potvrdit. Jakmile to bude hotové, dáme ti vědět e-mailem.",
    kontakt: true,
  },
  zamitnuto: {
    nadpis: "Registrace nebyla schválena",
    text: "Registraci tvojí firmy jsme neschválili. Pokud si myslíš, že jde o omyl, ozvi se nám prosím.",
    kontakt: true,
  },
};
