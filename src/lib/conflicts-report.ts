import type { Conflict } from "@/lib/kpi-value-writer";
import { formatPeriod } from "@/lib/format-period";
import { formatNumber } from "@/lib/format-number";

// Přehled změn k prozkoumání v nové záložce.
//
// Při desítkách konfliktů je seznam v dialogu jen zeď čísel - nedá se z ní
// poznat, jestli jde o drobnou korekci, nebo se něco přepočítalo úplně jinak.
// Data přitom ještě nejsou uložená (o to jde - uživatel se rozhoduje PŘED
// zápisem), takže je nemá odkud načíst serverová stránka. Report se proto
// vygeneruje v prohlížeči a otevře jako samostatný dokument.

/** Kolik změn se ještě vejde do dialogu, než má smysl nabídnout detail. */
export const CONFLICT_PREVIEW_LIMIT = 5;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function changeDescription(oldValue: number, newValue: number): {
  diffText: string;
  percentText: string;
  direction: "up" | "down";
} {
  const diff = newValue - oldValue;
  const direction = diff >= 0 ? "up" : "down";
  const percent = oldValue !== 0 ? (diff / Math.abs(oldValue)) * 100 : null;

  return {
    diffText: `${diff >= 0 ? "+" : "−"}${formatNumber(Math.abs(diff))}`,
    percentText:
      percent === null
        ? "—"
        : `${percent >= 0 ? "+" : "−"}${formatNumber(Math.abs(percent))} %`,
    direction,
  };
}

function buildHtml(conflicts: Conflict[], sourceName: string): string {
  const rows = conflicts
    .map((c) => {
      const { diffText, percentText, direction } = changeDescription(c.oldValue, c.newValue);
      const color = direction === "up" ? "#0ca30c" : "#d03b3b";
      return `<tr>
        <td class="kpi">${escapeHtml(c.kpiName)}</td>
        <td>${escapeHtml(formatPeriod(c.periodEnd, c.periodType))}</td>
        <td class="num old">${escapeHtml(formatNumber(c.oldValue))}</td>
        <td class="num new">${escapeHtml(formatNumber(c.newValue))}</td>
        <td class="num" style="color:${color}">${escapeHtml(diffText)}</td>
        <td class="num" style="color:${color}">${escapeHtml(percentText)}</td>
      </tr>`;
    })
    .join("\n");

  const grew = conflicts.filter((c) => c.newValue > c.oldValue).length;
  const fell = conflicts.filter((c) => c.newValue < c.oldValue).length;

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<title>Přehled změn — ${escapeHtml(sourceName)}</title>
<style>
  body { margin:0; padding:40px 24px; background:#f5f7fb; color:#313850;
         font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .page { max-width: 900px; margin: 0 auto; }
  h1 { font-size:1.6rem; color:#142654; margin:0 0 6px; }
  .sub { color:#666e85; font-size:.9rem; margin:0 0 24px; }
  .summary { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
  .chip { border-radius:999px; padding:6px 14px; font-size:.85rem; font-weight:600;
          background:#fff; border:1px solid #dde1ec; }
  .chip.up { color:#0ca30c; border-color:#b7dcc5; background:#e6f4ec; }
  .chip.down { color:#d03b3b; border-color:#eec3b6; background:#fbe9e3; }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #dde1ec;
          border-radius:10px; overflow:hidden; font-size:.9rem; }
  th { text-align:left; padding:10px 14px; background:#eef1f7; color:#666e85;
       font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; }
  td { padding:10px 14px; border-top:1px solid #eef1f7; }
  td.kpi { font-weight:600; color:#142654; }
  td.num { text-align:right; font-variant-numeric: tabular-nums;
           font-family: ui-monospace, monospace; }
  td.old { color:#98a0b3; text-decoration:line-through; }
  td.new { font-weight:600; color:#142654; }
  .note { margin-top:20px; font-size:.82rem; color:#666e85; }
  @media print { body { background:#fff; } }
</style>
</head>
<body>
<div class="page">
  <h1>Přehled změn před uložením</h1>
  <p class="sub">Zdroj: ${escapeHtml(sourceName)} · vygenerováno ${new Date().toLocaleString("cs-CZ")}</p>

  <div class="summary">
    <span class="chip">${conflicts.length} změn celkem</span>
    ${grew > 0 ? `<span class="chip up">${grew} × nárůst</span>` : ""}
    ${fell > 0 ? `<span class="chip down">${fell} × pokles</span>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>KPI</th><th>Období</th>
        <th style="text-align:right">Původní</th>
        <th style="text-align:right">Nová</th>
        <th style="text-align:right">Rozdíl</th>
        <th style="text-align:right">Změna</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <p class="note">
    Tohle je jen náhled — nic zatím není uloženo. Zavři tuhle záložku a vrať se
    do aplikace, kde přepsání buď potvrdíš, nebo zrušíš.
  </p>
</div>
</body>
</html>`;
}

/**
 * Otevře přehled změn v nové záložce. Volat výhradně z obsluhy kliknutí,
 * jinak to blokátor vyskakovacích oken zaříznout.
 */
export function openConflictsReport(conflicts: Conflict[], sourceName: string): boolean {
  const blob = new Blob([buildHtml(conflicts, sourceName)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");

  if (!opened) {
    URL.revokeObjectURL(url);
    return false;
  }
  // Uvolnit až po načtení, jinak se záložka nemá z čeho vykreslit.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
