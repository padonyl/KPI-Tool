"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/parse-values";
import { formatNumber } from "@/lib/format-number";

// Rozpad KPI do detailu (fáze 4). Nad syrovými řádky (source_rows) udělá
// prostý pivot: seskup podle vybrané dimenze (libovolný sloupec) a sečti
// vybraný číselný sloupec. Ukazuje se jen u období, která mají uložené
// řádky — o tom rozhoduje server (viz page.tsx), sem chodí jen ta.
//
// Řádky se načítají AŽ na vyžádání (po výběru období), ne dopředu všechny —
// jednoho uploadu můžou být tisíce.

type Perioda = { uploadId: string; label: string };

export function RozpadPeriody({ periody }: { periody: Perioda[] }) {
  const [uploadId, setUploadId] = useState(periody[0]?.uploadId ?? "");
  const [radky, setRadky] = useState<Record<string, string>[] | null>(null);
  const [nacitam, setNacitam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [dimenze, setDimenze] = useState<string>("");
  const [hodnotovy, setHodnotovy] = useState<string>("");
  // Filtr (zúžit řádky před seskupením) a volba agregace.
  const [filtrSloupec, setFiltrSloupec] = useState<string>("");
  const [filtrHodnota, setFiltrHodnota] = useState<string>("");
  const [agregace, setAgregace] = useState<"sum" | "avg">("sum");

  useEffect(() => {
    if (!uploadId) return;
    let zruseno = false;
    setNacitam(true);
    setChyba(null);
    createClient()
      .from("source_rows")
      .select("data")
      .eq("upload_id", uploadId)
      .then(({ data, error }) => {
        if (zruseno) return;
        setNacitam(false);
        if (error) {
          setChyba("Řádky se nepodařilo načíst.");
          setRadky([]);
          return;
        }
        setRadky((data ?? []).map((r) => r.data as Record<string, string>));
      });
    return () => {
      zruseno = true;
    };
  }, [uploadId]);

  // Sloupce z dat. Číselné = ty, kde většina neprázdných hodnot je číslo.
  const { sloupce, ciselne } = useMemo(() => {
    if (!radky || radky.length === 0) return { sloupce: [], ciselne: [] };
    const klice = Object.keys(radky[0]);
    const ciselne = klice.filter((k) => {
      const neprazdne = radky.filter((r) => (r[k] ?? "").trim() !== "");
      if (neprazdne.length === 0) return false;
      const cisla = neprazdne.filter((r) => parseNumber(r[k]) !== null);
      return cisla.length >= neprazdne.length * 0.8;
    });
    return { sloupce: klice, ciselne };
  }, [radky]);

  // Výchozí volby, jakmile známe sloupce.
  useEffect(() => {
    if (sloupce.length === 0) return;
    setDimenze((d) => (d && sloupce.includes(d) ? d : sloupce.find((s) => !ciselne.includes(s)) ?? sloupce[0]));
    setHodnotovy((h) => (h && ciselne.includes(h) ? h : ciselne[0] ?? ""));
  }, [sloupce, ciselne]);

  const rozpad = useMemo(() => {
    if (!radky || !dimenze) return [];
    // Nejdřív filtr (contains, bez ohledu na velikost písmen), pak seskupení.
    const hledat = filtrHodnota.trim().toLowerCase();
    const filtrovane =
      filtrSloupec && hledat
        ? radky.filter((r) => (r[filtrSloupec] ?? "").toLowerCase().includes(hledat))
        : radky;

    const mapa = new Map<string, { soucet: number; pocet: number; scitanych: number }>();
    for (const r of filtrovane) {
      const klic = (r[dimenze] ?? "").trim() || "(prázdné)";
      const zaznam = mapa.get(klic) ?? { soucet: 0, pocet: 0, scitanych: 0 };
      zaznam.pocet += 1;
      if (hodnotovy) {
        const v = parseNumber(r[hodnotovy]);
        if (v !== null) {
          zaznam.soucet += v;
          zaznam.scitanych += 1;
        }
      }
      mapa.set(klic, zaznam);
    }
    return [...mapa.entries()]
      .map(([klic, v]) => ({
        klic,
        pocet: v.pocet,
        // U průměru děl počtem řádků, které měly čitelné číslo.
        hodnota: agregace === "avg" && v.scitanych > 0 ? v.soucet / v.scitanych : v.soucet,
      }))
      .sort((a, b) => (hodnotovy ? b.hodnota - a.hodnota : b.pocet - a.pocet))
      .slice(0, 50);
  }, [radky, dimenze, hodnotovy, filtrSloupec, filtrHodnota, agregace]);

  if (periody.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-display mb-1 text-lg font-semibold text-brand-ink dark:text-zinc-100">
        Rozpad do detailu
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Co je za číslem — seskupené podle sloupce z nahraného souboru.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Období
          <select
            value={uploadId}
            onChange={(e) => setUploadId(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {periody.map((p) => (
              <option key={p.uploadId} value={p.uploadId}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {sloupce.length > 0 && (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Rozpad podle
              <select
                value={dimenze}
                onChange={(e) => setDimenze(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {sloupce.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            {ciselne.length > 0 && (
              <>
                <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Číselný sloupec
                  <select
                    value={hodnotovy}
                    onChange={(e) => setHodnotovy(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {ciselne.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Agregace
                  <select
                    value={agregace}
                    onChange={(e) => setAgregace(e.target.value as "sum" | "avg")}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="sum">součet</option>
                    <option value="avg">průměr</option>
                  </select>
                </label>
              </>
            )}
          </>
        )}
      </div>

      {/* Filtr — zúží řádky před seskupením (např. jen jeden zákazník). */}
      {sloupce.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Filtr sloupce
            <select
              value={filtrSloupec}
              onChange={(e) => setFiltrSloupec(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— bez filtru —</option>
              {sloupce.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {filtrSloupec && (
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              obsahuje
              <input
                type="text"
                value={filtrHodnota}
                onChange={(e) => setFiltrHodnota(e.target.value)}
                placeholder="hodnota…"
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          )}
        </div>
      )}

      {nacitam && <p className="text-sm text-zinc-500 dark:text-zinc-400">Načítám řádky…</p>}
      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}

      {!nacitam && !chyba && rozpad.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="pb-2 font-normal">{dimenze}</th>
                {hodnotovy && (
                  <th className="pb-2 text-right font-normal">
                    {hodnotovy} ({agregace === "avg" ? "průměr" : "součet"})
                  </th>
                )}
                <th className="pb-2 text-right font-normal">řádků</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rozpad.map((r) => (
                <tr key={r.klic} className="even:bg-zinc-50 dark:even:bg-zinc-900/50">
                  <td className="py-2 pl-2">{r.klic}</td>
                  {hodnotovy && (
                    <td className="py-2 pr-2 text-right font-medium tabular-nums">
                      {formatNumber(Math.round(r.hodnota * 100) / 100)}
                    </td>
                  )}
                  <td className="py-2 pr-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatNumber(r.pocet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rozpad.length === 50 && (
            <p className="mt-2 text-xs text-zinc-400">Zobrazeno prvních 50 hodnot.</p>
          )}
        </div>
      )}

      {!nacitam && !chyba && radky && radky.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Za tohle období nejsou uložené žádné řádky.
        </p>
      )}
    </div>
  );
}
