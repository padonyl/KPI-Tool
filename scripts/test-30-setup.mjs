// Postaví scénu pro velký test 30 person (jen DEV).
//
// Tři oddělené skupiny firem, ať si persony navzájem nerozbijou scénu:
//   HACK-*   cíl pro útočníky: HACK-Beta má data, HACK-Alfa je opora útoku
//   NORM-*   tři firmy pro běžné zaměstnance
//   CHAOS-*  deset firem, každý chaos-tester admin té svojí
//
// service_role NEUMÍ zakládat firmy ani psát kpi_values (schválně). Firmy
// proto zakládá přihlášený uživatel přes anon klienta a schválení dělá
// service_role updatem; data se seedují přihlášeným superuserem.
//
// Přihlašovací údaje se zapíšou do .test-persony.json (v .gitignore).
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL.includes("thlssdnyqjtkmvpwlsez")) {
  console.error("Jen DEV. Konec.");
  process.exit(1);
}
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

let authCache = null;
async function nactiAuth() {
  authCache = new Map();
  for (let p = 1; p <= 20; p++) {
    const { data } = await sb.auth.admin.listUsers({ perPage: 1000, page: p });
    (data?.users ?? []).forEach((u) => authCache.set(u.email, u.id));
    if (!data?.users?.length || data.users.length < 1000) break;
  }
}

async function ucet(email) {
  if (!authCache) await nactiAuth();
  const heslo = `Set-${randomUUID().slice(0, 16)}`;
  let id = authCache.get(email) ?? null;
  if (id) {
    await sb.auth.admin.updateUserById(id, { password: heslo });
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: heslo,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    id = data.user.id;
    authCache.set(email, id);
  }
  return { email, heslo, authId: id };
}

// Firma: najít podle jména, nebo nechat založit zakladatelem a schválit.
async function firma(nazev, zakladatel) {
  const { data: stara } = await sb
    .from("companies")
    .select("id")
    .eq("name", nazev)
    .limit(1)
    .maybeSingle();
  let companyId = stara?.id;
  if (!companyId) {
    companyId = randomUUID();
    const jako = createClient(URL, ANON);
    const { error: eL } = await jako.auth.signInWithPassword({
      email: zakladatel.email,
      password: zakladatel.heslo,
    });
    if (eL) throw new Error(`login zakladatele ${zakladatel.email}: ${eL.message}`);
    const { error } = await jako.from("companies").insert({ id: companyId, name: nazev });
    if (error) throw new Error(`companies ${nazev}: ${error.message}`);
  }
  await sb.from("companies").update({ status: "approved" }).eq("id", companyId);
  // ZÁMĚRNĚ se tu nic nemaže. service_role nemá DELETE na activity_log a
  // users nejde smazat, dokud na něj log odkazuje (cizí klíč). Scéna se
  // proto neresetuje mazáním, ale přepisem — členství řeší clen() upsertem.
  return companyId;
}

async function clen(u, companyId, role) {
  // UPSERT podle auth_user_id, ne mazání+vkládání. Účet má unikátní index
  // na auth_user_id (jeden účet, jeden řádek) a nejde smazat, dokud na něj
  // odkazuje activity_log (service_role navíc nemá DELETE na log). Když
  // řádek existuje, jen ho přepíšeme do žádaného stavu; jinak vložíme.
  const { data: stary } = await sb
    .from("users")
    .select("id")
    .eq("auth_user_id", u.authId)
    .maybeSingle();
  if (stary) {
    const { error } = await sb
      .from("users")
      .update({ company_id: companyId, email: u.email, role, status: "active", status_reason: null })
      .eq("id", stary.id);
    if (error) throw new Error(`users update ${u.email}: ${error.message}`);
    return;
  }
  const { error } = await sb
    .from("users")
    .insert({ auth_user_id: u.authId, company_id: companyId, email: u.email, role });
  if (error) throw new Error(`users insert ${u.email}: ${error.message}`);
}

// Naseeduje pár KPI hodnot jako přihlášený superuser (přes RLS).
async function seedKpi(superuser, companyId) {
  const jako = createClient(URL, ANON);
  const { error: eL } = await jako.auth.signInWithPassword({
    email: superuser.email,
    password: superuser.heslo,
  });
  if (eL) throw new Error(`seed login: ${eL.message}`);
  const { count } = await jako.from("kpi_values").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return count; // idempotence
  const { data: defs } = await jako.from("kpi_definitions").select("id").limit(2);
  if (!defs?.length) return 0;
  const radky = [];
  for (const d of defs) {
    for (const m of ["2026-04-30", "2026-05-31", "2026-06-30"]) {
      radky.push({
        company_id: companyId,
        kpi_definition_id: d.id,
        value: Math.round(Math.random() * 1000) / 10,
        period_end: m,
        period_type: "month",
        entry_source: "upload",
      });
    }
  }
  const { error } = await jako.from("kpi_values").insert(radky);
  if (error) throw new Error(`seed kpi: ${error.message}`);
  return radky.length;
}

