// Ověří správu přístupů ve firmě (migrace 0013).
//
// CO SE TESTUJE — a proč zrovna tohle:
//   1. Změna role projde.
//   2. Odebrání přístupu projde.
//   3. Odebraný člověk OPRAVDU nevidí data. Tohle je jádro: přepnutý
//      příznak sám o sobě nic nedokazuje, dokud se neověří, že se za
//      ním zavřela i řádková bezpečnost.
//   4. Posledního admina nejde odebrat ani degradovat.
//   5. Admin jedné firmy nesáhne na uživatele jiné firmy.
//
// Bod 5 je tam proto, že všechny tři endpointy sahají na `users` přes
// service_role, který řádkovou bezpečnost obchází úplně — kontrola v
// kódu je tedy jediná hranice, která tam je.
//
// Scénu si zakládá sám a po sobě uklidí. Spustit: node scripts/test-sprava-pristupu.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const ADRESA = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);

// Zakládá a maže firmy — na produkci nemá co dělat.
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("thlssdnyqjtkmvpwlsez")) {
  console.error("Tenhle test zakládá a maže data. Pouští se jen proti dev projektu.");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anonUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const vysledky = [];
function zapis(nazev, proslo, detail = "") {
  vysledky.push({ nazev, proslo });
  console.log(`${(proslo ? "OK" : "CHYBA").padEnd(6)} ${nazev}${detail ? `  (${detail})` : ""}`);
}

const znacka = Date.now();
const uklid = { firmy: [], authIds: [] };

async function zalozUcet(email) {
  const heslo = `Test-${randomUUID().slice(0, 14)}`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: heslo,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  uklid.authIds.push(data.user.id);
  return { email, heslo, authId: data.user.id };
}

/**
 * Najde firmu podle jména, nebo ji založí.
 *
 * ZNOVU POUŽÍVÁ TUTÉŽ FIRMU. Kdyby si test zakládal novou při každém
 * běhu, dev by se plnil prázdnými skořápkami — `service_role` totiž na
 * `companies` právo `delete` nemá (jen select a update), takže po sobě
 * uklidit nedokáže. Dvě stálé firmy jsou lepší než dvě nové týdně.
 */
async function firmaProTest(nazev, zakladatel) {
  const { data: stara } = await sb
    .from("companies").select("id").eq("name", nazev).limit(1).maybeSingle();

  if (stara) {
    // Vyprázdnit po minulém běhu. Pořadí kvůli cizímu klíči
    // activity_log.user_id → users(id).
    await sb.from("activity_log").delete().eq("company_id", stara.id);
    await sb.from("users").delete().eq("company_id", stara.id);
    return stara.id;
  }

  // Firmu zakládá sám uživatel, jako při registraci — service_role na
  // `companies` právo `insert` nemá. Id se generuje tady, protože insert
  // s vrácením řádku by neprošel SELECT politikou (uživatel na firmu v tu
  // chvíli ještě není napojený).
  const companyId = randomUUID();
  const jako = createClient(anonUrl, anonKey);
  const { error: eLogin } = await jako.auth.signInWithPassword({
    email: zakladatel.email, password: zakladatel.heslo,
  });
  if (eLogin) throw new Error(`login zakladatele: ${eLogin.message}`);

  const { error } = await jako.from("companies").insert({ id: companyId, name: nazev });
  if (error) throw new Error(`companies: ${error.message}`);

  // Nová firma vzniká jako 'pending' (migrace 0009) a bez schválení by
  // auth_company_id() vracel null. Schválení jde přes service_role, který
  // na companies `update` má.
  const { error: eSchval } = await sb
    .from("companies").update({ status: "approved" }).eq("id", companyId);
  if (eSchval) throw new Error(`schvaleni: ${eSchval.message}`);

  return companyId;
}

async function napojCleny(companyId, cleni) {
  const radky = cleni.map((c) => ({
    auth_user_id: c.ucet.authId,
    company_id: companyId,
    email: c.ucet.email,
    role: c.role,
  }));
  const { data, error } = await sb.from("users").insert(radky).select("id, email");
  if (error) throw new Error(`users: ${error.message}`);
  return data;
}

/** Přihlásí prohlížeč a vrátí stránku, přes kterou jdou volat API. */
async function prihlas(prohlizec, ucet) {
  const stranka = await (await prohlizec.newContext()).newPage();
  await stranka.goto(`${ADRESA}/login`, { waitUntil: "domcontentloaded" });

  // Počkat na hydrataci — dokud React neběží, fill() zapíše hodnotu do
  // pole, ale stav komponenty zůstane prázdný a odešle se prázdný e-mail.
  const heslo = stranka.locator('input[placeholder="Heslo"]');
  const prepinac = stranka.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 20; i++) {
    await prepinac.click().catch(() => {});
    if ((await heslo.getAttribute("type")) === "text") {
      await prepinac.click();
      break;
    }
    await stranka.waitForTimeout(300);
  }

  await stranka.locator('input[type="email"]').fill(ucet.email);
  await heslo.fill(ucet.heslo);
  await stranka.locator('button[type="submit"]').click();
  await stranka.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  return stranka;
}

async function volej(stranka, cesta, telo) {
  const odpoved = await stranka.request.post(`${ADRESA}${cesta}`, { data: telo });
  return { stav: odpoved.status(), telo: await odpoved.json().catch(() => ({})) };
}

