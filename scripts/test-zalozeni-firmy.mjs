// Založení firmy po rozdělení údajů do tří tabulek (migrace 0017).
//
// Zakládání se přesunulo z prohlížeče na server (/api/firma/zalozit),
// protože `authenticated` už do company_profile ani company_classification
// zapisovat nesmí. Tahle cesta je nová, takže se musí projít celá:
// firmě mají vzniknout VŠECHNY tři řádky plus napojený uživatel.
//
// Jen dev, po sobě uklidí. Spustit:
//   node scripts/test-zalozeni-firmy.mjs [base]

import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const EMAIL = `zalozeni-${Date.now()}@example.com`;
const HESLO = "Heslo-Test-12345";
const NAZEV = `E2E-Zalozeni-${Date.now()}`;
let authId = null;
let companyId = null;

try {
  const { data: u, error } = await sb.auth.admin.createUser({
    email: EMAIL, password: HESLO, email_confirm: true,
  });
  if (error) throw new Error("createUser: " + error.message);
  authId = u.user.id;

  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  // Odposlech odpovědi ze serveru — bez něj se z UI nepozná, co selhalo.
  p.on("response", async (res) => {
    if (res.url().includes("/api/firma")) {
      let telo = "";
      try { telo = (await res.text()).slice(0, 200); } catch {}
      console.log("  [net] " + res.status() + " " + res.url().split("/").slice(3).join("/") + "  " + telo);
    }
  });

  try {
    await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    const hp = p.locator('input[placeholder="Heslo"]');
    const pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
    for (let i = 0; i < 60; i++) {
      await pr.click().catch(() => {});
      if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
      await p.waitForTimeout(500);
    }
    await p.locator('input[type="email"]').fill(EMAIL);
    await hp.fill(HESLO);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 60000 });

    await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(1500);

    const formular = p.getByRole("button", { name: "Založit firmu" });
    zapis("účet bez firmy dostane formulář na založení", (await formular.count()) > 0);

    await p.locator('input[type="text"]').first().fill(NAZEV);
    // Sektor a velikost: vzít první skutečnou volbu (ne placeholder).
    const selecty = p.locator("select");
    for (let i = 0; i < (await selecty.count()); i++) {
      const volby = await selecty.nth(i).locator("option").all();
      for (const v of volby) {
        const hodnota = await v.getAttribute("value");
        if (hodnota) { await selecty.nth(i).selectOption(hodnota); break; }
      }
    }

    await formular.click();
    await p.waitForTimeout(4000);

    const txt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    const chybova = txt.match(/(nepodařilo[^.]*.|Nastala chyba[^.]*.)/i);
    zapis("založení neskončilo chybou", !chybova, chybova ? chybova[0] : txt.slice(0, 200));
  } finally {
    await b.close();
  }

  // --- kontrola v databázi: vznikly VŠECHNY tři řádky? ---
  const { data: uzivatel } = await sb
    .from("users").select("id, company_id, role").eq("auth_user_id", authId).maybeSingle();
  zapis("uživatel je napojený na firmu", !!uzivatel?.company_id);
  zapis("zakladatel dostal roli admina", uzivatel?.role === "customer_admin", uzivatel?.role);

  if (uzivatel?.company_id) {
    companyId = uzivatel.company_id;

    const { data: firma } = await sb
      .from("companies").select("status").eq("id", companyId).maybeSingle();
    zapis("firma čeká na schválení", firma?.status === "pending", firma?.status);

    const { data: profil } = await sb
      .from("company_profile").select("name").eq("company_id", companyId).maybeSingle();
    zapis("vznikl profil se správným názvem", profil?.name === NAZEV, profil?.name ?? "(chybí)");

    const { data: klas } = await sb
      .from("company_classification")
      .select("sector_id, size_band_id, country, changed_at")
      .eq("company_id", companyId).maybeSingle();
    zapis("vzniklo zařazení", !!klas);
    zapis("zařazení má vyplněný obor i velikost", !!klas?.sector_id && !!klas?.size_band_id);
    zapis("země je předvyplněná na CZ", klas?.country === "CZ", klas?.country ?? "(prázdné)");
    // Zásadní: po založení nesmí běžet 24h zámek, jinak by si nový zákazník
    // nemohl hned opravit překlep v zařazení.
    zapis("po založení neběží zámek (changed_at je prázdné)", klas?.changed_at === null,
      String(klas?.changed_at));
  }
} catch (e) {
  zapis("průchod založením", false, e.message.slice(0, 140));
} finally {
  if (companyId) await sb.from("companies").delete().eq("id", companyId);
  if (authId) await sb.auth.admin.deleteUser(authId);
  console.log("\nuklizeno (firma i účet smazány)");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
