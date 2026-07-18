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

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();
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
