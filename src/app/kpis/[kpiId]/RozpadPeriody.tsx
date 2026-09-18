"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/parse-values";
import { formatNumber, formatValue } from "@/lib/format-number";
import type { FormulaSpec, FormulaConfig } from "@/lib/formula";
import { hodnotaKpiProRadky } from "@/lib/rozpad";
import { SELECT_INPUT, TEXT_INPUT } from "@/lib/ui-classes";

// Rozpad KPI do detailu: nad syrovými řádky (source_rows) ukáže, co je za
// číslem — seskupeno podle libovolného sloupce ze souboru.
//
// PostgREST vrací nejvýš 1000 řádků na dotaz. Bez stránkování se rozpad
// počítal jen z prvního tisíce a tvářil se jako úplný (změřeno 2026-09-07:
// z 1500 řádků se vrátilo 1000, součet 500 500 místo 1 125 750). Čte se
// tedy po stránkách; strop chrání prohlížeč a při vyčerpání se řekne nahlas.
const STRANKA = 1000;
const STROP_RADKU = 50_000;

type Perioda = {
  uploadId: string;
  periodEnd: string;
  periodType: string;
  label: string;
};

type Vzorec = { spec: FormulaSpec; config: FormulaConfig };

export function RozpadPeriody({
  periody,
  vzorec,
  nazevKpi,
  jednotka,
}: {
  periody: Perioda[];
  vzorec: Vzorec | null;
  nazevKpi: string;
  jednotka: string;
}) {
  // ZÁMĚRNĚ nic předvybraného (požadavek uživatele 2026-09-18). Dokud si
  // člověk nezvolí období a rozměr, nic se nenačítá ani nepočítá — což
  // zároveň ušetří stažení tisíců řádků hned po otevření stránky.
  const [periodaKey, setPeriodaKey] = useState<string>("");
  const [radky, setRadky] = useState<Record<string, string>[] | null>(null);
  const [nacitam, setNacitam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [neuplne, setNeuplne] = useState(false);

  const [dimenze, setDimenze] = useState<string>("");
  const [hodnotovy, setHodnotovy] = useState<string>("");
  const [agregace, setAgregace] = useState<"kpi" | "sum" | "avg">(vzorec ? "kpi" : "sum");
  const [filtrSloupec, setFiltrSloupec] = useState<string>("");
  const [filtrHodnota, setFiltrHodnota] = useState<string>("");

  const perioda = periody.find((p) => p.periodEnd === periodaKey) ?? null;

  useEffect(() => {
    // Úklid stavu patří do obsluhy změny období níž, ne sem — setState
    // rovnou v těle efektu spouští kaskádu renderů.
    if (!perioda) return;
    let zruseno = false;

    (async () => {
      setNacitam(true);
      setChyba(null);
      setNeuplne(false);

      const supabase = createClient();
      const vse: Record<string, string>[] = [];

      for (let od = 0; od < STROP_RADKU; od += STRANKA) {
        // Filtr na OBDOBÍ je zásadní: jedno nahrání může nést víc měsíců,
        // a bez něj by se do rozpadu za květen připočetly i ostatní měsíce.
        const { data, error } = await supabase
          .from("source_rows")
          .select("data")
          .eq("upload_id", perioda.uploadId)
          .eq("period_end", perioda.periodEnd)
          .order("id")
          .range(od, od + STRANKA - 1);

        if (zruseno) return;

        if (error) {
          setChyba("Řádky se nepodařilo načíst.");
          setRadky([]);
          setNacitam(false);
          return;
        }

        vse.push(...(data ?? []).map((r) => r.data as Record<string, string>));

        if ((data?.length ?? 0) < STRANKA) {
          setRadky(vse);
          setNacitam(false);
          return;
        }
      }

      if (zruseno) return;
      setNeuplne(true);
      setRadky(vse);
      setNacitam(false);
    })();

    return () => {
      zruseno = true;
    };
  }, [perioda]);

  // Sloupce z dat. Číselné = ty, kde většina neprázdných hodnot je číslo.
  const { sloupce, ciselne } = useMemo(() => {
    if (!radky || radky.length === 0) return { sloupce: [], ciselne: [] };
    const klice = Object.keys(radky[0]);
    const ciselne = klice.filter((k) => {
      const neprazdne = radky.filter((r) => (r[k] ?? "").trim() !== "");
      if (neprazdne.length === 0) return false;
      return neprazdne.filter((r) => parseNumber(r[k]) !== null).length >= neprazdne.length * 0.8;
    });
    return { sloupce: klice, ciselne };
  }, [radky]);

  const rozpad = useMemo(() => {
    if (!radky || !dimenze || !perioda) return [];
    if (agregace !== "kpi" && !hodnotovy) return [];

    const hledat = filtrHodnota.trim().toLowerCase();
    const filtrovane =
      filtrSloupec && hledat
        ? radky.filter((r) => (r[filtrSloupec] ?? "").toLowerCase().includes(hledat))
        : radky;

    const skupiny = new Map<string, Record<string, string>[]>();
    for (const r of filtrovane) {
      const klic = (r[dimenze] ?? "").trim() || "(prázdné)";
      const s = skupiny.get(klic);
      if (s) s.push(r);
      else skupiny.set(klic, [r]);
    }

    const out: { klic: string; pocet: number; hodnota: number | null }[] = [];
    for (const [klic, sada] of skupiny) {
      let hodnota: number | null = null;

      if (agregace === "kpi" && vzorec) {
        hodnota = hodnotaKpiProRadky(sada, vzorec, perioda);
      } else {
        let soucet = 0;
        let scitanych = 0;
        for (const r of sada) {
          const v = parseNumber(r[hodnotovy] ?? "");
          if (v !== null) {
            soucet += v;
            scitanych += 1;
          }
        }
        hodnota = agregace === "avg" ? (scitanych > 0 ? soucet / scitanych : null) : soucet;
      }

      out.push({ klic, pocet: sada.length, hodnota });
    }

    return out
      .sort((a, b) => (b.hodnota ?? -Infinity) - (a.hodnota ?? -Infinity))
      .slice(0, 50);
  }, [radky, dimenze, hodnotovy, filtrSloupec, filtrHodnota, agregace, vzorec, perioda]);

  if (periody.length === 0) return null;

  const popisHodnoty =
    agregace === "kpi" ? nazevKpi : hodnotovy + (agregace === "avg" ? " (průměr)" : " (součet)");

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-display mb-1 text-lg font-semibold text-brand-ink dark:text-zinc-100">
        Rozpad do detailu
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Co je za číslem — vyber období a podle čeho to rozpadnout.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Období
          <select
            value={periodaKey}
            onChange={(e) => {
              setPeriodaKey(e.target.value);
              setRadky(null);
              // Sloupce se můžou lišit soubor od souboru, tak radši znovu.
              setDimenze("");
              setHodnotovy("");
              setFiltrSloupec("");
              setFiltrHodnota("");
            }}
            className={SELECT_INPUT}
          >
            <option value="">— vyber období —</option>
            {periody.map((p) => (
              <option key={p.periodEnd} value={p.periodEnd}>
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
                className={SELECT_INPUT}
              >
                <option value="">— vyber sloupec —</option>
                {sloupce.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Co počítat
              <select
                value={agregace}
                onChange={(e) => setAgregace(e.target.value as "kpi" | "sum" | "avg")}
                className={SELECT_INPUT}
              >
                {/* Vlastní vzorec KPI — jediný způsob, jak dostat poměrové
                    KPI (marže) po produktu. Součtem sloupce to nejde. */}
                {vzorec && <option value="kpi">{nazevKpi} (vzorec KPI)</option>}
                <option value="sum">součet sloupce</option>
                <option value="avg">průměr sloupce</option>
              </select>
            </label>

            {agregace !== "kpi" && ciselne.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                Číselný sloupec
                <select
                  value={hodnotovy}
                  onChange={(e) => setHodnotovy(e.target.value)}
                  className={SELECT_INPUT}
                >
                  <option value="">— vyber sloupec —</option>
                  {ciselne.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>

      {sloupce.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Filtr sloupce
            <select
              value={filtrSloupec}
              onChange={(e) => setFiltrSloupec(e.target.value)}
              className={SELECT_INPUT}
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
                className={TEXT_INPUT}
              />
            </label>
          )}
        </div>
      )}

      {!perioda && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vyber období, za které se chceš podívat do detailu.
        </p>
      )}
      {nacitam && <p className="text-sm text-zinc-500 dark:text-zinc-400">Načítám řádky…</p>}
      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
      {neuplne && (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tohle období má víc než {formatNumber(STROP_RADKU)} řádků. Rozpad níž je
          spočítaný z prvních {formatNumber(STROP_RADKU)} — není tedy za celé období.
        </p>
      )}

      {!nacitam && !chyba && perioda && radky && radky.length > 0 && !dimenze && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Načteno {formatNumber(radky.length)} řádků. Vyber sloupec, podle kterého
          je rozpadnout.
        </p>
      )}

      {!nacitam && !chyba && dimenze && agregace !== "kpi" && !hodnotovy && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vyber číselný sloupec, který se má spočítat.
        </p>
      )}

      {!nacitam && !chyba && rozpad.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="pb-2 font-normal">{dimenze}</th>
                <th className="pb-2 text-right font-normal">{popisHodnoty}</th>
                <th className="pb-2 text-right font-normal">řádků</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rozpad.map((r) => (
                <tr key={r.klic} className="even:bg-zinc-50 dark:even:bg-zinc-900/50">
                  <td className="py-2 pl-2">{r.klic}</td>
                  <td className="py-2 pr-2 text-right font-medium tabular-nums">
                    {r.hodnota === null ? (
                      // Nepočítat naslepo: když skupině chybí data pro některý
                      // slot, je poctivější to říct než ukázat nulu.
                      <span className="font-normal text-zinc-400">nelze spočítat</span>
                    ) : agregace === "kpi" ? (
                      formatValue(Math.round(r.hodnota * 100) / 100, jednotka)
                    ) : (
                      formatNumber(Math.round(r.hodnota * 100) / 100)
                    )}
                  </td>
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

      {!nacitam && !chyba && radky && radky.length === 0 && perioda && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Za tohle období nejsou uložené žádné řádky.
        </p>
      )}
    </div>
  );
}
