// Pořadí rolí uvnitř firmy a kontrola minima pro přístup na stránku.
//
// Zjištěno testem 2026-09-06: zápisové a konfigurační stránky (/upload,
// /upload/manual, /settings, /templates/new) kontrolovaly jen přihlášení,
// ne roli — přišel na ně i `user` (jen čtení). Data ochránila řádková
// bezpečnost (zápis stejně neprošel), ale UI nemá nabízet obrazovku, na
// které dotyčný nic nesvede. Tenhle pomocník tu kontrolu sjednocuje.
//
// Zdroj pravdy o rolích je Postgres enum user_role; tady jen jejich
// pořadí pro porovnání „aspoň superuser".

export type Role = "user" | "customer_superuser" | "customer_admin";

const PORADI: Record<string, number> = {
  user: 0,
  customer_superuser: 1,
  customer_admin: 2,
};

/** Má `role` aspoň úroveň `minimum`? Neznámá role = nejnižší (0). */
export function maAspon(role: string | null | undefined, minimum: Role): boolean {
  return (PORADI[role ?? ""] ?? -1) >= PORADI[minimum];
}

/** Lidský popis minima pro zdvořilou hlášku. */
export const POPIS_MINIMA: Record<Role, string> = {
  user: "uživatel",
  customer_superuser: "superuser (nahrává data)",
  customer_admin: "admin firmy",
};
