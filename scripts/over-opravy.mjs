// Ověří opravy z testu 30 person proti běžícímu buildu.
// Spustit: node scripts/over-opravy.mjs http://localhost:3101
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const ADRESA = (process.argv[2] ?? "http://localhost:3101").replace(/\/$/, "");
const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);

const user = P.normal.find((n) => n.role === "user");
const superU = P.normal.find((n) => n.role === "customer_superuser");
const admin = P.normal.find((n) => n.role === "customer_admin");

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log(`${(ok ? "OK" : "CHYBA").padEnd(6)} ${n}${d ? "  (" + d + ")" : ""}`);
};

const b = await chromium.launch();

async function prihlas(ucet) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(`${ADRESA}/login`, { waitUntil: "domcontentloaded" });
  const hp = p.locator('input[placeholder="Heslo"]');
  const pr = p.getByRole("button", { name: /Zobrazit|Skrýt/ });
  for (let i = 0; i < 20; i++) {
    await pr.click().catch(() => {});
    if ((await hp.getAttribute("type")) === "text") { await pr.click(); break; }
    await p.waitForTimeout(300);
  }
  await p.locator('input[type="email"]').fill(ucet.email);
  await hp.fill(ucet.heslo);
  await p.locator('button[type="submit"]').click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  await p.close();
  return ctx;
}

const BRANA = "Na tuhle stránku má přístup";

async function textStranky(ctx, cesta) {
  const p = await ctx.newPage();
  await p.goto(`${ADRESA}${cesta}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  const t = await p.locator("body").innerText();
  await p.close();
  return t;
}

try {
  // ---- Role gating ----
  const cu = await prihlas(user);
  for (const cesta of ["/upload", "/upload/manual", "/settings", "/templates/new"]) {
    const t = await textStranky(cu, cesta);
    zapis(`user je blokován na ${cesta}`, t.includes(BRANA));
  }
  await cu.close();

  const cs = await prihlas(superU);
  zapis("superuser SMÍ na /upload", !(await textStranky(cs, "/upload")).includes(BRANA));
  zapis("superuser je blokován na /settings (jen admin)", (await textStranky(cs, "/settings")).includes(BRANA));
  await cs.close();

  const ca = await prihlas(admin);
  const tAdminUp = await textStranky(ca, "/upload");
  const tAdminSet = await textStranky(ca, "/settings");
  zapis("admin SMÍ na /upload i /settings", !tAdminUp.includes(BRANA) && !tAdminSet.includes(BRANA));

  // ---- NUL sanitizace (žádný 500) ----
  // "Te" + NUL(U+0000) + "st" + zero-width space(U+200B) — přesně to,
  // co dřív shodilo Postgres a route vrátila 500.
  const spinaveJmeno = "Te" + String.fromCharCode(0x00) + "st" + String.fromCharCode(0x200b);
  const r = await ca.request.post(`${ADRESA}/api/ucet/jmeno`, { data: { jmeno: spinaveJmeno } });
  zapis("NUL ve jméně nevrací 500", r.status() === 200, `stav ${r.status()}`);

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: row } = await sb.from("users").select("full_name").eq("email", admin.email).maybeSingle();
  const jmeno = row?.full_name ?? "";
  zapis("uložené jméno je očištěné na \"Test\"", jmeno === "Test", `"${jmeno}"`);
  await ca.close();
} catch (e) {
  zapis(`spadlo: ${e.message}`, false);
} finally {
  await b.close();
}

const chyb = vysledky.filter((x) => !x).length;
console.log(`\n${vysledky.length - chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
