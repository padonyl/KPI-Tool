// Ověří RLS a granty tabulky source_rows (migrace 0016) na dev.
// Spustit: node scripts/over-source-rows.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("thlssdnyqjtkmvpwlsez")) {
  console.error("Jen dev."); process.exit(1);
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));

const superU = P.normal.find((n) => n.role === "customer_superuser"); // NORM-Vyroba
const user = P.normal.find((n) => n.role === "user");                 // NORM-Vyroba
const cizi = P.normal.find((n) => n.companyId !== superU.companyId && n.role === "customer_admin");

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

async function jako(ucet) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email: ucet.email, password: ucet.heslo });
  if (error) throw new Error(`login ${ucet.email}: ${error.message}`);
  return c;
}

// potřebujeme platné upload_id a template_id (FK). Vezmeme je service_role.
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: up } = await sb.from("uploads").select("id, company_id").eq("company_id", superU.companyId).limit(1).maybeSingle();
const { data: tpl } = await sb.from("upload_templates").select("id, company_id").eq("company_id", superU.companyId).limit(1).maybeSingle();

if (!up || !tpl) {
  console.log("(NORM-Vyroba nemá upload/šablonu — přeskočeno, FK by neprošel)");
  console.log("Pozn.: to nevadí pro test RLS insertu na cizí firmu, ten padne na politice dřív.");
}

const radek = (companyId) => ({
  company_id: companyId,
  upload_id: up?.id ?? "00000000-0000-0000-0000-000000000000",
  template_id: tpl?.id ?? "00000000-0000-0000-0000-000000000000",
  period_end: "2026-05-31",
  period_type: "month",
  data: { test: "hodnota" },
});

// 1. superuser vlastní firma — mělo by projít (pokud má upload+šablonu)
if (up && tpl) {
  const cs = await jako(superU);
  const { error } = await cs.from("source_rows").insert(radek(superU.companyId));
  zapis("superuser zapíše řádek do vlastní firmy", !error, error?.message ?? "");
  // uklid
  await sb.from("source_rows").delete().eq("company_id", superU.companyId).eq("data->>test", "hodnota");
}

// 2. superuser do CIZÍ firmy — musí selhat (RLS WITH CHECK)
{
  const cs = await jako(superU);
  const { error } = await cs.from("source_rows").insert(radek(cizi.companyId));
  zapis("superuser NEzapíše do cizí firmy", !!error, error ? "blokováno" : "PROŠLO!");
}

// 3. read-only user do vlastní firmy — musí selhat (role < superuser)
{
  const cu = await jako(user);
  const { error } = await cu.from("source_rows").insert(radek(user.companyId));
  zapis("read-only user NEzapíše řádek", !!error, error ? "blokováno" : "PROŠLO!");
}

// 4. user čte jen svoji firmu (cizí = 0 řádků)
{
  const cu = await jako(user);
  const { data } = await cu.from("source_rows").select("id").eq("company_id", cizi.companyId);
  zapis("user nevidí cizí source_rows", (data ?? []).length === 0, `viděl ${(data ?? []).length}`);
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
