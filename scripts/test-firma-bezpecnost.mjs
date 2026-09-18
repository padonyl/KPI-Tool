// Bezpečnost nových firemních tabulek (migrace 0017).
//
// Ptáme se na to, co se přidáním tabulek mohlo rozbít:
//   1. Vidí uživatel JEN svoji firmu, nebo i cizí?
//   2. Může zapisovat přímo do databáze a obejít tím appku (a 24h zámek)?
//   3. Může si přepsat `status` a schválit si vlastní firmu?
//   4. Drží kontroly v /api/firma (role, cizí firma, zámek)?
//
// Body 2 a 3 jsou podstatné: appka posílá dotazy z prohlížeče pod identitou
// uživatele, takže cokoliv, na co má `authenticated` právo, jde zavolat
// i mimo aplikaci — curlem s vlastním tokenem.
//
// Jen dev, běží na existujících testovacích účtech, po sobě uklidí.
// Spustit: node scripts/test-firma-bezpecnost.mjs [base]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");
const bezny = P.normal.find((n) => n.role === "user");
// Druhá firma = obět pokusu o přečtení/změnu cizích dat.
const cizi = P.normal.find((n) => n.companyId && n.companyId !== admin.companyId)
  ?? P.chaos?.find((n) => n.companyId && n.companyId !== admin.companyId);
if (!cizi) { console.error("nenašel jsem druhou firmu mezi personami"); process.exit(1); }

console.log("moje firma:  " + admin.companyId);
console.log("cizí firma:  " + cizi.companyId + "\n");

async function prihlas(ucet) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: ucet.email, password: ucet.heslo });
  if (error) throw new Error("login " + ucet.email + ": " + error.message);
  return { klient: c, token: data.session.access_token };
}

const { klient: jakoAdmin, token: tokenAdmina } = await prihlas(admin);
const { token: tokenBezneho } = await prihlas(bezny);

// === 1. Čtení: vidím jen svoje? ===
{
  const { data: vse } = await jakoAdmin.from("company_profile").select("company_id, name");
  const ciziVidim = (vse ?? []).filter((r) => r.company_id !== admin.companyId);
  zapis("v company_profile vidím jen svoji firmu", ciziVidim.length === 0,
    "vráceno " + (vse?.length ?? 0) + " řádků");

  const { data: cilene } = await jakoAdmin
    .from("company_profile").select("name").eq("company_id", cizi.companyId);
  zapis("cílený dotaz na cizí profil nic nevrátí", (cilene?.length ?? 0) === 0);

  const { data: klas } = await jakoAdmin.from("company_classification").select("company_id");
  const ciziKlas = (klas ?? []).filter((r) => r.company_id !== admin.companyId);
  zapis("v company_classification vidím jen svoji firmu", ciziKlas.length === 0,
    "vráceno " + (klas?.length ?? 0) + " řádků");
}

