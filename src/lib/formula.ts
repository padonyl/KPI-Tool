import { parseNumber, parseDateValue, todayIso, endOfMonthIso } from "@/lib/parse-values";
import type { CandidateValue } from "@/lib/kpi-value-writer";
import type { ParsedRow } from "@/lib/template-rules";

// ============================================================
// SLOTOVÝ MODEL VÝPOČTU KPI
// ------------------------------------------------------------
// Dvě úrovně, viz migrace 0004 a datovy_model.md:
//   1) SLOT   - "jak z mých dat dostanu jedno číslo za období"
//               (filtr řádků + sčítání/odčítání sloupců + agregace).
//               Definuje zákazník při tvorbě šablony.
//   2) VZOREC - pracuje už jen s hotovými čísly ze slotů.
//               Vlastní appka (kpi_definitions.formula_spec).
//
// Proč zrovna tahle dělicí čára: sum(A+B) = sum(A)+sum(B), takže
// sčítání/odčítání se smí dít po řádcích. Ale sum(A/B) ≠ sum(A)/sum(B),
// takže dělení musí zůstat až nad agregovanými hodnotami. Zákazník tím
// pádem nemá dělení v ruce a nemůže vyrobit metodicky špatné číslo.
// ============================================================

/** Vzorec KPI tak, jak ho vlastní appka (kpi_definitions.formula_spec). */
export type FormulaSlot = {
  key: string;
  label: string;
  hint?: string;
};

export type FormulaSpec = {
  expression: string;
  slots: FormulaSlot[];
};

/** Jeden sloupec v definici slotu, se znaménkem. Starší tvar, viz slotTokens(). */
export type SlotTerm = {
  column: string;
  op: "+" | "-";
};

/**
 * Prvek, ze kterého uživatel skládá obsah slotu na plátně.
 * Výraz se vyhodnocuje na KAŽDÉM ŘÁDKU zvlášť a teprve výsledky se agregují -
 * proto tu smí být i × a ÷ (např. cena × množství na řádku, pak součet), na
 * rozdíl od vzorce KPI, kde dělení musí až nad agregáty.
 */
export type SlotToken =
  | { kind: "column"; column: string }
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

/** Naplnění jednoho slotu daty zákazníka (žije v template_kpi_rules.config). */
export type SlotDefinition = {
  /** Nový tvar - výraz složený na plátně. */
  tokens?: SlotToken[];
  /** Starší tvar (seznam sloupců se znaménkem). Čte se kvůli už uloženým šablonám. */
  terms?: SlotTerm[];
  /** Volitelné omezení na podmnožinu řádků (např. jen "Typ pohybu = prodej"). */
  filter?: { column: string; value: string };
  /**
   * sum / count / avg pracují s ČÍSLEM spočítaným z výrazu slotu.
   * count_distinct pracuje se SUROVÝM TEXTEM jednoho sloupce - čísla
   * objednávek bývají text ("OBJ-2601") a převod na číslo by je zahodil.
   */
  aggregation: "sum" | "count" | "avg" | "count_distinct";
};

/**
 * Sjednotí oba tvary na tokeny. Starší `terms` se převede na výraz
 * `A + B - C`; případné vedoucí mínus u prvního členu se řeší jako `0 - A`
 * (parser nemá unární mínus, viz insertImplicitZeros níže).
 */
export function slotTokens(slot: SlotDefinition): SlotToken[] {
  if (slot.tokens && slot.tokens.length > 0) return slot.tokens;
  if (slot.terms && slot.terms.length > 0) {
    const out: SlotToken[] = [];
    slot.terms.forEach((term, i) => {
      if (i > 0 || term.op === "-") out.push({ kind: "op", value: term.op });
      out.push({ kind: "column", column: term.column });
    });
    return out;
  }
  return [];
}

/** Sloupce, na které slot odkazuje (bez duplicit). */
export function slotColumns(slot: SlotDefinition): string[] {
  return [
    ...new Set(
      slotTokens(slot)
        .filter((t): t is Extract<SlotToken, { kind: "column" }> => t.kind === "column")
        .map((t) => t.column),
    ),
  ];
}

export type FormulaConfig = {
  slots: Record<string, SlotDefinition>;
};

// ------------------------------------------------------------
// Parser výrazu (shunting-yard -> RPN). Vědomě NE eval():
// gramatika je omezená na čísla, {slot}, + - * / a závorky.
// ------------------------------------------------------------

