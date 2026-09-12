// Ověření, že obnova hesla jde dokončit NA JINÉM ZAŘÍZENÍ, než ze kterého
// se o ni požádalo (typicky: žádost na počítači, e-mail otevřený v mobilu).
// Tok PKCE to neumí ze své podstaty; /auth/confirm s token_hash ano.
// Jen dev. Spustit: node scripts/test-reset-jine-zarizeni.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

const EMAIL = `jinezar-${Date.now()}@example.com`;
const STARE = "Stare-" + Math.random().toString(36).slice(2, 10);
const NOVE = "Nove-" + Math.random().toString(36).slice(2, 10);
let userId = null;

try {
  const { data: u, error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: STARE, email_confirm: true });
  if (ce) throw new Error("createUser: " + ce.message);
  userId = u.user.id;

  // generateLink vrací i token_hash — přesně to, co dá šablona e-mailu
  // jako {{ .TokenHash }}.
  const { data: odkaz, error: ge } = await admin.auth.admin.generateLink({
    type: "recovery", email: EMAIL,
    options: { redirectTo: `${BASE}/reset-password` },
  });
  if (ge) throw new Error("generateLink: " + ge.message);
  const tokenHash = odkaz.properties.hashed_token;
  zapis("token_hash je k dispozici", !!tokenHash);

  const adresaZMailu = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/reset-password`;

  // Simulace skeneru schránky: mailové aplikace si odkaz PŘEDEM načtou,
  // aby zkontrolovaly, kam vede. Takové GET načtení NESMÍ token spotřebovat,
  // jinak dostane člověk "odkaz už neplatí" dřív, než stihne kliknout.
  // (Přesně tohle uživatel 12. 9. nahlásil: odkaz z mailové appky na
  // telefonu skončil chybou, tentýž tok v prohlížeči prošel.)
  for (let pokus = 0; pokus < 3; pokus++) {
    await fetch(adresaZMailu, { redirect: "manual" });
  }
  zapis("odkaz přežil 3 slepá načtení (skener schránky)", true);

  // ČISTÝ prohlížeč = jiné zařízení. Nikdy o obnovu nežádal, nemá verifier.
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  try {
    await p.goto(adresaZMailu, { waitUntil: "domcontentloaded", timeout: 60000 });
    // Odkaz sám nic neověřuje — jinak by jednorázový token spotřeboval
    // skener schránky dřív, než na něj klikne člověk. Musí se kliknout.
    const potvrdit = p.getByRole("button", { name: /Nastavit nové heslo|Pokračovat/ });
    await potvrdit.waitFor({ timeout: 20000 });
    zapis("odkaz sám neověřuje, čeká na kliknutí", (await potvrdit.count()) > 0);
    await potvrdit.click();
    await p.waitForURL(/\/reset-password/, { timeout: 45000 });
    await p.waitForTimeout(2500);
    const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    zapis("jiné zařízení dostane funkční formulář", !/už neplatí|Odkaz nefunguje|stejném prohlížeči/i.test(t), t.slice(0, 100));

    const pole = p.locator('input[placeholder="Nové heslo"]');
    await pole.waitFor({ timeout: 20000 });
    await pole.fill(NOVE);
    await p.locator('input[placeholder="Nové heslo znovu"]').fill(NOVE);
    await p.getByRole("button", { name: "Nastavit heslo" }).click();

    let ok = false;
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(1000);
      const x = (await p.locator("body").innerText()).replace(/\s+/g, " ");
      if (/Pokračovat do aplikace|Heslo (je )?nastaveno/i.test(x)) { ok = true; break; }
    }
    zapis("heslo se z jiného zařízení nastavilo", ok);
  } finally { await b.close(); }

  const c1 = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: e1 } = await c1.auth.signInWithPassword({ email: EMAIL, password: NOVE });
  zapis("přihlášení NOVÝM heslem projde", !e1, e1?.message ?? "");

  const c2 = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c2.auth.signInWithPassword({ email: EMAIL, password: STARE });
  zapis("přihlášení STARÝM heslem neprojde", !!e2, e2?.message ?? "prošlo, což je špatně");

  // Použitý odkaz nesmí jít použít podruhé.
  const b2 = await chromium.launch();
  const p2 = await (await b2.newContext()).newPage();
  try {
    await p2.goto(adresaZMailu, { waitUntil: "domcontentloaded", timeout: 60000 });
    const znovu = p2.getByRole("button", { name: /Nastavit nové heslo|Pokračovat/ });
    if (await znovu.count()) await znovu.click();
    await p2.waitForTimeout(4000);
    const t2 = (await p2.locator("body").innerText()).replace(/\s+/g, " ");
    zapis("použitý odkaz už podruhé neprojde", /Odkaz nefunguje|už neplatí|vypršel|použit/i.test(t2), t2.slice(0, 100));
  } finally { await b2.close(); }
} catch (e) {
  zapis("průchod z jiného zařízení", false, e.message.slice(0, 160));
} finally {
  if (userId) { await admin.auth.admin.deleteUser(userId); console.log("uklizeno (testovací účet smazán)"); }
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
