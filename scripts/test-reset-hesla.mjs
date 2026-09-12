// Ověření celé cesty obnovy hesla: odkaz z e-mailu → /auth/callback →
// /reset-password → nastavení hesla → přihlášení novým heslem.
// Chytilo by chybu "Auth session missing!" (relace se neuložila, protože
// výměna kódu běžela při vykreslování serverové komponenty).
// Jen dev, jede na jednorázovém účtu, který po sobě smaže.
// Spustit: node scripts/test-reset-hesla.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => { vysledky.push(ok); console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`); };

const EMAIL = `reset-${Date.now()}@example.com`;
const STARE = "StareHeslo-" + Math.random().toString(36).slice(2, 10);
const NOVE = "NoveHeslo-" + Math.random().toString(36).slice(2, 10);
let userId = null;

try {
  const { data: vytvoreny, error: ce } = await admin.auth.admin.createUser({
    email: EMAIL, password: STARE, email_confirm: true,
  });
  if (ce) throw new Error("createUser: " + ce.message);
  userId = vytvoreny.user.id;

  const { data: odkaz, error: ge } = await admin.auth.admin.generateLink({
    type: "recovery", email: EMAIL,
    options: { redirectTo: `${BASE}/auth/callback?next=/reset-password` },
  });
  if (ge) throw new Error("generateLink: " + ge.message);
  zapis("odkaz na obnovu vygenerován", true);

  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  p.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  try {
    await p.goto(odkaz.properties.action_link, { waitUntil: "domcontentloaded", timeout: 60000 });
    // callback dokončí přihlášení a přesměruje na /reset-password
    await p.waitForURL(/\/reset-password/, { timeout: 45000 });
    zapis("odkaz dovede na nastavení hesla", true);

    // Formulář se smí ukázat jen tehdy, když relace opravdu existuje.
    await p.waitForTimeout(2500);
    const txt = () => p.locator("body").innerText().then((t) => t.replace(/\s+/g, " "));
    const t1 = await txt();
    zapis("relace z odkazu platí (nehlásí neplatný odkaz)", !/už neplatí|Odkaz nefunguje/i.test(t1), t1.slice(0, 90));

    const pole = p.locator('input[placeholder="Nové heslo"]');
    await pole.waitFor({ timeout: 20000 });

    // Přepínač zobrazení hesla (chyběl, doplněno 12. 9.)
    const prepinac = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
    zapis("jde si zobrazit, co píšu", (await prepinac.count()) > 0);
    if (await prepinac.count()) {
      await prepinac.first().click();
      zapis("přepínač opravdu odkryje heslo", (await pole.getAttribute("type")) === "text");
    }

    await pole.fill(NOVE);
    await p.locator('input[placeholder="Nové heslo znovu"]').fill(NOVE);
    await p.getByRole("button", { name: "Nastavit heslo" }).click();

    let ok = false;
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(1000);
      const t = await txt();
      if (/Pokračovat do aplikace|Heslo (je )?nastaveno|hotovo/i.test(t)) { ok = true; break; }
      if (/Auth session missing|session/i.test(t)) { console.log("  hláška:", t.slice(0, 200)); break; }
    }
    zapis("heslo se nastavilo bez chyby", ok, ok ? "" : (await txt()).slice(0, 160));
  } finally {
    await b.close();
  }

  // Větev PKCE (?code=) běží nově taky v prohlížeči. Neplatný kód musí
  // skončit srozumitelnou hláškou, ne tichým průchodem na formulář, který
  // pak spadne na "Auth session missing!".
  {
    const b2 = await chromium.launch();
    const p2 = await (await b2.newContext()).newPage();
    try {
      await p2.goto(`${BASE}/auth/callback?code=nesmysl-neplatny-kod&next=/reset-password`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p2.waitForTimeout(4000);
      const t = (await p2.locator("body").innerText()).replace(/s+/g, " ");
      zapis("neplatný kód PKCE hlásí chybu, ne prázdný formulář", /Odkaz nefunguje/i.test(t), t.slice(0, 110));
      zapis("hláška u neplatného kódu není anglická surovina", !/Auth session missing|invalid request|code verifier/i.test(t));
    } finally { await b2.close(); }
  }

  // Skutečný důkaz: nové heslo funguje, staré ne.
  const c1 = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e1 } = await c1.auth.signInWithPassword({ email: EMAIL, password: NOVE });
  zapis("přihlášení NOVÝM heslem projde", !e1, e1?.message ?? "");

  const c2 = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c2.auth.signInWithPassword({ email: EMAIL, password: STARE });
  zapis("přihlášení STARÝM heslem neprojde", !!e2, e2?.message ?? "prošlo, což je špatně");
} catch (e) {
  zapis("průchod obnovou hesla", false, e.message.slice(0, 160));
} finally {
  if (userId) { await admin.auth.admin.deleteUser(userId); console.log("uklizeno (testovací účet smazán)"); }
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
