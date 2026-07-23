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
];
