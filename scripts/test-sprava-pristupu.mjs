// Ověří správu přístupů ve firmě (migrace 0013).
//
// CO SE TESTUJE — a proč zrovna tohle:
//   1. Změna role projde.
//   2. Odebrání přístupu projde, poznámka a autor se uloží.
//   3. Odebraný člověk OPRAVDU nevidí data ani svoji firmu. Tohle je
//      jádro: přepnutý příznak sám o sobě nic nedokazuje, dokud se
//      neověří, že se za ním zavřela i řádková bezpečnost.
//   4. Posledního admina nejde odebrat ani degradovat.
//   5. Admin jedné firmy nesáhne na uživatele jiné firmy.
//   6. Opětovné pozvání odebraného ho vrátí zpět.
//
// Bod 5 je tam proto, že všechny tři endpointy sahají na `users` přes
// service_role, který řádkovou bezpečnost obchází úplně — kontrola v
// kódu je tedy jediná hranice, která tam je.
//
// ------------------------------------------------------------
// PROČ TEST NIC NEMAŽE
// ------------------------------------------------------------
// `service_role` nemá právo `delete` na `activity_log` (má jen select a
// insert) ani na `companies`. Není to opomenutí — auditní stopa se mazat
// nemá a firmu ruší jiný proces. A protože `activity_log.user_id`
// odkazuje na `users(id)` bez určeného chování při smazání, nejdou
// smazat ani uživatelé, jakmile po nich zůstal záznam.
//
// První verze tohohle testu si to neuvědomila, mazala a chybu spolkla —
// takže se tvářila, že uklidila, a další běh pak padal na zbytcích po
// tom minulém. Proto test pracuje se STÁLOU scénou: dvě firmy a tři
// účty s pevnými adresami, které se na začátku každého běhu jen vrátí
// do výchozího stavu. Dev se tím neplní a běhy na sebe nesahají.
//
// Spustit: node scripts/test-sprava-pristupu.mjs
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

// Zakládá firmy a mění uživatele — na produkci nemá co dělat.
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("thlssdnyqjtkmvpwlsez")) {
  console.error("Tenhle test zakládá a mění data. Pouští se jen proti dev projektu.");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anonUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FIRMA_A = "SP-Test-Sprava-A";
const FIRMA_B = "SP-Test-Sprava-B";

const vysledky = [];
function zapis(nazev, proslo, detail = "") {
  vysledky.push({ nazev, proslo });
  console.log(`${(proslo ? "OK" : "CHYBA").padEnd(6)} ${nazev}${detail ? `  (${detail})` : ""}`);
}

/** Vytvoří nebo obnoví přihlašovací účet. Heslo se pokaždé přegeneruje. */
async function ucet(email) {
  const heslo = `Test-${randomUUID().slice(0, 14)}`;

  const { data: radek } = await sb
    .from("users").select("id, auth_user_id").eq("email", email).limit(1).maybeSingle();

  if (radek?.auth_user_id) {
    const { error } = await sb.auth.admin.updateUserById(radek.auth_user_id, { password: heslo });
    if (error) throw new Error(`obnova hesla ${email}: ${error.message}`);
    return { email, heslo, authId: radek.auth_user_id, userId: radek.id };
  }

  const { data, error } = await sb.auth.admin.createUser({
    email, password: heslo, email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return { email, heslo, authId: data.user.id, userId: null };
}

/** Najde firmu podle jména, nebo ji nechá založit zakladatelem. */
async function firma(nazev, zakladatel) {
  const { data: stara } = await sb
    .from("companies").select("id").eq("name", nazev).limit(1).maybeSingle();
  if (stara) return stara.id;

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
  // auth_company_id() vracel null.
  const { error: eSchval } = await sb
    .from("companies").update({ status: "approved" }).eq("id", companyId);
  if (eSchval) throw new Error(`schvaleni: ${eSchval.message}`);
  return companyId;
}

/** Vrátí člena do výchozího stavu, nebo ho založí. */
async function clen(ucetUzivatele, companyId, role) {
  const vychozi = {
    role, status: "active", status_reason: null,
    status_changed_at: null, status_changed_by: null,
  };

  if (ucetUzivatele.userId) {
    const { error } = await sb.from("users").update(vychozi).eq("id", ucetUzivatele.userId);
    if (error) throw new Error(`reset ${ucetUzivatele.email}: ${error.message}`);
    return ucetUzivatele.userId;
  }

  const { data, error } = await sb
    .from("users")
    .insert({
      auth_user_id: ucetUzivatele.authId,
      company_id: companyId,
      email: ucetUzivatele.email,
      ...vychozi,
    })
    .select("id").single();
  if (error) throw new Error(`zalozeni ${ucetUzivatele.email}: ${error.message}`);
  return data.id;
}

/**
 * Zneškodní cizí uživatele ve zkušební firmě.
 *
 * Zbytky po starších verzích testu smazat nejdou (viz úvodní komentář),
 * ale dají se odstavit — jinak by ve firmě zůstal druhý aktivní admin a
 * pojistka „poslední admin" by nezabrala. Přesně na tomhle první běh
 * po přepsání spadl.
 */
async function odstavCizi(companyId, ponechat) {
  const { data: vsichni } = await sb
    .from("users").select("id").eq("company_id", companyId);
  const navic = (vsichni ?? []).filter((u) => !ponechat.includes(u.id)).map((u) => u.id);
  if (!navic.length) return 0;
  await sb.from("users").update({ role: "user", status: "deactivated" }).in("id", navic);
  return navic.length;
}

async function prihlas(prohlizec, u) {
  const stranka = await (await prohlizec.newContext()).newPage();
  await stranka.goto(`${ADRESA}/login`, { waitUntil: "domcontentloaded" });

  // Počkat na hydrataci — dokud React neběží, fill() zapíše hodnotu do
  // pole, ale stav komponenty zůstane prázdný a odešle se prázdný e-mail.
  const heslo = stranka.locator('input[placeholder="Heslo"]');
  const prepinac = stranka.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 20; i++) {
    await prepinac.click().catch(() => {});
    if ((await heslo.getAttribute("type")) === "text") { await prepinac.click(); break; }
    await stranka.waitForTimeout(300);
  }

  await stranka.locator('input[type="email"]').fill(u.email);
  await heslo.fill(u.heslo);
  await stranka.locator('button[type="submit"]').click();
  await stranka.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 20_000 });
  return stranka;
}