// === 2. Přímý zápis mimo aplikaci ===
// Přes REST s vlastním tokenem — přesně to, co by udělal někdo, kdo chce
// obejít 24h zámek. Musí selhat i na VLASTNÍ firmě.
async function rest(cesta, metoda, telo, token) {
  const r = await fetch(URL_ + "/rest/v1/" + cesta, {
    method: metoda,
    headers: {
      apikey: ANON,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: telo ? JSON.stringify(telo) : undefined,
  });
  return { stav: r.status, text: (await r.text()).slice(0, 160) };
}

{
  const u = await rest(
    "company_classification?company_id=eq." + admin.companyId, "PATCH",
    { country: "XX" }, tokenAdmina);
  zapis("přímý UPDATE zařazení (vlastní firma) neprojde", u.stav >= 400,
    "HTTP " + u.stav + " " + u.text);

  const i = await rest("company_profile", "POST",
    { company_id: cizi.companyId, name: "Podvrh" }, tokenAdmina);
  zapis("přímý INSERT profilu cizí firmě neprojde", i.stav >= 400, "HTTP " + i.stav);

  const p = await rest(
    "company_profile?company_id=eq." + admin.companyId, "PATCH",
    { name: "Přejmenováno mimo appku" }, tokenAdmina);
  zapis("přímý UPDATE profilu (vlastní firma) neprojde", p.stav >= 400, "HTTP " + p.stav);

  const d = await rest(
    "company_profile?company_id=eq." + cizi.companyId, "DELETE", null, tokenAdmina);
  zapis("přímé DELETE cizího profilu neprojde", d.stav >= 400, "HTTP " + d.stav);
}

// === 3. Sebeschválení ===
{
  // Porovnává se stav PŘED pokusem a PO něm. Dřív tu stálo
  // `stav.status !== "approved" || true`, což je konstanta — tvrzení
  // nemohlo selhat a nic netvrdilo (vzor P7).
  const { data: pred } = await sb.from("companies").select("status").eq("id", admin.companyId).single();

  const s = await rest("companies?id=eq." + admin.companyId, "PATCH",
    { status: "rejected" }, tokenAdmina);
  zapis("admin si nemůže přepsat status firmy", s.stav >= 400, "HTTP " + s.stav);

  const { data: po } = await sb.from("companies").select("status").eq("id", admin.companyId).single();
  zapis("status firmy se pokusem nezměnil", po.status === pred.status,
    pred.status + " -> " + po.status);
}

// === 4. Kontroly v /api/firma ===
{
  // Bez přihlášení (routa čte session z cookie, Bearer jí nestačí).
  const bez = await fetch(BASE + "/api/firma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profil: { name: "X" } }),
  });
  zapis("nepřihlášený na /api/firma neprojde", bez.status === 401 || bez.status === 403,
    "HTTP " + bez.status);

  // Běžný uživatel (role user) nesmí měnit firemní údaje. Musí se to volat
  // z prohlížeče — routa čte session z cookie, Bearer token jí nestačí.
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  try {
    await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    const hp = p.locator('input[placeholder="Heslo"]');
    const pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
    for (let i = 0; i < 60; i++) {
      await pr.click().catch(() => {});
      if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
      await p.waitForTimeout(500);
    }
    await p.locator('input[type="email"]').fill(bezny.email);
    await hp.fill(bezny.heslo);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 60000 });

    const vysledek = await p.evaluate(async () => {
      const r = await fetch("/api/firma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil: { name: "Pokus běžného uživatele" } }),
      });
      return { stav: r.status, telo: await r.text() };
    });
    zapis("běžný uživatel (ne admin) na /api/firma neprojde", vysledek.stav === 403,
      "HTTP " + vysledek.stav + " " + vysledek.telo.slice(0, 80));

    const { data: profil } = await sb.from("company_profile")
      .select("name").eq("company_id", bezny.companyId).single();
    zapis("název firmy se tím pokusem nezměnil", profil.name !== "Pokus běžného uživatele",
      profil.name);
  } finally {
    await b.close();
  }
}

// === 5. Zámek na zařazení (přes service_role, ať se netahá prohlížeč) ===
{
  const { data: pred } = await sb.from("company_classification")
    .select("changed_at, country").eq("company_id", admin.companyId).single();

  // Simulace: zařazení změněno právě teď → zámek musí běžet.
  await sb.from("company_classification")
    .update({ changed_at: new Date().toISOString() }).eq("company_id", admin.companyId);

  const { zbyvajiciZamekHodin } = await import("../src/lib/firma-udaje.ts");
  const zbyva = zbyvajiciZamekHodin(new Date().toISOString());
  zapis("čerstvá změna zamkne zařazení", zbyva > 0, "zbývá " + zbyva + " h");

  const davno = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  zapis("po 25 hodinách je zase odemčeno", zbyvajiciZamekHodin(davno) === 0);
  zapis("bez předchozí změny zámek neběží", zbyvajiciZamekHodin(null) === 0);

  await sb.from("company_classification")
    .update({ changed_at: pred.changed_at }).eq("company_id", admin.companyId);
}

// === 6. Zablokovaný uživatel nevidí ani firemní údaje ===
{
  const { data: radek } = await sb.from("users").select("id, status").eq("email", bezny.email).single();
  await sb.from("users").update({ status: "deactivated" }).eq("id", radek.id);

  const { klient: jakoZablokovany } = await prihlas(bezny);
  const { data: profil } = await jakoZablokovany.from("company_profile").select("name");
  zapis("zablokovaný uživatel neuvidí ani profil firmy", (profil?.length ?? 0) === 0,
    "vráceno " + (profil?.length ?? 0) + " řádků");

  await sb.from("users").update({ status: radek.status }).eq("id", radek.id);
  console.log("  (stav uživatele vrácen na " + radek.status + ")");
}

void tokenBezneho;

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