export type Token =
  | { kind: "num"; value: number }
  | { kind: "slot"; key: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

/**
 * Doplní nulu tam, kde je + nebo − použité unárně (na začátku výrazu, po levé
 * závorce nebo po jiném operátoru): `−A + B` se přepíše na `0 − A + B`.
 *
 * Díky tomu nemusí mít parser vlastní unární operátor a uživatel může na plátně
 * úplně přirozeně začít vzorec mínusem, aniž by to spadlo.
 */
export function insertImplicitZeros(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
      const prev = out[out.length - 1];
      const isUnary = !prev || prev.kind === "lparen" || prev.kind === "op";
      if (isUnary) out.push({ kind: "num", value: 0 });
    }
    out.push(token);
  }
  return out;
}

export function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "{") {
      const end = expression.indexOf("}", i);
      if (end === -1) throw new Error("Neuzavřená složená závorka ve vzorci.");
      tokens.push({ kind: "slot", key: expression.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }

    const numMatch = expression.slice(i).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ kind: "num", value: Number(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }

    throw new Error(`Neznámý znak ve vzorci: „${ch}“`);
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** Převod na reverzní polskou notaci - jednou, výsledek jde vyhodnocovat opakovaně. */
export function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.kind === "num" || token.kind === "slot") {
      output.push(token);
    } else if (token.kind === "op") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.kind === "op" && PRECEDENCE[top.value] >= PRECEDENCE[token.value]) {
          output.push(stack.pop()!);
        } else {
          break;
        }
      }
      stack.push(token);
    } else if (token.kind === "lparen") {
      stack.push(token);
    } else {
      let foundParen = false;
      while (stack.length > 0) {
        const top = stack.pop()!;
        if (top.kind === "lparen") {
          foundParen = true;
          break;
        }
        output.push(top);
      }
      if (!foundParen) throw new Error("Přebývající pravá závorka ve vzorci.");
    }
  }

  while (stack.length > 0) {
    const top = stack.pop()!;
    if (top.kind === "lparen") throw new Error("Neuzavřená levá závorka ve vzorci.");
    output.push(top);
  }

  return output;
}

/**
 * Vyhodnotí vzorec nad už spočítanými hodnotami slotů.
 * Vrací null, pokud výsledek není konečné číslo (typicky dělení nulou -
 * např. hrubá marže při nulových tržbách). Volající to má brát jako
 * "za tohle období se nedá spočítat", ne jako chybu.
 */
export function evaluateRpn(rpn: Token[], slotValues: Record<string, number>): number | null {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.kind === "num") {
      stack.push(token.value);
    } else if (token.kind === "slot") {
      const value = slotValues[token.key];
      if (value === undefined) return null;
      stack.push(value);
    } else if (token.kind === "op") {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) {
        throw new Error("Vzorec je neúplný (chybí operand).");
      }
      if (token.value === "+") stack.push(left + right);
      else if (token.value === "-") stack.push(left - right);
      else if (token.value === "*") stack.push(left * right);
      else stack.push(left / right);
    }
  }

  if (stack.length !== 1) throw new Error("Vzorec je neúplný.");
  const result = stack[0];
  return Number.isFinite(result) ? result : null;
}

/** Zkontroluje, že se vzorec dá naparsovat a odkazuje jen na deklarované sloty. */
export function validateFormulaSpec(spec: FormulaSpec): string | null {
  let tokens: Token[];
  try {
    tokens = tokenizeExpression(spec.expression);
    toRpn(tokens);
  } catch (e) {
    return e instanceof Error ? e.message : "Vzorec se nepodařilo přečíst.";
  }

  const declared = new Set(spec.slots.map((s) => s.key));
  for (const token of tokens) {
    if (token.kind === "slot" && !declared.has(token.key)) {
      return `Vzorec odkazuje na neznámý slot „${token.key}“.`;
    }
  }
  return null;
}

// ------------------------------------------------------------
// Vyhodnocení slotu nad řádky
// ------------------------------------------------------------

/** Převede prvky z plátna na tokeny parseru (sloupec = pojmenovaná hodnota). */
function toParserTokens(tokens: SlotToken[]): Token[] {
  return tokens.map((t) =>
    t.kind === "column" ? ({ kind: "slot", key: t.column } as Token) : (t as Token),
  );
}

/**
 * Zkontroluje výraz složený na plátně. Vrací lidsky srozumitelnou hlášku,
 * nebo null, když je vše v pořádku. Kontroluje se strukturou (dva operátory
 * za sebou apod.) i skutečným parsováním - hlášky ze struktury jsou
 * konkrétnější než "vzorec je neúplný".
 */
