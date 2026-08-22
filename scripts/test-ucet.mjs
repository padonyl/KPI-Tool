// Připraví jednorázový testovací účet na DEV Supabase pro Playwright:
// registrace + rovnou schválená firma. Postup schválený v CLAUDE.md
// (automatizované testování bez browseru).
//
// Spustit: node scripts/test-ucet.mjs
//
// PROČ SE FIRMA ZAKLÁDÁ TADY A NE V UI: od migrace 0009 čeká každá nově
// založená firma na schválení, takže by se test do šablon vůbec nedostal.
// Firma se proto vytvoří přes service_role rovnou jako approved. Vedlejší
// výhoda: test nezávisí na onboardingovém formuláři a je kratší.
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
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Chybí klíče v .env.local (URL, ANON, SERVICE_ROLE).");
  process.exit(1);
}

const razitko = Date.now();
const email = `e2e-${razitko}@example.com`;
const heslo = `Test-${randomUUID().slice(0, 12)}`;

// --- registrace přes anon klienta, stejně jako to dělá appka ---
const { data, error } = await createClient(url, anon).auth.signUp({
  email,
  password: heslo,
});

if (error) {
  console.error("Registrace selhala:", error.message);
  process.exit(1);
}

const authUserId = data.user?.id;
if (!authUserId) {
  console.error("Registrace neproběhla - chybí id uživatele.");
  process.exit(1);
}

// --- firma se zakládá STEJNOU CESTOU JAKO V APPCE ---
// service_role má na companies jen select a update (migrace 0010),
// insert schválně ne - firmy zakládá uživatel, ne server. Grant navíc
// jen kvůli pohodlí testu by zbytečně rozšířil práva admin klienta.
const jakoUzivatel = createClient(url, anon);
await jakoUzivatel.auth.signInWithPassword({ email, password: heslo });

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: sektor } = await admin.from("sectors").select("id").limit(1).maybeSingle();
const { data: pasmo } = await admin
  .from("company_size_bands")
  .select("id")
  .limit(1)
  .maybeSingle();

// id se generuje na klientu a insert je bez .select() - stejný důvod jako
// v CreateCompanyForm: uživatel na firmu ještě není napojený, takže by
// mu SELECT politika vrácený řádek nepustila.
const companyId = randomUUID();
const { error: chybaFirmy } = await jakoUzivatel.from("companies").insert({
  id: companyId,
  name: `E2E Test ${razitko}`,
  sector_id: sektor?.id ?? null,
  size_band_id: pasmo?.id ?? null,
  country: "CZ",
});

if (chybaFirmy) {
  console.error("Založení firmy selhalo:", chybaFirmy.message);
  process.exit(1);
}

const { error: chybaUzivatele } = await jakoUzivatel.from("users").insert({
  auth_user_id: authUserId,
  company_id: companyId,
  email,
  role: "customer_admin",
});

if (chybaUzivatele) {
  console.error("Napojení uživatele selhalo:", chybaUzivatele.message);
  process.exit(1);
}

// Teprve schválení jde přes service_role - přesně to, co dělá
// schvalovací endpoint po kliknutí na odkaz v notifikaci.
const { error: chybaSchvaleni } = await admin
  .from("companies")
  .update({ status: "approved" })
  .eq("id", companyId);

if (chybaSchvaleni) {
  console.error("Schválení firmy selhalo:", chybaSchvaleni.message);
  process.exit(1);
}

writeFileSync(
  ".e2e-ucet.json",
  JSON.stringify({ email, heslo, companyId }, null, 2),
);

console.log("Účet:", email);
console.log("Firma:", `E2E Test ${razitko}`, "(approved)");
console.log("Údaje v .e2e-ucet.json — soubor je v .gitignore.");
console.log("\nÚklid po testech:");
console.log(`  delete from companies where id = '${companyId}';`);
