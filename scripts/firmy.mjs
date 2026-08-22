// Správa čekajících firem z příkazové řádky.
//
// PROČ EXISTUJE: schvalování běží mimo aplikaci (obrazovka se seznamem
// firem napříč tenanty by byla RLS bypass, viz kpi_tool_schema.sql).
// Hlavní cesta je odkaz v notifikačním e-mailu — jenže když notifikace
// nedojde (chybí RESEND_API_KEY, spadl e-mail, selhalo volání při
// registraci), firma zůstane viset a nikdo se to nedozví.
//
// Tenhle skript je záchranná cesta, která na e-mailu nezávisí.
//
// POUŽITÍ
//   node scripts/firmy.mjs                 vypíše čekající firmy
//   node scripts/firmy.mjs vse             vypíše všechny firmy
//   node scripts/firmy.mjs schvalit <id>   schválí firmu
//   node scripts/firmy.mjs zamitnout <id>  zamítne firmu
//
// Prostředí se bere z .env.local (= dev). Na produkci:
//   ENV_FILE=.env.prod node scripts/firmy.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const souborEnv = process.env.ENV_FILE ?? ".env.local";

let env;
try {
  env = Object.fromEntries(
    readFileSync(souborEnv, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
  );
} catch {
  console.error(`Nepodařilo se přečíst ${souborEnv}.`);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error(`V ${souborEnv} chybí URL nebo SUPABASE_SERVICE_ROLE_KEY.`);
  process.exit(1);
}

const db = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Ať je vždycky jasné, na které prostředí se sahá — u schvalování je
// záměna dev a prod nepříjemná.
const projekt = url.replace(/^https:\/\//, "").split(".")[0];
const [prikaz, argument] = process.argv.slice(2);

function datum(iso) {
  return new Date(iso).toLocaleString("cs-CZ");
}

async function vypis(jenCekajici) {
  let dotaz = db
    .from("companies")
    .select("id, name, status, created_at, users(email)")
    .order("created_at", { ascending: false });

  if (jenCekajici) dotaz = dotaz.eq("status", "pending");

  const { data, error } = await dotaz;
  if (error) {
    console.error("Chyba:", error.message);
    process.exit(1);
  }

  if (!data.length) {
    console.log(
      jenCekajici
        ? `Žádná firma nečeká na schválení. (${projekt})`
        : `Žádné firmy. (${projekt})`,
    );
    return;
  }

  console.log(`\n${projekt} — ${data.length} ${jenCekajici ? "čekajících" : "firem"}\n`);
  for (const f of data) {
    const emaily = (f.users ?? []).map((u) => u.email).join(", ") || "bez uživatele";
    console.log(`  ${f.name}`);
    console.log(`    stav:     ${f.status}`);
    console.log(`    vznikla:  ${datum(f.created_at)}`);
    console.log(`    uživatel: ${emaily}`);
    console.log(`    id:       ${f.id}`);
    if (f.status === "pending") {
      console.log(`    schválit: node scripts/firmy.mjs schvalit ${f.id}`);
    }
    console.log();
  }
}

async function zmenStav(id, novyStav) {
  if (!id) {
    console.error("Chybí id firmy. Vypiš je přes: node scripts/firmy.mjs");
    process.exit(1);
  }

  const { data: firma, error: chybaCteni } = await db
    .from("companies")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (chybaCteni) {
    console.error("Chyba:", chybaCteni.message);
    process.exit(1);
  }
  if (!firma) {
    console.error(`Firma ${id} v projektu ${projekt} neexistuje.`);
    process.exit(1);
  }
  if (firma.status === novyStav) {
    console.log(`${firma.name} už má stav ${novyStav}, nic se nemění.`);
    return;
  }

  // Token se maže spolu se změnou stavu, stejně jako to dělá schvalovací
  // endpoint — jinak by odkaz z e-mailu zůstal platný i po vyřízení.
  const { error } = await db
    .from("companies")
    .update({ status: novyStav, approval_token: null })
    .eq("id", id);

  if (error) {
    console.error("Nepodařilo se uložit:", error.message);
    process.exit(1);
  }

  await db.from("activity_log").insert({
    company_id: id,
    user_id: null,
    action: novyStav === "approved" ? "access.approved" : "access.rejected",
    metadata: { firma: firma.name, zdroj: "scripts/firmy.mjs" },
  });

  console.log(
    `${firma.name}: ${firma.status} → ${novyStav}  (${projekt})`,
  );
}

if (prikaz === "schvalit") await zmenStav(argument, "approved");
else if (prikaz === "zamitnout") await zmenStav(argument, "rejected");
else if (prikaz === "vse") await vypis(false);
else if (!prikaz) await vypis(true);
else {
  console.error(`Neznámý příkaz "${prikaz}". Použij: vse | schvalit <id> | zamitnout <id>`);
  process.exit(1);
}