let prohlizec;
try {
  // ---------- scéna ----------
  const uAdmin = await zalozUcet(`sp-admin-${znacka}@example.com`);
  const uClen = await zalozUcet(`sp-clen-${znacka}@example.com`);
  const uCizi = await zalozUcet(`sp-cizi-${znacka}@example.com`);

  const idFirmyA = await firmaProTest("SP-Test-Sprava-A", uAdmin);
  const idFirmyB = await firmaProTest("SP-Test-Sprava-B", uCizi);
  uklid.firmy.push(idFirmyA, idFirmyB);

  const radkyA = await napojCleny(idFirmyA, [
    { ucet: uAdmin, role: "customer_admin" },
    { ucet: uClen, role: "user" },
  ]);
  const radkyB = await napojCleny(idFirmyB, [{ ucet: uCizi, role: "customer_admin" }]);

  const idAdmina = radkyA.find((r) => r.email === uAdmin.email).id;
  const idClena = radkyA.find((r) => r.email === uClen.email).id;
  const idCiziho = radkyB[0].id;

  prohlizec = await chromium.launch();
  const stranka = await prihlas(prohlizec, uAdmin);

  // ---------- 1. změna role ----------
  const r1 = await volej(stranka, "/api/team/role", {
    userId: idClena,
    role: "customer_superuser",
    poznamka: "povýšení v testu",
  });
  const { data: poRoli } = await sb.from("users").select("role").eq("id", idClena).single();
  zapis("Změna role projde", r1.stav === 200 && poRoli.role === "customer_superuser",
        `stav ${r1.stav}, role ${poRoli.role}`);

  // ---------- 2. odebrání přístupu ----------
  const r2 = await volej(stranka, "/api/team/access", {
    userId: idClena,
    status: "deactivated",
    poznamka: "odešel z firmy",
  });
  const { data: poOdebrani } = await sb
    .from("users").select("status, status_reason, status_changed_by").eq("id", idClena).single();
  zapis("Odebrání přístupu projde",
        r2.stav === 200 && poOdebrani.status === "deactivated",
        `stav ${r2.stav}`);
  zapis("Poznámka a autor se uloží",
        poOdebrani.status_reason === "odešel z firmy" && poOdebrani.status_changed_by === idAdmina);

  // ---------- 3. odebraný OPRAVDU nevidí data ----------
  const jakoClen = createClient(anonUrl, anonKey);
  await jakoClen.auth.signInWithPassword({ email: uClen.email, password: uClen.heslo });
  const { data: firmaOcima } = await jakoClen.from("companies").select("id");
  const { data: uploadyOcima } = await jakoClen.from("uploads").select("id");
  zapis("Odebraný nevidí svoji firmu ani data",
        (firmaOcima ?? []).length === 0 && (uploadyOcima ?? []).length === 0,
        `firmy: ${(firmaOcima ?? []).length}, uploady: ${(uploadyOcima ?? []).length}`);

  // ---------- 4. poslední admin ----------
  const r4a = await volej(stranka, "/api/team/access", {
    userId: idAdmina, status: "deactivated",
  });
  zapis("Posledního admina nejde odebrat", r4a.stav === 409, `stav ${r4a.stav}`);

  const r4b = await volej(stranka, "/api/team/role", { userId: idAdmina, role: "user" });
  zapis("Posledního admina nejde degradovat", r4b.stav === 409, `stav ${r4b.stav}`);

  // ---------- 5. cizí firma ----------
  const r5 = await volej(stranka, "/api/team/access", {
    userId: idCiziho, status: "deactivated",
  });
  const { data: cizi } = await sb.from("users").select("status").eq("id", idCiziho).single();
  zapis("Na uživatele cizí firmy nesáhne",
        r5.stav === 404 && cizi.status === "active", `stav ${r5.stav}`);

  // ---------- 6. návrat přes opětovné pozvání ----------
  const r6 = await volej(stranka, "/api/team/invite", { email: uClen.email, role: "user" });
  const { data: poNavratu } = await sb
    .from("users").select("status, role, status_reason").eq("id", idClena).single();
  zapis("Opětovné pozvání vrátí odebraného zpět",
        r6.stav === 200 && poNavratu.status === "active" && poNavratu.role === "user",
        `stav ${r6.stav}, stav uživatele ${poNavratu.status}`);
} catch (e) {
  zapis(`Test spadl: ${e.message}`, false);
} finally {
  if (prohlizec) await prohlizec.close();

  // Úklid v pořadí: activity_log → users → companies. Cizí klíč
  // activity_log.user_id → users(id) nemá určené chování při smazání,
  // takže obrácené pořadí by selhalo.
  for (const id of uklid.firmy) {
    await sb.from("activity_log").delete().eq("company_id", id);
    await sb.from("users").delete().eq("company_id", id);
  }
  for (const id of uklid.authIds) await sb.auth.admin.deleteUser(id);
  // Firmy zůstávají prázdné a příští běh je použije znovu — smazat je
  // nejde, service_role na `companies` právo `delete` nemá.
  console.log(`\nUklizeno: ${uklid.authIds.length} účtů, firmy vyprázdněny.`);
}

const chyby = vysledky.filter((v) => !v.proslo).length;
console.log(`${vysledky.length - chyby} prošlo, ${chyby} selhalo.`);
process.exit(chyby ? 1 : 0);
