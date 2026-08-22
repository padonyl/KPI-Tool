import { Resend } from "resend";

// ------------------------------------------------------------
// Odesílání transakčních e-mailů (2026-08-22).
//
// Resend přes HTTP API, ne SMTP. Ze serverless funkcí je SMTP pomalé a
// spojení mu občas vyprší dřív, než se stihne odeslat - HTTP request
// tenhle problém nemá. Supabase si dál posílá vlastní auth e-maily přes
// Zoho SMTP, to je oddělená cesta a nechává se být.
//
// Bez RESEND_API_KEY se e-mail NEODEŠLE, ale nic nespadne: zaloguje se
// do konzole serveru. Díky tomu jde appka nasadit i před dokončením
// nastavení Resendu a registrace kvůli tomu neselže.
// ------------------------------------------------------------

/** Adresa, ze které se posílá. Musí být na ověřené doméně v Resendu. */
const ODESILATEL = process.env.MAIL_FROM ?? "KPI Tool <noreply@padonyl.com>";

/** Komu chodí provozní notifikace (nové registrace apod.). */
const VLASTNIK = process.env.MAIL_OWNER ?? "contact@padonyl.com";

export async function posliVlastnikovi(params: {
  predmet: string;
  html: string;
}): Promise<{ error: string | null }> {
  const klic = process.env.RESEND_API_KEY;

  if (!klic) {
    console.warn(
      `[mail] RESEND_API_KEY chybí, e-mail se neodeslal: "${params.predmet}"`,
    );
    return { error: null };
  }

  try {
    const resend = new Resend(klic);
    const { error } = await resend.emails.send({
      from: ODESILATEL,
      to: VLASTNIK,
      subject: params.predmet,
      html: params.html,
    });
    if (error) {
      console.error("[mail]", error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (e) {
    const zprava = e instanceof Error ? e.message : "neznámá chyba";
    console.error("[mail]", zprava);
    return { error: zprava };
  }
}

/** Notifikace o nové registraci, včetně odkazů na schválení a zamítnutí. */
export function sablonaNovaRegistrace(params: {
  email: string;
  firma: string;
  token: string;
  zaklad: string;
}): { predmet: string; html: string } {
  const schvalit = `${params.zaklad}/api/access?akce=approve&token=${params.token}`;
  const zamitnout = `${params.zaklad}/api/access?akce=reject&token=${params.token}`;

  return {
    predmet: `Nová registrace: ${params.firma}`,
    html: `
<div style="font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:34rem;color:#111826">
  <h1 style="font-size:1.3rem;margin:0 0 1rem">Nová registrace čeká na schválení</h1>
  <table style="border-collapse:collapse;margin-bottom:1.5rem">
    <tr><td style="padding:.25rem 1rem .25rem 0;color:#47526b">Firma</td><td><strong>${params.firma}</strong></td></tr>
    <tr><td style="padding:.25rem 1rem .25rem 0;color:#47526b">E-mail</td><td><strong>${params.email}</strong></td></tr>
  </table>
  <p style="margin:0 0 1.25rem;color:#47526b">Do schválení účet nevidí žádná data.</p>
  <p style="margin:0">
    <a href="${schvalit}" style="display:inline-block;background:#1b3d8f;color:#fff;text-decoration:none;padding:.7rem 1.4rem;border-radius:6px;font-weight:500">Schválit</a>
    <a href="${zamitnout}" style="display:inline-block;margin-left:.75rem;color:#47526b;text-decoration:underline;padding:.7rem 0">Zamítnout</a>
  </p>
  <p style="margin:1.5rem 0 0;font-size:.85rem;color:#7c8698">Odkazy jsou jednorázové — po použití přestanou platit.</p>
</div>`,
  };
}