export function validateSlotTokens(tokens: SlotToken[]): string | null {
  if (tokens.length === 0) return null; // prázdno není chyba, jen nevyplněno

  const isValue = (t: SlotToken) => t.kind === "column" || t.kind === "num";
  let depth = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (token.kind === "lparen") depth += 1;
    if (token.kind === "rparen") {
      depth -= 1;
      if (depth < 0) return "Je tu závorka „)“ navíc.";
    }

    if (!next) continue;

    if (isValue(token) && isValue(next)) {
      return "Mezi dvěma hodnotami chybí znaménko.";
    }
    if (token.kind === "op" && next.kind === "op") {
      return "Dvě znaménka za sebou — mezi ně patří hodnota.";
    }
    if (isValue(token) && next.kind === "lparen") {
      return "Mezi hodnotou a závorkou chybí znaménko.";
    }
    if (token.kind === "rparen" && isValue(next)) {
      return "Mezi závorkou a hodnotou chybí znaménko.";
    }
    if (token.kind === "lparen" && next.kind === "rparen") {
      return "Prázdná závorka.";
    }
  }

  if (depth > 0) return "Chybí uzavírací závorka „)“.";

  const last = tokens[tokens.length - 1];
  if (last.kind === "op") return "Vzorec končí znaménkem — chybí poslední hodnota.";

  try {
    toRpn(insertImplicitZeros(toParserTokens(tokens)));
  } catch (e) {
    return e instanceof Error ? e.message : "Vzorec se nepodařilo přečíst.";
  }
  return null;
}

/**
 * Spočítá hodnotu jednoho slotu z dané množiny řádků.
 *
 * Postup: filtr řádků -> na KAŽDÉM řádku se vyhodnotí výraz z plátna
 * -> výsledky se agregují (součet/průměr/počet).
 *
 * Chybějící/nečitelná hodnota ve sloupci se bere jako 0 (typicky prázdná
 * buňka „blokovaná zásoba“), ale řádek, kde není čitelný ŽÁDNÝ ze sloupců
 * slotu, se přeskočí celý - jinak by prázdné řádky ředily průměr a
 * nafukovaly count. Řádek, na kterém výraz nedá konečné číslo (dělení
 * nulou), se také přeskočí.
 */
export function evaluateSlot(rows: ParsedRow[], slot: SlotDefinition): number | null {
  const tokens = slotTokens(slot);
  if (tokens.length === 0) return null;
  if (validateSlotTokens(tokens) !== null) return null;

  // Počet různých hodnot se vymyká zbytku: nepočítá se z výrazu, ale ze
  // syrového textu jediného sloupce. Vzniklo z případu, kdy má export
  // řádek na položku objednávky - "počet řádků" by napočítal položky,
  // kdežto počet různých čísel objednávky dá skutečný počet objednávek.
  if (slot.aggregation === "count_distinct") {
    const sloupce = slotColumns(slot);
    // Dává smysl jen nad jedním sloupcem; výraz typu A + B tu nemá význam.
    if (sloupce.length !== 1) return null;
    const sloupec = sloupce[0];

    const videne = new Set<string>();
    for (const row of rows) {
      if (slot.filter) {
        if ((row[slot.filter.column] ?? "").trim() !== slot.filter.value) continue;
      }
      const hodnota = (row[sloupec] ?? "").trim();
      if (hodnota !== "") videne.add(hodnota);
    }
    return videne.size === 0 ? null : videne.size;
  }

  let rpn: Token[];
  try {
    rpn = toRpn(insertImplicitZeros(toParserTokens(tokens)));
  } catch {
    return null;
  }

  const columns = slotColumns(slot);
  const rowValues: number[] = [];

  for (const row of rows) {
    if (slot.filter) {
      if ((row[slot.filter.column] ?? "").trim() !== slot.filter.value) continue;
    }

    const values: Record<string, number> = {};
    let anyParsed = false;
    for (const column of columns) {
      const parsed = parseNumber(row[column] ?? "");
      values[column] = parsed ?? 0;
      if (parsed !== null) anyParsed = true;
    }
    if (!anyParsed) continue;

    let value: number | null;
    try {
      value = evaluateRpn(rpn, values);
    } catch {
      return null;
    }
    if (value === null) continue; // např. dělení nulou na tomhle řádku
    rowValues.push(value);
  }

  if (rowValues.length === 0) return null;

  if (slot.aggregation === "count") return rowValues.length;
  const total = rowValues.reduce((a, b) => a + b, 0);
  if (slot.aggregation === "sum") return total;
  return total / rowValues.length;
}

