// Brána přístupu: kdo nemá mít přístup, vidí JEN nástěnku a nikam se
// nedostane. Prochází stavy zablokován / pozastaveno / aktivní.
// Jen dev, stav uživatele vrací zpět. Spustit:
//   node scripts/test-brana-pristupu.mjs [base]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL;
if (!U.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
const sb = createClient(U, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const obet = P.normal.find((n) => n.role === "user") ?? P.normal[P.normal.length - 1];
const { data: pred } = await sb.from("users").select("id, status").eq("email", obet.email).single();

const CESTY = ["/kpis", "/upload", "/templates", "/settings", "/team", "/ucet"];

async function projdi(popis, ocekavamNastenku, nadpis) {
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
    await p.locator('input[type="email"]').fill(obet.email);
    await hp.fill(obet.heslo);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 60000 });

    await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(1500);
    const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");

    console.log("\n--- " + popis);
    if (ocekavamNastenku) {
      zapis("nástěnka ukazuje správný důvod", t.includes(nadpis), nadpis);
      zapis("neukazuje smyšlenou firmu „?“", !t.includes("FIRMA ?") && !t.includes("Firma ?"));
      zapis("netvrdí „Čeká na schválení“, když nejde o čekání",
        nadpis === "Firma čeká na schválení" || !t.includes("Čeká na schválení"));
      zapis("nenabízí dlaždice do appky", !t.includes("Přehled KPI") && !t.includes("Nahrát data"));
      zapis("neukazuje interní důvod odebrání", !t.includes("pokusny duvod"));

      const prosly = [];
      for (const c of CESTY) {
        await p.goto(BASE + c, { waitUntil: "domcontentloaded", timeout: 60000 });
        await p.waitForTimeout(900);
        if (new URL(p.url()).pathname !== "/dashboard") prosly.push(c);
      }
      zapis("žádná chráněná cesta neprojde", prosly.length === 0,
        prosly.length ? "prošlo: " + prosly.join(", ") : CESTY.length + " cest odkloněno");
    } else {
      zapis("aktivní uživatel vidí svoji firmu", t.includes("NORM-Vyroba"));
      zapis("aktivní uživatel má dlaždice", t.includes("Přehled KPI"));
      await p.goto(BASE + "/kpis", { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(900);
      zapis("aktivní uživatel se dostane na /kpis", new URL(p.url()).pathname === "/kpis");
    }
  } catch (e) {
    zapis(popis, false, e.message.slice(0, 120));
  } finally {
    await b.close();
  }
}

try {
  await sb.from("users").update({ status: "active", status_reason: null }).eq("id", pred.id);
  await projdi("AKTIVNÍ uživatel", false);

  await sb.from("users").update({ status: "deactivated", status_reason: "pokusny duvod" }).eq("id", pred.id);
  await projdi("ZABLOKOVANÝ (admin odebral přístup)", true, "Přístup byl odebrán");

  await sb.from("users").update({ status: "suspended", status_reason: "pokusny duvod" }).eq("id", pred.id);
  await projdi("POZASTAVENÝ provozovatelem", true, "Účet je pozastavený");
} finally {
  await sb.from("users").update({ status: pred.status, status_reason: null }).eq("id", pred.id);
  console.log("\nstav uživatele vrácen na: " + pred.status);
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
