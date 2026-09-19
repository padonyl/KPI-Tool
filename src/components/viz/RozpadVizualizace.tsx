"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatValue } from "@/lib/format-number";
import { rozdeleni } from "@/lib/histogram";
import { VizTheme, TOOLTIP_STYLE, TICK } from "./VizTheme";

// Vizualizace rozpadu KPI do detailu.
//
// ZÁMĚRNĚ NENÍ stavitel grafů. Vychází to z pozicování „vertikální názor
// místo prázdného plátna" (znacka_a_marketingovy_web.md, rozdíl č. 4):
// zákazník, který neví, že si může spočítat OTIF, neví ani, jestli má být
// sloupcový, nebo Paretův. Nabídka je proto krátká a kurátorovaná — a co
// nedává nad danými daty smysl, se vůbec nenabídne.

export type Polozka = { klic: string; pocet: number; hodnota: number | null };

type Pohled = "tabulka" | "sloupce" | "pareto" | "rozdeleni";

/** Kolik kategorií se vejde do grafu, aby zůstal čitelný. */
const SLOUPCU = 15;
const PARETO_SLOUPCU = 12;

function zkrat(s: string, n = 22) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function RozpadVizualizace({
  polozky,
  skupinCelkem,
  soucetVsech,
  dimenze,
  agregace,
  popisHodnoty,
  jednotka,
  scitatelne,
  hodnotyRadku,
  hodnotovySloupec,
}: {
  polozky: Polozka[];
  /** Kolik skupin bylo PŘED oříznutím — kvůli poctivému Paretu. */
  skupinCelkem: number;
  /** Součet přes VŠECHNY skupiny, i ty oříznuté. */
  soucetVsech: number;
  dimenze: string;
  agregace: "kpi" | "sum" | "avg";
  popisHodnoty: string;
  jednotka: string;
  /** Jdou hodnoty sčítat? U poměrových KPI (marže) ne — Pareto by lhal. */
  scitatelne: boolean;
  /** Syrové hodnoty vybraného číselného sloupce, pro histogram. */
  hodnotyRadku: number[];
  hodnotovySloupec: string;
}) {
  const [pohled, setPohled] = useState<Pohled>("tabulka");

  const kladne = polozky.every((p) => (p.hodnota ?? 0) >= 0);
  // Pareto stojí na tom, že se díly sčítají do celku. U průměru nebo marže
  // je „kumulativní podíl" nesmysl, u záporných hodnot taky (křivka by
  // klesala). Radši nenabídnout než nabídnout graf, co vypadá důvěryhodně.
  const paretoMozne = scitatelne && kladne && soucetVsech > 0 && polozky.length >= 3;
  const histogramMozny = hodnotyRadku.length >= 5;

  const pohledy: { id: Pohled; popis: string; dostupny: boolean; duvod?: string }[] = [
    { id: "tabulka", popis: "Tabulka", dostupny: true },
    { id: "sloupce", popis: "Sloupce", dostupny: polozky.length > 0 },
    {
      id: "pareto",
      popis: "Pareto",
      dostupny: paretoMozne,
      duvod: !scitatelne
        ? "Pareto jde jen u sčítatelných hodnot — u průměru nebo poměru nemá kumulativní podíl smysl."
        : !kladne
          ? "V datech jsou záporné hodnoty, kumulativní podíl by klesal."
          : "Na Pareto je potřeba aspoň pár kategorií.",
    },
    {
      id: "rozdeleni",
      popis: "Rozdělení",
      dostupny: histogramMozny,
      duvod: hodnotovySloupec
        ? "Na histogram je potřeba aspoň 5 řádků s číslem."
        : "Vyber číselný sloupec, jehož rozdělení se má ukázat.",
    },
  ];

  const aktivni = pohledy.find((p) => p.id === pohled)?.dostupny ? pohled : "tabulka";

  return (
    <div className="viz-root">
      <VizTheme />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {pohledy.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => p.dostupny && setPohled(p.id)}
            disabled={!p.dostupny}
            title={p.dostupny ? undefined : p.duvod}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors " +
              (aktivni === p.id
                ? "border-brand font-medium text-brand-ink dark:text-zinc-100"
                : p.dostupny
                  ? "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  : "cursor-not-allowed border-transparent text-zinc-300 dark:text-zinc-700")
            }
          >
            {p.popis}
          </button>
        ))}
      </div>

      {aktivni === "tabulka" && (
        <Tabulka
          polozky={polozky}
          dimenze={dimenze}
          agregace={agregace}
          popisHodnoty={popisHodnoty}
          jednotka={jednotka}
        />
      )}
      {aktivni === "sloupce" && (
        <Sloupce polozky={polozky} popisHodnoty={popisHodnoty} jednotka={jednotka} />
      )}
      {aktivni === "pareto" && (
        <Pareto
          polozky={polozky}
          soucetVsech={soucetVsech}
          skupinCelkem={skupinCelkem}
          popisHodnoty={popisHodnoty}
          jednotka={jednotka}
        />
      )}
      {aktivni === "rozdeleni" && (
        <Histogram hodnoty={hodnotyRadku} sloupec={hodnotovySloupec} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Tabulka — původní zobrazení, beze změny chování
// ------------------------------------------------------------------
function Tabulka({
  polozky,
  dimenze,
  agregace,
  popisHodnoty,
  jednotka,
}: {
  polozky: Polozka[];
  dimenze: string;
  agregace: "kpi" | "sum" | "avg";
  popisHodnoty: string;
  jednotka: string;
}) {
  return (
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
          {polozky.map((r) => (
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
      {polozky.length === 50 && (
        <p className="mt-2 text-xs text-zinc-400">Zobrazeno prvních 50 hodnot.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Seřazené vodorovné sloupce
// ------------------------------------------------------------------
function Sloupce({
  polozky,
  popisHodnoty,
  jednotka,
}: {
  polozky: Polozka[];
  popisHodnoty: string;
  jednotka: string;
}) {
  const data = polozky
    .filter((p) => p.hodnota !== null)
    .slice(0, SLOUPCU)
    .map((p) => ({ ...p, popisek: zkrat(p.klic) }));

  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">Není co vykreslit.</p>;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="popisek"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--grid)", fillOpacity: 0.3 }}
            formatter={(v) => [formatValue(Number(v), jednotka), popisHodnoty]}
            labelFormatter={(_, p) => p?.[0]?.payload?.klic ?? ""}
          />
          <Bar dataKey="hodnota" fill="var(--series-1)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {polozky.length > SLOUPCU && (
        <p className="mt-2 text-xs text-zinc-500">
          Zobrazeno {SLOUPCU} největších z {polozky.length}. Celý výčet je v tabulce.
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Paretův diagram
// ------------------------------------------------------------------
function Pareto({
  polozky,
  soucetVsech,
  skupinCelkem,
  popisHodnoty,
  jednotka,
}: {
  polozky: Polozka[];
  soucetVsech: number;
  skupinCelkem: number;
  popisHodnoty: string;
  jednotka: string;
}) {
  const data = useMemo(() => {
    let nasbirano = 0;
    return polozky
      .filter((p) => p.hodnota !== null)
      .slice(0, PARETO_SLOUPCU)
      .map((p) => {
        nasbirano += p.hodnota ?? 0;
        return {
          klic: p.klic,
          popisek: zkrat(p.klic, 14),
          hodnota: p.hodnota ?? 0,
          // POZOR: dělí se součtem VŠECH skupin, ne jen vykreslených.
          // Kdyby se dělilo součtem zobrazených, poslední sloupec by vždy
          // vyšel na 100 % a graf by tvrdil, že pár kategorií tvoří celek.
          kumulativne: (nasbirano / soucetVsech) * 100,
        };
      });
  }, [polozky, soucetVsech]);

  const pokryto = data.length > 0 ? data[data.length - 1].kumulativne : 0;
  // Kolik kategorií stačí na 80 % — to je to, kvůli čemu se Pareto kreslí.
  const doOsmdesati = data.findIndex((d) => d.kumulativne >= 80);

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="popisek"
            tick={{ ...TICK, fontSize: 10 }}
            axisLine={{ stroke: "var(--grid)" }}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis yAxisId="l" tick={TICK} axisLine={false} tickLine={false} width={48} />
          <YAxis
            yAxisId="p"
            orientation="right"
            domain={[0, 100]}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={38}
            tickFormatter={(v) => `${v} %`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--grid)", fillOpacity: 0.3 }}
            formatter={(v, name) =>
              name === "kumulativne"
                ? [`${formatNumber(Number(v))} %`, "kumulativně"]
                : [formatValue(Number(v), jednotka), popisHodnoty]
            }
            labelFormatter={(_, p) => p?.[0]?.payload?.klic ?? ""}
          />
          <Bar yAxisId="l" dataKey="hodnota" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={d.klic}
                // Barevně se odliší ta část, co tvoří prvních 80 % — je to
                // celý smysl Pareta a bez zvýraznění se v grafu hledá.
                fill={
                  doOsmdesati >= 0 && i <= doOsmdesati
                    ? "var(--series-1)"
                    : "var(--series-muted)"
                }
              />
            ))}
          </Bar>
          <Line
            yAxisId="p"
            type="monotone"
            dataKey="kumulativne"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-2)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-zinc-500">
        {doOsmdesati >= 0 ? (
          <>
            <strong className="text-zinc-700 dark:text-zinc-300">
              {doOsmdesati + 1}{" "}
              {doOsmdesati === 0 ? "kategorie tvoří" : "kategorií tvoří"} 80 %
            </strong>{" "}
            celku.{" "}
          </>
        ) : (
          <>Prvních {data.length} kategorií tvoří {formatNumber(pokryto)} % celku. </>
        )}
        {skupinCelkem > data.length && <>Celkem kategorií: {skupinCelkem}.</>}
      </p>
    </>
  );
}

// ------------------------------------------------------------------
// Histogram rozdělení
// ------------------------------------------------------------------
function Histogram({ hodnoty, sloupec }: { hodnoty: number[]; sloupec: string }) {
  const kose = useMemo(() => rozdeleni(hodnoty), [hodnoty]);

  const data = kose.map((k) => ({
    popisek: k.od === k.do ? formatNumber(k.od) : `${formatNumber(k.od)}–${formatNumber(k.do)}`,
    pocet: k.pocet,
    od: k.od,
    do: k.do,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">Není co vykreslit.</p>;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="popisek"
            tick={{ ...TICK, fontSize: 10 }}
            axisLine={{ stroke: "var(--grid)" }}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={52}
          />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--grid)", fillOpacity: 0.3 }}
            formatter={(v) => [`${formatNumber(Number(v))} řádků`, ""]}
            labelFormatter={(l) => `${sloupec}: ${l}`}
          />
          <Bar dataKey="pocet" fill="var(--series-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-zinc-500">
        Rozdělení {formatNumber(hodnoty.length)} řádků podle sloupce „{sloupec}". Ukáže
        chvost, který průměr schová.
      </p>
    </>
  );
}
