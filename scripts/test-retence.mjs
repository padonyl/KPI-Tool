// Automatická retence: maže to, co má, a NEMAŽE to, co nemá.
//
// Druhá část je důležitější. Test, který jen ověří „něco se smazalo",
// projde i funkci, která smaže úplně všechno — a to je u retence ta nejhorší
// možná chyba, protože je nevratná. Proto se tu vždycky zakládá dvojice:
// jedna věc prošlá a jedna čerstvá, a kontroluje se OBOJÍ.
//
// Jen dev, po sobě uklidí. Spustit: node scripts/test-retence.mjs [base]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_.includes("thlssdnyqjtkmvpwlsez")) { console.error("Jen dev."); process.exit(1); }
if (!env.CRON_SECRET) { console.error("Chybí CRON_SECRET v .env.local"); process.exit(1); }
const sb = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const vysledky = [];
const zapis = (n, ok, d = "") => {
  vysledky.push(ok);
  console.log((ok ? "OK" : "CHYBA").padEnd(6) + " " + n + (d ? "  (" + d + ")" : ""));
};

const P = JSON.parse(readFileSync(".test-persony.json", "utf8"));
const admin = P.normal.find((n) => n.role === "customer_admin");
const jako = createClient(URL_, ANON, { auth: { persistSession: false } });
{
  const { error } = await jako.auth.signInWithPassword({ email: admin.email, password: admin.heslo });
  if (error) { console.error("login: " + error.message); process.exit(1); }
}
const { data: mujRadek } = await jako.from("users").select("id").eq("email", admin.email).single();

const NAZEV_SABLONY = `RETENCE-TEST-${Date.now()}`;
const RETENCE_DNI = 30;
const pred = (dni) => new Date(Date.now() - dni * 86_400_000).toISOString();

let templateId = null;
const uklid = [];