// ------------------------------------------------------------
// Kompletní výpočet KPI ze souboru
// ------------------------------------------------------------

/**
 * Zarovná konkrétní datum na konec období, do kterého spadá.
 *
 * Bez tohohle by se každý den v souboru stal vlastním "obdobím" a KPI
 * by se počítalo po dnech, i když šablona říká "měsíc" - u víceslotových
 * vzorců by to navíc dělilo hodnoty ze stejného měsíce mezi různé dny
 * a výsledek by byl nesmysl. (Starší typy pravidel direct/aggregated
 * tuhle normalizaci nedělají - viz poznámka v datovy_model.md.)
 */
// ------------------------------------------------------------
// SYSTÉMOVÉ ČLENY VZORCE
//
// Členy, které do vzorce dosazuje aplikace sama - nejsou to zákaznické
// sloty, uživatel je nevyplňuje a na plátně je vidí jako pevnou část
// vzorce, stejně jako „× 100“.
//
// Vzniklo u DSO/DPO/Dnů zásob (2026-08-14): jejich vzorec potřebuje
// „počet dní v období“. Jako konstanta v šabloně by to bylo špatně -
// šablona platí pro všechna nahrání, ale únor má jiný počet dní než
// březen. Ptát se uživatele při každém nahrání je taky zbytečné, když
// appka období už zná: evaluateFormulaByPeriod() počítá KPI po
// obdobích a u každého má periodEnd i periodType. Odvodí si to sama.
// ------------------------------------------------------------

export const SYSTEM_SLOT_LABELS: Record<string, string> = {
  days_in_period: "počet dní v období",
};

export function isSystemSlot(key: string): boolean {
  return key in SYSTEM_SLOT_LABELS;
}

/** Kolik dní má období končící daným datem. */
export function daysInPeriod(periodEnd: string, periodType: string): number | null {
  const [y, m] = periodEnd.split("-").map(Number);
  if (!y || !m) return null;

  if (periodType === "day") return 1;
  if (periodType === "week") return 7;
  if (periodType === "month") return new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (periodType === "quarter") {
    // Součet tří měsíců čtvrtletí, ne paušálních 90 - Q1 má 90 nebo 91 dní.
    const firstMonth = m - 2;
    let total = 0;
    for (let i = 0; i < 3; i += 1) {
      total += new Date(Date.UTC(y, firstMonth + i, 0)).getUTCDate();
    }
    return total;
  }
  if (periodType === "year") {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 366 : 365;
  }
  return null;
}

/** Hodnoty systémových členů pro dané období. */
function systemSlotValues(periodEnd: string, periodType: string): Record<string, number> {
  const values: Record<string, number> = {};
  const days = daysInPeriod(periodEnd, periodType);
  if (days !== null) values.days_in_period = days;
  return values;
}

export function periodEndFor(dateIso: string, periodType: string): string {
  const [y, m] = dateIso.split("-").map(Number);
  if (periodType === "year") return `${y}-12-31`;
  if (periodType === "quarter") {
    const quarterEndMonth = Math.ceil(m / 3) * 3;
    const lastDay = new Date(Date.UTC(y, quarterEndMonth, 0)).getUTCDate();
    return `${y}-${String(quarterEndMonth).padStart(2, "0")}-${lastDay}`;
  }
  if (periodType === "month") return endOfMonthIso(dateIso);
  return dateIso; // 'day' a cokoliv neznámého - beze změny
}

function periodOfRow(
  row: ParsedRow,
  dateColumn: string | null,
  periodType: string,
): { periodEnd: string; periodType: string } | null {
  if (!dateColumn) return { periodEnd: todayIso(), periodType: "day" };
  const parsed = parseDateValue(row[dateColumn] ?? "");
  if (!parsed) return null;
  return { periodEnd: periodEndFor(parsed, periodType), periodType };
}

export type FormulaPeriodResult = {
  periodEnd: string;
  periodType: string;
  slotValues: Record<string, number>;
  /** null = za tohle období vzorec nedal konečné číslo (např. dělení nulou). */
  value: number | null;
  /** Sloty, které v tomhle období neměly žádná čitelná data. */
  missingSlots: string[];
};

/**
 * Spočítá KPI pro každé období v souboru. Vrací i mezivýsledky slotů,
 * protože UI je používá pro náhled ("takhle jsem to pochopil") - to je
 * hlavní způsob, jak uživatel pozná, že mapování sedí, ještě před nahráním.
 */