const vysledek = { hackers: [], normal: [], chaos: [], obeti: {}, poznamka: {} };

// ---------- HACKER skupina ----------
console.log("HACKER skupina…");
const betaAdmin = await ucet("beta-admin@example.com");
const betaSuper = await ucet("beta-super@example.com");
const idBeta = await firma("HACK-Beta", betaAdmin);
await clen(betaAdmin, idBeta, "customer_admin");
await clen(betaSuper, idBeta, "customer_superuser");
const kpiBeta = await seedKpi(betaSuper, idBeta);
vysledek.obeti = {
  firma: "HACK-Beta",
  companyId: idBeta,
  adminEmail: betaAdmin.email,
  kpiHodnot: kpiBeta,
};

const h07 = await ucet("h07@example.com");
const idAlfa = await firma("HACK-Alfa", h07);
await clen(h07, idAlfa, "customer_admin");
const hackeri = [
  { ...h07, role: "customer_admin", firma: "HACK-Alfa", companyId: idAlfa, cislo: 7 },
];
const h08 = await ucet("h08@example.com");
await clen(h08, idAlfa, "customer_admin");
hackeri.push({ ...h08, role: "customer_admin", firma: "HACK-Alfa", companyId: idAlfa, cislo: 8 });
for (const n of [1, 2, 3, 4, 5, 6]) {
  const u = await ucet(`h0${n}@example.com`);
  await clen(u, idAlfa, "user");
  hackeri.push({ ...u, role: "user", firma: "HACK-Alfa", companyId: idAlfa, cislo: n });
}
for (const n of [9, 10]) {
  const u = await ucet(`h${n}@example.com`); // outsider: auth účet bez firmy
  hackeri.push({ ...u, role: "(bez firmy)", firma: null, companyId: null, cislo: n });
}
vysledek.hackers = hackeri.sort((a, b) => a.cislo - b.cislo);

// ---------- NORMAL skupina ----------
console.log("NORMAL skupina…");
const normDef = [
  ["NORM-Vyroba", [[1, "customer_admin"], [2, "customer_superuser"], [3, "user"]]],
  ["NORM-Sluzby", [[4, "customer_admin"], [5, "customer_superuser"], [6, "user"]]],
  ["NORM-Ecom", [[7, "customer_admin"], [8, "customer_superuser"], [9, "user"], [10, "customer_admin"]]],
];
for (const [nazev, cleni] of normDef) {
  const zakladatel = await ucet(`n${String(cleni[0][0]).padStart(2, "0")}@example.com`);
  const id = await firma(nazev, zakladatel);
  let superU = null;
  for (const [cislo, role] of cleni) {
    const u =
      cislo === cleni[0][0] ? zakladatel : await ucet(`n${String(cislo).padStart(2, "0")}@example.com`);
    await clen(u, id, role);
    if (role === "customer_superuser") superU = u;
    vysledek.normal.push({ ...u, role, firma: nazev, companyId: id, cislo });
  }
  if (superU) await seedKpi(superU, id);
}
vysledek.normal.sort((a, b) => a.cislo - b.cislo);

// ---------- CHAOS skupina ----------
console.log("CHAOS skupina…");
for (let n = 1; n <= 10; n++) {
  const u = await ucet(`c${String(n).padStart(2, "0")}@example.com`);
  const id = await firma(`CHAOS-${String(n).padStart(2, "0")}`, u);
  await clen(u, id, "customer_admin");
  vysledek.chaos.push({ ...u, role: "customer_admin", firma: `CHAOS-${String(n).padStart(2, "0")}`, companyId: id, cislo: n });
}

vysledek.poznamka = {
  base: "http://localhost:3000",
  anonKey: ANON,
  supabaseUrl: URL,
  vysvetleni:
    "Hackeři znají anonKey (je stejně ve veřejném JS bundlu) a supabaseUrl. Servisní klíč NEMAJÍ. Cíl útoku: HACK-Beta a platform admin.",
};
writeFileSync(".test-persony.json", JSON.stringify(vysledek, null, 2));
console.log(`\nHotovo. Hackeři ${vysledek.hackers.length}, normal ${vysledek.normal.length}, chaos ${vysledek.chaos.length}.`);
console.log(`Oběť HACK-Beta má ${kpiBeta} KPI hodnot. Údaje v .test-persony.json`);
