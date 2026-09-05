// Ověří stránku „Můj účet" a změnu hesla.
//
// PROČ ZROVNA TOHLE: změna hesla je jediné místo v aplikaci, kde se
// ověřuje znalost starého hesla, a dělá se to VLASTNÍM kódem — Supabase
// má sice volbu „Require current password when updating", ale klientská
// knihovna nemá jak staré heslo předat, takže by změna z aplikace vůbec
// neprošla. Ověření tedy stojí a padá s naším endpointem a musí ho hlídat
// test, ne dobrá vůle.
//
// Součástí je i to, že se po změně hesla zneplatní staré sezení. Je to
// bezpečnostní vlastnost (vyhodí i útočníka s ukradeným sezením), ne
// chyba — kdyby zmizela, chceme o tom vědět.
//
// Pracuje se stálým účtem sp-admin@example.com ze scény, kterou zakládá
// test-sprava-pristupu.mjs. Heslo si na začátku přegeneruje.
//
// Spustit: node scripts/test-muj-ucet.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>[l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("thlssdnyqjtkmvpwlsez")) {
  console.error("Tenhle test mění hesla. Pouští se jen proti dev projektu.");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const email = "sp-admin@example.com";
const stare = `Ucet-${randomUUID().slice(0,14)}`;
const nove  = `Nove-${randomUUID().slice(0,14)}`;
const { data: r } = await sb.from("users").select("auth_user_id").eq("email", email).single();
await sb.auth.admin.updateUserById(r.auth_user_id, { password: stare });

const vysledky = [];
const zapis = (n, ok, d="") => { vysledky.push(ok); console.log(`${(ok?"OK":"CHYBA").padEnd(6)} ${n}${d?"  ("+d+")":""}`); };

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded",timeout:120000});
const hp=p.locator('input[placeholder="Heslo"]'), pr=p.getByRole("button",{name:/Zobrazit|Skrýt/});
for(let i=0;i<20;i++){await pr.click().catch(()=>{}); if(await hp.getAttribute("type")==="text"){await pr.click();break;} await p.waitForTimeout(300);}
await p.locator('input[type="email"]').fill(email); await hp.fill(stare);
await p.locator('button[type="submit"]').click();
await p.waitForURL(x=>!x.pathname.startsWith("/login"),{timeout:25000});

const volej = async (cesta, telo) => {
  const o = await p.request.post("http://localhost:3000"+cesta, { data: telo });
  return { stav: o.status(), telo: await o.json().catch(()=>({})) };
};

// 1) jméno
const jmeno = "Zkušební Jméno " + Date.now();
const j = await volej("/api/ucet/jmeno", { jmeno });
const { data: po } = await sb.from("users").select("full_name").eq("email", email).single();
zapis("Změna jména projde", j.stav === 200 && po.full_name === jmeno, `stav ${j.stav}`);

// 2) stránka účtu se načte (ještě s platným sezením)
await p.goto("http://localhost:3000/ucet",{waitUntil:"domcontentloaded",timeout:120000});
await p.waitForTimeout(1500);
const tUcet = await p.locator("body").innerText();
zapis("Stránka Můj účet se načte", tUcet.includes("Můj účet") && tUcet.includes(email));

// 3) špatné staré heslo
const h1 = await volej("/api/ucet/heslo", { stare: "urcite-spatne-heslo", nove });
zapis("Špatné staré heslo neprojde", h1.stav === 403, `stav ${h1.stav}, ${h1.telo.error ?? ""}`);

// 3) krátké nové heslo
const h2 = await volej("/api/ucet/heslo", { stare, nove: "kratke" });
zapis("Krátké nové heslo neprojde", h2.stav === 400, `stav ${h2.stav}`);

// 4) správná změna
const h3 = await volej("/api/ucet/heslo", { stare, nove });
zapis("Správná změna hesla projde", h3.stav === 200, `stav ${h3.stav}, ${h3.telo.error ?? ""}`);

// 5) nové heslo funguje, staré ne
const zk = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: eNove } = await zk.auth.signInWithPassword({ email, password: nove });
const zk2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: eStare } = await zk2.auth.signInWithPassword({ email, password: stare });
zapis("Novým heslem se přihlásím", !eNove);
zapis("Starým heslem už ne", !!eStare);

// 7) po změně hesla je staré sezení zneplatněné — bezpečnostní vlastnost
await p.goto("http://localhost:3000/ucet",{waitUntil:"domcontentloaded",timeout:120000});
await p.waitForTimeout(1500);
zapis("Po změně hesla staré sezení neplatí", new URL(p.url()).pathname === "/login",
      "skončil na " + new URL(p.url()).pathname);

await b.close();
const chyb = vysledky.filter(x=>!x).length;
console.log(`\n${vysledky.length-chyb} prošlo, ${chyb} selhalo.`);
process.exit(chyb ? 1 : 0);
