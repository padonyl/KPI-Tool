// Jediné místo, kam se při přidání nové stránky appky zapisuje odkaz -
// NavBar i homepage z něj čtou, ať se nemusí upravovat na dvou místech.
export type NavLink = {
  href: string;
  label: string;
  description: string;
};

export const APP_LINKS: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Přehled firmy a přihlášeného uživatele",
  },
  {
    href: "/kpis",
    label: "Přehled KPI",
    description: "Měsíční dashboard s grafy a vyhodnocením podle cílů",
  },
  {
    href: "/upload",
    label: "Nahrát data",
    description: "Vyber šablonu a nahraj soubor",
  },
  {
    href: "/templates",
    label: "Šablony",
    description: "Správa šablon pro nahrávání (mapovací prostředí)",
  },
  {
    href: "/settings",
    label: "Nastavení",
    description: "Tolerance a cíle pro KPI (provizorní, předělá se)",
  },
  {
    href: "/team",
    label: "Tým",
    description: "Pozvat kolegu a nastavit mu roli (jen pro admina firmy)",
  },
  {
    href: "/ucet",
    label: "Můj účet",
    description: "Vlastní jméno a heslo — nastavení osoby, ne firmy",
  },
];

// ------------------------------------------------------------
// Rozhodnuto 2026-08-14: web je o FIRMĚ Padonyl, tool je jeden z toho, co
// firma dělá - ne naopak. Všechno produktové proto žije pod jedním prefixem
// /kpi-tool/*, který půjde jednou odříznout na vlastní doménu jedním řezem,
// až tool dostane vlastní název. Mezipatro /products vědomě NENÍ - u jedné
// položky by to byl jen rozcestník na sebe sama; přidá se s druhým produktem.
// Viz znacka_a_marketingovy_web.md.
// ------------------------------------------------------------

/** Firemní úroveň - o Padonylu, ne o konkrétním nástroji. */
export const MARKETING_LINKS: NavLink[] = [
  { href: "/kpi-tool", label: "KPI Tool", description: "Produkt: sledování KPI z dat, která firma už má" },
  { href: "/about", label: "O nás", description: "Kdo za Padonylem stojí a jak pracujeme" },
  { href: "/contact", label: "Kontakt", description: "Napište nám" },
];

/** Podnavigace uvnitř produktu - zobrazuje se jen na /kpi-tool/*. */
export const KPI_TOOL_LINKS: NavLink[] = [
  { href: "/kpi-tool", label: "Přehled", description: "Co nástroj dělá a pro koho" },
  { href: "/kpi-tool/pricing", label: "Ceník", description: "Pilotní program a budoucí cena" },
  { href: "/kpi-tool/faq", label: "Časté otázky", description: "Co firmy nejčastěji zajímá" },
];

/** Právní dokumenty - patří k nástroji (upravují užívání Služby), ne k firmě. */
export const KPI_TOOL_LEGAL_LINKS: NavLink[] = [
  { href: "/kpi-tool/terms", label: "Obchodní podmínky", description: "Podmínky užívání Služby" },
  { href: "/kpi-tool/privacy", label: "Ochrana osobních údajů", description: "Jak nakládáme s daty" },
];
