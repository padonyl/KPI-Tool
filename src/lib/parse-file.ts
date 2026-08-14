import ExcelJS from "exceljs";
import Papa from "papaparse";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    return parseCsv(file);
  }
  return parseXlsx(file);
}

/**
 * Přečte CSV jako text a poradí si i s jiným kódováním než UTF-8.
 *
 * Excel na českých Windows ukládá CSV ve Windows-1250, ne v UTF-8 - export
 * z ERP tedy velmi často UTF-8 NENÍ. Kdybychom četli natvrdo jako UTF-8,
 * rozsype se diakritika v názvech sloupců a mapování by bylo k ničemu.
 *
 * Vědomé rozhodnutí: aplikace si s tím poradí sama a mlčky. Uživatel z výroby
 * nemá řešit, v jakém kódování mu Excel soubor uložil - to je náš problém,
 * ne jeho.
 */
function decodeText(buffer: ArrayBuffer): { text: string } {
  const bytes = new Uint8Array(buffer);

  // UTF-8 BOM - zahodit, jinak by se dostal do názvu prvního sloupce.
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasBom ? bytes.subarray(3) : bytes;

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(body) };
  } catch {
    // Není to platné UTF-8 - viz níže.
  }

  // Windows-1250 přeloží každý bajt, takže "nespadne" nikdy - podle úspěchu
  // se rozhodnout nedá. Rozhodujeme podle toho, KOLIK bajtů do UTF-8 nepasuje:
  // u souboru celého ve Windows-1250 je vadná každá diakritika, kdežto
  // u souboru, kde je jen kousek z jiného kódování, jich je pár.
  const brokenRatio = countInvalidUtf8Bytes(body) / Math.max(body.length, 1);

  // Hodně vadných bajtů = soubor je celý v jednom starším kódování. Přeložit
  // ho vcelku je bezpečnější než opravovat po znacích, protože v souvislém
  // textu se občas vyskytnou trojice bajtů, které náhodou vypadají jako
  // platné UTF-8 (např. "ěšž") a po znacích by se přeložily špatně.
  if (brokenRatio > 0.02) {
    return { text: new TextDecoder("windows-1250").decode(body) };
  }

  // Málo vadných bajtů = soubor je v podstatě UTF-8, jen do něj něco přimíchalo
  // pár znaků z Windows-1250 (typicky když někdo dopsal sloupec v jiném
  // editoru). Opravíme je po jednotlivých bajtech - uživatel se o tom nemusí
  // vůbec dozvědět, natož to řešit ručně.
  return { text: decodeUtf8WithWindows1250Fallback(body) };
}

/** Kolik bajtů netvoří platnou UTF-8 sekvenci. */
function countInvalidUtf8Bytes(bytes: Uint8Array): number {
  let invalid = 0;
  let i = 0;
  while (i < bytes.length) {
    const length = utf8SequenceLength(bytes, i);
    if (length === 0) {
      invalid += 1;
      i += 1;
    } else {
      i += length;
    }
  }
  return invalid;
}

/**
 * Délka platné UTF-8 sekvence začínající na pozici `i`, nebo 0 když tam
 * platná sekvence není. Rozsah 0xC2-0xF4 vylučuje přebytečně dlouhé zápisy.
 */
function utf8SequenceLength(bytes: Uint8Array, i: number): number {
  const b = bytes[i];
  if (b < 0x80) return 1;

  const isContinuation = (offset: number) =>
    i + offset < bytes.length && (bytes[i + offset] & 0xc0) === 0x80;

  if (b >= 0xc2 && b <= 0xdf) return isContinuation(1) ? 2 : 0;
  if (b >= 0xe0 && b <= 0xef) return isContinuation(1) && isContinuation(2) ? 3 : 0;
  if (b >= 0xf0 && b <= 0xf4) {
    return isContinuation(1) && isContinuation(2) && isContinuation(3) ? 4 : 0;
  }
  return 0;
}

/** Tabulka horní poloviny Windows-1250, ať se nedekóduje bajt po bajtu přes TextDecoder. */
let windows1250Upper: string[] | null = null;
function windows1250Char(byte: number): string {
  if (!windows1250Upper) {
    const decoder = new TextDecoder("windows-1250");
    windows1250Upper = [];
    for (let b = 0x80; b <= 0xff; b += 1) {
      windows1250Upper[b - 0x80] = decoder.decode(new Uint8Array([b]));
    }
  }
  return windows1250Upper[byte - 0x80] ?? "";
}

/**
 * Přečte text jako UTF-8 a každý bajt, který do UTF-8 nepasuje, přeloží
 * podle Windows-1250. Díky tomu se míchaný soubor přečte celý správně -
 * původní UTF-8 část i přimíchané znaky.
 */
function decodeUtf8WithWindows1250Fallback(bytes: Uint8Array): string {
  const out: string[] = [];
  let i = 0;

  while (i < bytes.length) {
    const length = utf8SequenceLength(bytes, i);

    if (length === 0) {
      out.push(windows1250Char(bytes[i]));
      i += 1;
      continue;
    }
    if (length === 1) {
      out.push(String.fromCharCode(bytes[i]));
      i += 1;
      continue;
    }

    let codePoint = bytes[i] & (0xff >> (length + 1));
    for (let k = 1; k < length; k += 1) {
      codePoint = (codePoint << 6) | (bytes[i + k] & 0x3f);
    }
    out.push(String.fromCodePoint(codePoint));
    i += length;
  }

  return out.join("");
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const { text } = decodeText(await file.arrayBuffer());
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { headers: [], rows: [] };
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? "").trim());
  });

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // hlavička

    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const value = cell.value;
      if (value instanceof Date) {
        rowData[header] = value.toISOString().slice(0, 10);
      } else if (value && typeof value === "object" && "result" in value) {
        // vzorec v buňce - vezmi vypočtenou hodnotu
        rowData[header] = String((value as { result: unknown }).result ?? "");
      } else {
        rowData[header] = value == null ? "" : String(value);
      }
    });

    const hasContent = Object.values(rowData).some((v) => v !== "");
    if (hasContent) {
      rows.push(rowData);
    }
  });

  return { headers, rows };
}