try {
  // === příprava: šablona s retencí 30 dní ===
  templateId = randomUUID();
  {
    const { error } = await jako.from("upload_templates").insert({
      id: templateId, company_id: admin.companyId, name: NAZEV_SABLONY,
      date_column_name: "datum", period_type: "month",
      source_columns: ["datum", "castka"],
      store_rows: true, rows_retention_days: RETENCE_DNI, created_by: mujRadek.id,
    });
    if (error) throw new Error("šablona: " + error.message);
  }

  // === dvojice nahrání: jedno prošlé (60 dní), jedno čerstvé (2 dny) ===
  async function zalozNahrani(stariDni, znacka) {
    const cesta = `${admin.companyId}/retence-test-${znacka}-${Date.now()}.csv`;
    const { error: e1 } = await sb.storage.from("company-uploads")
      .upload(cesta, new Blob(["datum,castka\n2026-01-15,100\n"], { type: "text/csv" }));
    if (e1) throw new Error("soubor do úložiště: " + e1.message);

    const { data, error: e2 } = await jako.from("uploads").insert({
      company_id: admin.companyId, uploaded_by: mujRadek.id,
      file_name: `retence-${znacka}.csv`, storage_path: cesta,
      template_id: templateId, status: "processed",
      uploaded_at: pred(stariDni),
    }).select("id").single();
    if (e2) throw new Error("nahrání: " + e2.message);

    const { error: e3 } = await jako.from("source_rows").insert({
      company_id: admin.companyId, upload_id: data.id, template_id: templateId,
      period_end: "2026-01-31", period_type: "month",
      data: { datum: "2026-01-15", castka: "100" },
      created_at: pred(stariDni),
    });
    if (e3) throw new Error("řádek: " + e3.message);

    uklid.push({ uploadId: data.id, cesta });
    return { id: data.id, cesta };
  }

  const prosle = await zalozNahrani(60, "prosle");
  const cerstve = await zalozNahrani(2, "cerstve");
  zapis("připravena dvojice: prošlé (60 dní) i čerstvé (2 dny)", true,
    "retence šablony " + RETENCE_DNI + " dní");

  // === zabezpečení routy ===
  {
    const bez = await fetch(BASE + "/api/cron/retence");
    zapis("bez tajemství routa neprojde", bez.status === 401, "HTTP " + bez.status);

    const spatne = await fetch(BASE + "/api/cron/retence", {
      headers: { Authorization: "Bearer nesmysl" },
    });
    zapis("se špatným tajemstvím neprojde", spatne.status === 401, "HTTP " + spatne.status);
  }

  // === ostrý běh ===
  const odpoved = await fetch(BASE + "/api/cron/retence", {
    headers: { Authorization: "Bearer " + env.CRON_SECRET },
  });
  const vysledek = await odpoved.json().catch(() => ({}));
  zapis("retence proběhla", odpoved.status === 200,
    "HTTP " + odpoved.status + " " + JSON.stringify(vysledek).slice(0, 110));

  // === co zmizelo a co zůstalo ===
  const { data: radkyProsle } = await sb.from("source_rows").select("id").eq("upload_id", prosle.id);
  zapis("prošlý ŘÁDEK je smazaný", (radkyProsle?.length ?? 0) === 0,
    "zbylo " + (radkyProsle?.length ?? 0));

  const { data: radkyCerstve } = await sb.from("source_rows").select("id").eq("upload_id", cerstve.id);
  zapis("čerstvý řádek ZŮSTAL", (radkyCerstve?.length ?? 0) === 1,
    "zbylo " + (radkyCerstve?.length ?? 0));

  const { data: nahrProsle } = await sb.from("uploads")
    .select("storage_path, file_deleted_at").eq("id", prosle.id).single();
  zapis("prošlý SOUBOR je označený za smazaný",
    nahrProsle.file_deleted_at !== null && nahrProsle.storage_path === null,
    "cesta=" + nahrProsle.storage_path + ", smazano=" + nahrProsle.file_deleted_at);

  const { data: nahrCerstve } = await sb.from("uploads")
    .select("storage_path, file_deleted_at").eq("id", cerstve.id).single();
  zapis("čerstvý soubor ZŮSTAL", nahrCerstve.file_deleted_at === null && nahrCerstve.storage_path !== null);

  // Soubor opravdu zmizel z úložiště, ne jen z evidence.
  {
    const { data: stazeny } = await sb.storage.from("company-uploads").download(prosle.cesta);
    zapis("prošlý soubor už v úložišti není", !stazeny);
    const { data: porad } = await sb.storage.from("company-uploads").download(cerstve.cesta);
    zapis("čerstvý soubor v úložišti pořád je", !!porad);
  }

  // SAP dataset se retencí nesměl dotknout (jeho šablona má jinou retenci).
  {
    const { count } = await sb.from("source_rows").select("*", { count: "exact", head: true });
    zapis("SAP dataset zůstal nedotčený", (count ?? 0) >= 3878, count + " řádků celkem");
  }

  // === záznam o běhu ===
  {
    const { data: behy } = await sb.from("retence_behy")
      .select("radku_smazano, souboru_smazano, dokonceno_at, chyba")
      .order("spusteno_at", { ascending: false }).limit(1);
    const b = behy?.[0];
    zapis("běh se zapsal do evidence", !!b);
    zapis("běh je označený za dokončený bez chyby", !!b?.dokonceno_at && !b?.chyba, b?.chyba ?? "");
    zapis("evidence uvádí, že se něco smazalo",
      (b?.radku_smazano ?? 0) >= 1 && (b?.souboru_smazano ?? 0) >= 1,
      "řádků " + b?.radku_smazano + ", souborů " + b?.souboru_smazano);
  }
} catch (e) {
  zapis("průchod retencí", false, e.message.slice(0, 160));
} finally {
  // Dotaz ze supabase-js není promise, dokud se neawaituje — .catch() na něm
  // spadne. Proto try/catch okolo, ne .catch() na konci řetězu.
  const zkus = async (co) => { try { await co(); } catch { /* úklid nesmí shodit test */ } };
  for (const u of uklid) {
    await zkus(() => sb.storage.from("company-uploads").remove([u.cesta]));
    await zkus(() => sb.from("source_rows").delete().eq("upload_id", u.uploadId));
    await zkus(() => jako.from("uploads").delete().eq("id", u.uploadId));
  }
  if (templateId) await zkus(() => jako.from("upload_templates").delete().eq("id", templateId));
  console.log("\nuklizeno (testovací šablona, nahrání i soubory)");
}

const chyb = vysledky.filter((x) => !x).length;
console.log("\n" + (vysledky.length - chyb) + " prošlo, " + chyb + " selhalo.");
process.exit(chyb ? 1 : 0);
