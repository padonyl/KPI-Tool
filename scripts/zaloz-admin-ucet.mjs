// Založí přihlašovací účet provozovatele (platformního admina).
//
// Účet ZÁMĚRNĚ NEMÁ firmu ani řádek v `users` — platformní admin není
// uživatel žádného tenanta. Do adminu ho pustí až záznam v
// platform_admins (migrace 0011) plus proměnná ADMIN_EMAILS.
//
// Spustit: node scripts/zaloz-admin-ucet.mjs admin@padonyl.com
// Na produkci: ENV_FILE=.env.prod node scripts/zaloz-admin-ucet.mjs admin@padonyl.com
//
// POZOR: na produkci je zapnuté potvrzování e-mailů, takže tam účet
// vznikne, ale bude čekat na kliknutí v potvrzovací zprávě. Adresa tedy
// musí být skutečná schránka. Na dev je potvrzování vypnuté.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const souborEnv = process.env.ENV_FILE ?? ".env.local";
const email = process.argv[2];

if (!email) {
  console.error("Chybí e-mail. Použití: node scripts/zaloz-admin-ucet.mjs admin@padonyl.com");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(souborEnv, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error(`V ${souborEnv} chybí URL nebo ANON_KEY.`);
  process.exit(1);
}

const projekt = url.replace(/^https:\/\//, "").split(".")[0];
const heslo = `Admin-${randomUUID().slice(0, 16)}`;

const { data, error } = await createClient(url, anon).auth.signUp({
  email,
  password: heslo,
});

if (error) {
  console.error("Registrace selhala:", error.message);
  if (/already/i.test(error.message)) {
    console.error("Účet už existuje — heslo si obnov přes 'Zapomenuté heslo' v aplikaci.");
  }
  process.exit(1);
}

const potvrzeny = Boolean(data.user?.confirmed_at ?? data.user?.email_confirmed_at);

writeFileSync(
  ".admin-ucet.json",
  JSON.stringify({ projekt, email, heslo, potvrzeny }, null, 2),
);

console.log(`Projekt:   ${projekt}`);
console.log(`E-mail:    ${email}`);
console.log(`Potvrzený: ${potvrzeny ? "ano" : "NE — je potřeba kliknout na odkaz v e-mailu"}`);
console.log(`\nHeslo uloženo v .admin-ucet.json (v .gitignore).`);
console.log(`Změň si ho v aplikaci přes „Zapomenuté heslo" na něco vlastního.`);
console.log(`\nDalší krok: spustit migraci 0011 — teprve ta z účtu udělá admina.`);