export function evaluateFormulaByPeriod(
  rows: ParsedRow[],
  dateColumn: string | null,
  periodType: string,
  spec: FormulaSpec,
  config: FormulaConfig,
): FormulaPeriodResult[] {
  const rpn = toRpn(tokenizeExpression(spec.expression));

  const buckets = new Map<string, { periodType: string; rows: ParsedRow[] }>();
  for (const row of rows) {
    const period = periodOfRow(row, dateColumn, periodType);
    if (!period) continue;
    const key = `${period.periodEnd}|${period.periodType}`;
    const bucket = buckets.get(key) ?? { periodType: period.periodType, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }

  const results: FormulaPeriodResult[] = [];

  for (const [key, bucket] of buckets.entries()) {
    const [periodEnd] = key.split("|");
    // Systémové členy první - zákaznický slot se stejným klíčem by je
    // přepsal, ale takový klíč se ve spec.slots nesmí objevit (viz
    // SYSTEM_SLOT_LABELS).
    const slotValues: Record<string, number> = systemSlotValues(
      periodEnd,
      bucket.periodType,
    );
    const missingSlots: string[] = [];

    for (const slotSpec of spec.slots) {
      const definition = config.slots[slotSpec.key];
      if (!definition || slotTokens(definition).length === 0) {
        missingSlots.push(slotSpec.key);
        continue;
      }
      const value = evaluateSlot(bucket.rows, definition);
      if (value === null) {
        missingSlots.push(slotSpec.key);
        continue;
      }
      slotValues[slotSpec.key] = value;
    }

    const value = missingSlots.length > 0 ? null : evaluateRpn(rpn, slotValues);

    results.push({
      periodEnd,
      periodType: bucket.periodType,
      slotValues,
      value: value === null ? null : Math.round(value * 100) / 100,
      missingSlots,
    });
  }

  return results.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

/**
 * Kolik řádků má nečitelné datum a jak vypadají.
 *
 * Vyřazený řádek posune výsledek celého KPI (chybí v součtu, ředí průměr),
 * takže se o něm uživatel musí dozvědět, ne aby zmizel potichu.
 */
export function findUnreadableDates(
  rows: ParsedRow[],
  dateColumn: string | null,
): { count: number; examples: string[] } {
  if (!dateColumn) return { count: 0, examples: [] };

  const bad: string[] = [];
  for (const row of rows) {
    const raw = (row[dateColumn] ?? "").trim();
    if (parseDateValue(raw) === null) bad.push(raw === "" ? "(prázdné)" : raw);
  }

  return { count: bad.length, examples: [...new Set(bad)].slice(0, 5) };
}

/** Převod na kandidáty k uložení - období bez výsledku se vynechají. */
/**
 * Období, které se nepodařilo spočítat, i s důvodem.
 *
 * Vzniklo 2026-08-22: dřív se taková období jen odfiltrovala. U šablony
 * s jedním KPI to skončilo hláškou "žádná čitelná data", u šablony s víc
 * KPI ale nahrání proběhlo jako úspěšné a jedno KPI potichu nemělo za
 * období hodnotu. Zjistilo se to až podle díry v grafu.
 */
export type NespocitaneObdobi = {
  kpiName: string;
  periodEnd: string;
  periodType: string;
  /** Popisky slotů, které se nepodařilo naplnit. */
  sloty: string[];
  /** Sloupce, na které slot odkazuje, ale v souboru nejsou. */
  chybejiciSloupce: string[];
  /** Sloupce, které v souboru jsou, ale nejde z nich přečíst číslo. */
  necitelneSloupce: string[];
};

/**
 * Proč slot nevyšel. Rozlišuje dvě různé příčiny, protože vedou k jiné
 * nápravě: chybějící sloupec znamená přejmenování ve zdroji nebo špatně
 * zvolený řádek s hlavičkou, nečitelný sloupec znamená, že je textový
 * nebo prázdný.
 */
function procSlotNevysel(
  rows: ParsedRow[],
  slot: SlotDefinition,
): { chybejici: string[]; necitelne: string[] } {
  const sloupce = slotColumns(slot);
  if (sloupce.length === 0 || rows.length === 0) {
    return { chybejici: [], necitelne: [] };
  }

  // Hlavičky se berou ze sjednocení klíčů - řádky mohou mít různé sady,
  // když soubor není úplně pravidelný.
  const dostupne = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    for (const klic of Object.keys(row)) dostupne.add(klic);
  }

  const chybejici = sloupce.filter((c) => !dostupne.has(c));
  const necitelne = sloupce
    .filter((c) => dostupne.has(c))
    .filter((c) => !rows.some((row) => parseNumber(row[c] ?? "") !== null));

  return { chybejici, necitelne };
}

export function computeFormulaCandidates(
  rows: ParsedRow[],
  dateColumn: string | null,
  periodType: string,
  spec: FormulaSpec,
  config: FormulaConfig,
  kpiDefinitionId: string,
  kpiName: string,
): { candidates: CandidateValue[]; nespocitane: NespocitaneObdobi[] } {
  const vysledky = evaluateFormulaByPeriod(rows, dateColumn, periodType, spec, config);

  const candidates: CandidateValue[] = [];
  const nespocitane: NespocitaneObdobi[] = [];

  const popisSlotu = new Map(spec.slots.map((sl) => [sl.key, sl.label]));

  for (const r of vysledky) {
    if (r.value !== null) {
      candidates.push({
        kpiDefinitionId,
        kpiName,
        value: r.value,
        periodEnd: r.periodEnd,
        periodType: r.periodType,
      });
      continue;
    }

    // Období se NEZAHAZUJE potichu - posbírat, co se nenaplnilo a proč.
    const chybejici = new Set<string>();
    const necitelne = new Set<string>();

    for (const klic of r.missingSlots) {
      const definice = config.slots[klic];
      if (!definice) continue;
      const duvod = procSlotNevysel(rows, definice);
      duvod.chybejici.forEach((c) => chybejici.add(c));
      duvod.necitelne.forEach((c) => necitelne.add(c));
    }

    nespocitane.push({
      kpiName,
      periodEnd: r.periodEnd,
      periodType: r.periodType,
      sloty: r.missingSlots.map((k) => popisSlotu.get(k) ?? k),
      chybejiciSloupce: [...chybejici],
      necitelneSloupce: [...necitelne],
    });
  }

  return { candidates, nespocitane };
}

const OP_GLYPH: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/**
 * Vzorec KPI v čitelné podobě, s názvy slotů místo klíčů:
 * „(Tržby − Náklady na prodané zboží) ÷ Tržby × 100“.
 *
 * Používá se jako pevná referenční hlavička nad skládáním - i u jednoslotových
 * KPI (např. Stav zásob), kde by jinak nebylo poznat, že tam vůbec nějaký
 * vzorec je.
 */
export function formatKpiFormula(spec: FormulaSpec): string {
  const labels = new Map(spec.slots.map((s) => [s.key, s.label]));
  let out = "";
  let tokens: Token[];
  try {
    tokens = tokenizeExpression(spec.expression);
  } catch {
    return spec.expression;
  }

  tokens.forEach((token, i) => {
    const prev = tokens[i - 1];
    const needsSpace =
      out !== "" && token.kind !== "rparen" && prev?.kind !== "lparen";
    if (needsSpace) out += " ";

    if (token.kind === "slot")
      out += labels.get(token.key) ?? SYSTEM_SLOT_LABELS[token.key] ?? token.key;
    else if (token.kind === "num") out += String(token.value);
    else if (token.kind === "op") out += OP_GLYPH[token.value];
    else out += token.kind === "lparen" ? "(" : ")";
  });

  return out;
}

/** Výraz slotu jako čitelný řetězec, např. „Náklady výroby + Doprava − Sleva“. */
export function formatSlotExpression(slot: SlotDefinition): string {
  return slotTokens(slot)
    .map((t) => {
      if (t.kind === "column") return t.column;
      if (t.kind === "num") return String(t.value);
      if (t.kind === "op") return OP_GLYPH[t.value];
      return t.kind === "lparen" ? "(" : ")";
    })
    .join(" ")
    .replace(/\(\s/g, "(")
    .replace(/\s\)/g, ")");
}

/** Lidsky čitelný popis slotu do souhrnu šablony. */
export function describeSlot(slot: SlotDefinition): string {
  const AGG: Record<string, string> = {
    sum: "součet",
    count: "počet řádků",
    avg: "průměr",
    count_distinct: "počet různých hodnot",
  };
  const filter = slot.filter?.column
    ? ` (jen kde „${slot.filter.column}“ = „${slot.filter.value}“)`
    : "";
  return `${AGG[slot.aggregation]}: ${formatSlotExpression(slot)}${filter}`;
}
