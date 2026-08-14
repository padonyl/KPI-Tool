// Co je u kterého KPI potřeba nastavit.
//
// Nastavení je řízené vybraným KPI: uživatel vybere KPI a vyskočí mu přesně
// ty bloky, které to KPI potřebuje - ne pevný seznam sekcí, ve kterém většina
// nedává pro dané KPI smysl.
//
// Dnes je bloků málo (cíl platí pro všechna, tolerance u OTIF žije v šabloně),
// ale struktura je připravená na to, co je rozepsané v kpi_katalog.md - např.
// volba varianty vzorce u Produktivity (finanční vs. fyzická) nebo koeficient
// u Úrazovosti. Až taková nastavení vzniknou, přidá se sem další blok.

export type SettingBlock =
  /** Hranice, od které se KPI vyhodnocuje zeleně/červeně. Platí pro každé KPI. */
  | "target"
  /**
   * Odvozená KPI (dnes OTIF) mají tolerance uložené v konfiguraci šablony,
   * protože je smysluplné mít je pro každý zdroj dat jiné. Tady se jen
   * vysvětlí, kde je hledat - nastavovat je na dvou místech by znamenalo,
   * že jedno z nich tiše nic nedělá.
   */
  | "tolerance-in-template";

export type KpiForSettings = {
  id: string;
  name: string;
  unit: string;
  is_derived: boolean;
};

export function settingBlocksFor(kpi: KpiForSettings): SettingBlock[] {
  const blocks: SettingBlock[] = ["target"];
  if (kpi.is_derived) blocks.push("tolerance-in-template");
  return blocks;
}
