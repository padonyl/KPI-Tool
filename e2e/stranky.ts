// Seznam veřejných stránek na jednom místě — používá ho kontrola kontrastu
// i test dostupnosti, ať se nemusí udržovat dvakrát.

export const VEREJNE_STRANKY = [
  { cesta: "/", nadpis: /Deset let v provozu/i },
  { cesta: "/about", nadpis: /Postavené na letech v provozu/i },
  { cesta: "/contact", nadpis: /Napiš nám/i },
  { cesta: "/kpi-tool", nadpis: /Data, která už ve firmě máš/i },
  { cesta: "/kpi-tool/pricing", nadpis: /Cen|pilot/i },
  { cesta: "/kpi-tool/faq", nadpis: /Časté otázky/i },
  { cesta: "/kpi-tool/terms", nadpis: /podmínky/i },
  { cesta: "/kpi-tool/privacy", nadpis: /Zásady ochrany osobních údajů/i },
  { cesta: "/login", nadpis: /Přihlášení|heslo/i },
] as const;

/** Staré adresy, které se přestěhovaly pod /kpi-tool (308 redirect). */
export const PRESMEROVANI = [
  { z: "/pricing", na: "/kpi-tool/pricing" },
  { z: "/faq", na: "/kpi-tool/faq" },
  { z: "/terms", na: "/kpi-tool/terms" },
  { z: "/privacy", na: "/kpi-tool/privacy" },
] as const;

/** Adresy, které bez přihlášení nesmí nic ukázat. */
export const CHRANENE_STRANKY = [
  "/dashboard",
  "/kpis",
  "/upload",
  "/upload/manual",
  "/templates",
  "/settings",
  "/team",
] as const;
