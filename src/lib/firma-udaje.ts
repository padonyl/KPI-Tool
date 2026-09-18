import { ocistiText } from "@/lib/text";

// Firemní údaje — validace a porovnání. Vytaženo z API routy zvlášť, aby
// šlo testovat bez serveru (a aby se pravidla dala číst na jednom místě).
//
// Údaje jsou ve dvou tabulkách podle toho, kdo a za jakých podmínek je smí
// měnit (migrace 0017):
//   company_profile        — identifikace a fakturace, admin mění volně
//   company_classification — zařazení pro benchmarking, nejvýš 1× za 24 h

/** Kolik hodin musí uplynout mezi dvěma změnami zařazení. */
export const ZAMEK_HODIN = 24;

/** Pole, která smí /api/firma zapsat. Co tu není, se ignoruje. */
export const POLE_PROFIL = [
  "name",
  "ico",
  "dic",
  "billing_address",
  "billing_email",
  "website",
] as const;

export const POLE_KLASIFIKACE = ["sector_id", "size_band_id", "country"] as const;

export type Profil = Partial<Record<(typeof POLE_PROFIL)[number], string | null>>;
export type Klasifikace = Partial<Record<(typeof POLE_KLASIFIKACE)[number], string | null>>;

/** Prázdný řetězec ukládáme jako NULL — ať se „nevyplněno" nepíše dvěma způsoby. */
function textNeboNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const ocistene = ocistiText(v).trim();
  return ocistene === "" ? null : ocistene;
}

export function pripravProfil(vstup: unknown): Profil {
  const o = (vstup ?? {}) as Record<string, unknown>;
  const out: Profil = {};
  for (const pole of POLE_PROFIL) out[pole] = textNeboNull(o[pole]);
  return out;
}

export function pripravKlasifikaci(vstup: unknown): Klasifikace {
  const o = (vstup ?? {}) as Record<string, unknown>;
  const out: Klasifikace = {};
  for (const pole of POLE_KLASIFIKACE) out[pole] = textNeboNull(o[pole]);
  return out;
}

/**
 * Kontrola vstupu. Vrací hlášku pro uživatele, nebo null když je vše v pořádku.
 *
 * IČO se kontroluje i na kontrolní číslici, ne jen na osm číslic — překlep
 * v IČO se jinak pozná až na faktuře, kterou úřad odmítne.
 */
export function zkontrolujUdaje(profil: Profil, klasifikace: Klasifikace): string | null {
  if (!profil.name) return "Název firmy musí být vyplněný.";
  if (profil.name.length > 200) return "Název firmy je moc dlouhý (nejvýš 200 znaků).";

  if (profil.ico) {
    if (!/^\d{8}$/.test(profil.ico)) return "IČO musí mít přesně 8 číslic.";
    if (!sediKontrolniCislice(profil.ico)) return "IČO neprošlo kontrolou — zkontroluj číslice.";
  }

  if (profil.dic && !/^[A-Za-z]{2}[0-9A-Za-z]{2,13}$/.test(profil.dic)) {
    return "DIČ má mít tvar např. CZ12345678.";
  }

  if (profil.billing_email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(profil.billing_email)) {
    return "Fakturační e-mail nevypadá jako platná adresa.";
  }

  for (const [pole, hodnota] of Object.entries({ ...profil, ...klasifikace })) {
    if (typeof hodnota === "string" && hodnota.length > 500) {
      return `Hodnota v poli „${pole}" je moc dlouhá.`;
    }
  }

  return null;
}

/** Kontrolní číslice IČO (modulo 11 s vahami 8..2). */
export function sediKontrolniCislice(ico: string): boolean {
  const c = [...ico].map(Number);
  let soucet = 0;
  for (let i = 0; i < 7; i++) soucet += c[i] * (8 - i);
  const zbytek = soucet % 11;
  const ocekavana = zbytek === 0 ? 1 : zbytek === 1 ? 0 : 11 - zbytek;
  return c[7] === ocekavana;
}

/** Která pole se oproti uloženému stavu skutečně změnila. */
export function zmenenaPole<T extends Record<string, unknown>>(
  nova: T,
  stara: Record<string, unknown> | null,
): string[] {
  const out: string[] = [];
  for (const [pole, hodnota] of Object.entries(nova)) {
    const puvodni = stara?.[pole] ?? null;
    if ((hodnota ?? null) !== puvodni) out.push(pole);
  }
  return out;
}

/**
 * Zbývající zámek na zařazení, v hodinách (zaokrouhleno nahoru). 0 = volno.
 *
 * Počítá se od poslední SKUTEČNÉ změny hodnoty, ne od posledního uložení —
 * jinak by se dal formulář omylem zamknout tím, že ho někdo otevře a uloží
 * beze změny.
 */
export function zbyvajiciZamekHodin(changedAt: string | null, ted = new Date()): number {
  if (!changedAt) return 0;
  const od = new Date(changedAt).getTime();
  if (!Number.isFinite(od)) return 0;
  const uplynulo = (ted.getTime() - od) / 3_600_000;
  const zbyva = ZAMEK_HODIN - uplynulo;
  return zbyva > 0 ? Math.ceil(zbyva) : 0;
}
