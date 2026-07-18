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
    description: "Hodnoty v čase po jednotlivých KPI (draft, bez grafů)",
  },
  {
    href: "/upload",
    label: "Nahrát data",
    description: "Rozcestník podle typu dat — KPI čísla, report dodávek...",
  },
  {
    href: "/settings",
    label: "Nastavení",
    description: "Tolerance pro OTIF (provizorní, předělá se)",
  },
];
