// Supabase Auth vrací chybové hlášky anglicky. Appka je jinak celá česky,
// tak nejčastější z nich přeložíme; cokoliv nezmapovaného projde v původním
// znění (radši anglicky než skrýt uživateli info o tom, co se stalo).
/** „5 znaků", ale „3 znaky" a „1 znak". */
function znaku(n: number): string {
  if (n === 1) return "1 znak";
  if (n >= 2 && n <= 4) return `${n} znaky`;
  return `${n} znaků`;
}

const MAP: { match: RegExp; cs: string | ((m: RegExpMatchArray) => string) }[] = [
  { match: /user already registered/i, cs: "Tento e-mail už je zaregistrovaný. Zkus se přihlásit." },
  { match: /invalid login credentials/i, cs: "Nesprávný e-mail nebo heslo." },
  { match: /email not confirmed/i, cs: "E-mail zatím není potvrzený. Zkontroluj si schránku." },
  // Číslo se BERE Z ODPOVĚDI, ne z konstanty v appce. Dřív tu stálo
  // natvrdo „minimálně 6 znaků" — kdyby se limit v Supabase zvedl,
  // appka by uživateli tvrdila nepravdu a on by nevěděl, co po něm chce.
  {
    match: /password should be at least (\d+)/i,
    cs: (m) => `Heslo musí mít alespoň ${znaku(Number(m[1]))}.`,
  },
  { match: /password should be at least/i, cs: "Heslo je příliš krátké." },
  // Supabase umí ověřovat hesla proti databázi prozrazených (HIBP).
  {
    match: /known to be weak|easy to guess|pwned|compromised/i,
    cs: "Tohle heslo se objevilo v únicích dat, takže ho útočníci znají. Zvol prosím jiné.",
  },
  {
    match: /password should contain at least one character of each/i,
    cs: "Heslo musí obsahovat i další druhy znaků — velká i malá písmena a číslice.",
  },
  { match: /unable to validate email address/i, cs: "Neplatný formát e-mailu." },
  { match: /email rate limit exceeded/i, cs: "Odesláno moc požadavků. Zkus to prosím za chvíli." },
  { match: /for security purposes.*after (\d+) seconds/i, cs: "Chvíli počkej a zkus to znovu." },
  { match: /new password should be different/i, cs: "Nové heslo musí být jiné než to staré." },
  { match: /same.*password/i, cs: "Nové heslo musí být jiné než to staré." },
];

export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Něco se nepodařilo. Zkus to prosím znovu.";
  for (const { match, cs } of MAP) {
    const nalez = message.match(match);
    if (nalez) return typeof cs === "function" ? cs(nalez) : cs;
  }
  return message;
}
