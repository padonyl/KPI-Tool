// Zkouška odesílání e-mailů přes Resend — bez čekání na skutečnou registraci.
//
// POUŽITÍ
//   RESEND_API_KEY=re_... MAIL_OWNER=tvuj@email.cz node scripts/test-mail.mjs
//
// Nebo si hodnoty dej do .env.local a spusť jen:
//   node scripts/test-mail.mjs
//
// Pošle přesně tu zprávu, kterou dostaneš při nové registraci, včetně
// odkazů Schválit/Zamítnout. Odkazy vedou na testovací token, takže po
// kliknutí uvidíš "Odkaz už neplatí" — to je správně, ověřuje se tím
// jen doručení a vzhled.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// .env.local se načte, jen když hodnoty nepřijdou z prostředí.
let env = {};
try {
  env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()]),
  );
} catch {
  // soubor nemusí existovat, pokud se vše předává v proměnných
}

const klic = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
const odesilatel =
  process.env.MAIL_FROM ?? env.MAIL_FROM ?? "KPI Tool <onboarding@resend.dev>";
const prijemce = process.env.MAIL_OWNER ?? env.MAIL_OWNER ?? "contact@padonyl.com";
const zaklad =
  process.env.SITE_URL ?? env.SITE_URL ?? "https://padonyl.com";

if (!klic) {
  console.error("Chybí RESEND_API_KEY (v prostředí nebo v .env.local).");
  process.exit(1);
}

console.log("Odesílatel:", odesilatel);
console.log("Příjemce:  ", prijemce);
console.log("Odkazy na: ", zaklad);
console.log();

const { Resend } = await import("resend");

// Šablona se skládá tady, ne importem z src/lib/mail.ts. Node neumí
// spustit TypeScript přímo a kvůli zkušebnímu skriptu nemá smysl kolem
// toho stavět překlad. Obsah je stejný; když se šablona v aplikaci
// změní, je potřeba ji srovnat i tady.
const token = randomUUID();
const html = `
<div style="font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:34rem;color:#111826">
  <h1 style="font-size:1.3rem;margin:0 0 1rem">Nová registrace čeká na schválení</h1>
  <table style="border-collapse:collapse;margin-bottom:1.5rem">
    <tr><td style="padding:.25rem 1rem .25rem 0;color:#47526b">Firma</td><td><strong>Zkušební firma s.r.o.</strong></td></tr>
    <tr><td style="padding:.25rem 1rem .25rem 0;color:#47526b">E-mail</td><td><strong>zkouska@example.com</strong></td></tr>
  </table>
  <p style="margin:0 0 1.25rem;color:#47526b">Do schválení účet nevidí žádná data.</p>
  <p style="margin:0">
    <a href="${zaklad}/api/access?akce=approve&token=${token}" style="display:inline-block;background:#1b3d8f;color:#fff;text-decoration:none;padding:.7rem 1.4rem;border-radius:6px;font-weight:500">Schválit</a>
    <a href="${zaklad}/api/access?akce=reject&token=${token}" style="display:inline-block;margin-left:.75rem;color:#47526b;text-decoration:underline;padding:.7rem 0">Zamítnout</a>
  </p>
  <p style="margin:1.5rem 0 0;font-size:.85rem;color:#7c8698">Toto je ZKUŠEBNÍ zpráva. Odkazy nesou neplatný token, takže po kliknutí uvidíš „Odkaz už neplatí" — tak to má být.</p>
</div>`;

const { data, error } = await new Resend(klic).emails.send({
  from: odesilatel,
  to: prijemce,
  subject: "ZKOUŠKA — Nová registrace: Zkušební firma s.r.o.",
  html,
});

if (error) {
  console.error("Odeslání selhalo:", error.message ?? error);
  console.error("\nNejčastější příčiny:");
  console.error("  * neověřená doména u MAIL_FROM — pro první zkoušku použij onboarding@resend.dev");
  console.error("  * s testovací adresou umí Resend poslat jen na e-mail vlastníka účtu");
  console.error("    → nastav MAIL_OWNER na e-mail, kterým ses do Resendu registroval");
  console.error("  * překlep v klíči, nebo klíč bez oprávnění k odesílání");
  process.exit(1);
}

console.log("Odesláno. Id zprávy:", data?.id);
console.log("Zkontroluj schránku", prijemce, "(případně spam).");
