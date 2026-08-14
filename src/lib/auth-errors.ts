// Supabase Auth vrací chybové hlášky anglicky. Appka je jinak celá česky,
// tak nejčastější z nich přeložíme; cokoliv nezmapovaného projde v původním
// znění (radši anglicky než skrýt uživateli info o tom, co se stalo).
const MAP: { match: RegExp; cs: string }[] = [
  { match: /user already registered/i, cs: "Tento e-mail už je zaregistrovaný. Zkus se přihlásit." },
  { match: /invalid login credentials/i, cs: "Nesprávný e-mail nebo heslo." },
  { match: /email not confirmed/i, cs: "E-mail zatím není potvrzený. Zkontroluj si schránku." },
  { match: /password should be at least/i, cs: "Heslo musí mít minimálně 6 znaků." },
  { match: /unable to validate email address/i, cs: "Neplatný formát e-mailu." },
  { match: /email rate limit exceeded/i, cs: "Odesláno moc požadavků. Zkus to prosím za chvíli." },
  { match: /for security purposes.*after (\d+) seconds/i, cs: "Chvíli počkej a zkus to znovu." },
  { match: /new password should be different/i, cs: "Nové heslo musí být jiné než to staré." },
  { match: /same.*password/i, cs: "Nové heslo musí být jiné než to staré." },
];

export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Něco se nepodařilo. Zkus to prosím znovu.";
  for (const { match, cs } of MAP) {
    if (match.test(message)) return cs;
  }
  return message;
}
