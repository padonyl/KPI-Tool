// Založí jednorázový testovací účet na DEV Supabase a vypíše přihlašovací
// údaje pro Playwright. Postup schválený v CLAUDE.md (automatizované
// testování bez browseru).
//
// Spustit: node scripts/test-ucet.mjs
// Účet je jednorázový, heslo se generuje. Po testech ho lze smazat.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Chybí NEXT_PUBLIC_SUPABASE_URL nebo ANON_KEY v .env.local");
  process.exit(1);
}

const supabase = createClient(url, anon);

const razitko = Date.now();
const email = `e2e-${razitko}@example.com`;
const heslo = `Test-${randomUUID().slice(0, 12)}`;

const { data, error } = await supabase.auth.signUp({ email, password: heslo });

if (error) {
  console.error("Registrace selhala:", error.message);
  console.error("(Pokud je na dev zapnuté potvrzování e-mailů, účet se bez potvrzení nepřihlásí.)");
  process.exit(1);
}

const potvrzeni = data.user?.confirmed_at ?? data.user?.email_confirmed_at;
writeFileSync(
  ".e2e-ucet.json",
  JSON.stringify({ email, heslo, potvrzeno: Boolean(potvrzeni) }, null, 2),
);

console.log("Účet založen:", email);
console.log("Potvrzený:", Boolean(potvrzeni));
console.log("Údaje uloženy do .e2e-ucet.json (je v .gitignore)");