async function volej(stranka, cesta, telo) {
  const odpoved = await stranka.request.post(`${ADRESA}${cesta}`, { data: telo });
  return { stav: odpoved.status(), telo: await odpoved.json().catch(() => ({})) };
}

let prohlizec;
try {
  const uAdmin = await ucet("sp-admin@example.com");
  const uClen = await ucet("sp-clen@example.com");
  const uCizi = await ucet("sp-cizi@example.com");

  const idFirmyA = await firma(FIRMA_A, uAdmin);
  const idFirmyB = await firma(FIRMA_B, uCizi);

  const idAdmina = await clen(uAdmin, idFirmyA, "customer_admin");
  const idClena = await clen(uClen, idFirmyA, "user");
  const idCiziho = await clen(uCizi, idFirmyB, "customer_admin");

  const odstaveno = await odstavCizi(idFirmyA, [idAdmina, idClena]);
  if (odstaveno) console.log(`(odstaveno ${odstaveno} cizích uživatelů ve zkušební firmě)\n`);

  prohlizec = await chromium.launch();
  const stranka = await prihlas(prohlizec, uAdmin);

  // ---------- 1. změna role ----------
  const r1 = await volej(stranka, "/api/team/role", {
    userId: idClena, role: "customer_superuser", poznamka: "povýšení v testu",
  });
  const { data: poRoli } = await sb.from("users").select("role").eq("id", idClena).single();
  zapis("Změna role projde", r1.stav === 200 && poRoli.role === "customer_superuser",
        `stav ${r1.stav}, role ${poRoli.role}`);

  // ---------- 2. odebrání přístupu ----------
  const r2 = await volej(stranka, "/api/team/access", {
    userId: idClena, status: "deactivated", poznamka: "odešel z firmy",
  });
  const { data: poOdebrani } = await sb
    .from("users").select("status, status_reason, status_changed_by").eq("id", idClena).single();
  zapis("Odebrání přístupu projde",
        r2.stav === 200 && poOdebrani.status === "deactivated", `stav ${r2.stav}`);
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
  const r4a = await volej(stranka, "/api/team/access", { userId: idAdmina, status: "deactivated" });
  zapis("Posledního admina nejde odebrat", r4a.stav === 409, `stav ${r4a.stav}`);

  const r4b = await volej(stranka, "/api/team/role", { userId: idAdmina, role: "user" });
  zapis("Posledního admina nejde degradovat", r4b.stav === 409, `stav ${r4b.stav}`);

  // ---------- 5. cizí firma ----------
  const r5 = await volej(stranka, "/api/team/access", { userId: idCiziho, status: "deactivated" });
  const { data: cizi } = await sb.from("users").select("status").eq("id", idCiziho).single();
  zapis("Na uživatele cizí firmy nesáhne",
        r5.stav === 404 && cizi.status === "active", `stav ${r5.stav}`);

  // ---------- 6. návrat přes opětovné pozvání ----------
  const r6 = await volej(stranka, "/api/team/invite", { email: uClen.email, role: "user" });
  const { data: poNavratu } = await sb
    .from("users").select("status, role").eq("id", idClena).single();
  zapis("Opětovné pozvání vrátí odebraného zpět",
        r6.stav === 200 && poNavratu.status === "active" && poNavratu.role === "user",
        `stav ${r6.stav}, stav uživatele ${poNavratu.status}`);
} catch (e) {
  zapis(`Test spadl: ${e.message}`, false);
} finally {
  if (prohlizec) await prohlizec.close();
}

const chyby = vysledky.filter((v) => !v.proslo).length;
console.log(`\n${vysledky.length - chyby} prošlo, ${chyby} selhalo.`);
process.exit(chyby ? 1 : 0);
