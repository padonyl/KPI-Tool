import ExcelJS from "exceljs";
import Papa from "papaparse";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  /** Vyplněné, když se v souboru našly nečitelné znaky - UI na to upozorní. */
  encodingWarning?: string;
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
 * rozsype se diakritika v názvech sloupců a mapování je pak k ničemu.
 *
 * Postup: nejdřív přísný UTF-8 (spadne, pokud bajty nesedí), při neúspěchu
 * Windows-1250. Když ve výsledku pořád zůstane náhradní znak, soubor je
 * nejspíš míchaný z víc kódování - to už spolehlivě opravit nejde, jen na to
 * upozorníme.
 */
function decodeText(buffer: ArrayBuffer): { text: string; warning?: string } {
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
  const lenient = new TextDecoder("utf-8").decode(body);
  const broken = (lenient.match(/�/g) ?? []).length;
  const brokenRatio = lenient.length > 0 ? broken / lenient.length : 0;

  // Heuristika, ne jistota: 2 % vadných znaků je řádově víc, než kolik jich
  // vznikne přimícháním jednoho sloupce, a řádově míň, než kolik jich udělá
  // celý soubor v jiném kódování.
  if (brokenRatio < 0.02) {
    return {
      text: lenient,
      warning:
        "Soubor vypadá, že je uložený ve dvou kódováních zároveň — část názvů může být nečitelná. Otevři ho a ulož celý znovu jako CSV UTF-8.",
    };
  }

  return { text: new TextDecoder("windows-1250").decode(body) };
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const { text, warning } = decodeText(await file.arrayBuffer());
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    encodingWarning: warning,
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
