// Očista uživatelského textu před zápisem do databáze.
//
// PROČ: Postgres `text` neunese bajt U+0000 (NUL) a zápis s ním shodí
// dotaz hláškou „unsupported Unicode escape sequence". V route handleru
// to znamenalo neošetřený HTTP 500 (nález testu 2026-09-06, /api/ucet/jmeno);
// u klientských insertů syrovou anglickou hlášku. Uživatelský vstup nesmí
// nikdy shodit server — proto se řídicí znaky odstraní hned na vstupu.
//
// Filtruje se podle KÓDU znaku, ne regexem s literály — literální řídicí
// bajty ve zdrojáku jsou křehké a špatně se čtou.
//
// Odstraní se:
//   * C0 řídicí znaky (U+0000–U+001F) kromě tabu a nových řádků (9,10,13),
//     DEL (U+007F) a C1 řídicí znaky (U+0080–U+009F);
//   * znaky s nulovou šířkou (ZWSP/ZWNJ/ZWJ, BOM) a řízení směru textu
//     (BiDi) — neviditelné znaky, kterými se dá text maskovat.
//
// Běžná diakritika, emoji ani mezery se nedotýkají.

function jeRidici(c: number): boolean {
  if (c <= 0x1f && c !== 9 && c !== 10 && c !== 13) return true; // C0 kromě \t\n\r
  if (c === 0x7f) return true; // DEL
  if (c >= 0x80 && c <= 0x9f) return true; // C1
  if (c === 0x200b || c === 0x200c || c === 0x200d || c === 0xfeff) return true; // zero-width
  if (c >= 0x200e && c <= 0x200f) return true; // LRM/RLM
  if (c >= 0x202a && c <= 0x202e) return true; // BiDi embeddings/overrides
  if (c >= 0x2066 && c <= 0x2069) return true; // BiDi isolates
  return false;
}

/** Odstraní řídicí a neviditelné znaky a ořeže okraje. */
export function ocistiText(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c !== undefined && !jeRidici(c)) out += ch;
  }
  return out.trim();
}
