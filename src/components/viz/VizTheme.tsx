// Barvy pro grafy, sdílené mezi všemi vizualizacemi.
//
// Recharts chce barvy jako řetězce, ne jako Tailwind třídy, takže se musí
// předat proměnnými. Blok byl původně zkopírovaný uvnitř `TrendChart`;
// jakmile přibyly další grafy, dávalo smysl mít ho na jednom místě —
// jinak by se světlý a tmavý režim rozešly graf od grafu.
//
// Použití: <div className="viz-root"><VizTheme />… recharts …</div>
// a v grafu pak stroke="var(--series-1)".

export function VizTheme() {
  return (
    <style>{`
      .viz-root {
        --series-1: #2a78d6;
        --series-2: #d97a1f;
        --series-muted: #9db8d8;
        --text-secondary: #52514e;
        --text-muted: #898781;
        --grid: #e1e0d9;
        --surface: #fcfcfb;
      }
      @media (prefers-color-scheme: dark) {
        :root:where(:not([data-theme="light"])) .viz-root {
          --series-1: #3987e5;
          --series-2: #e8913a;
          --series-muted: #3d5675;
          --text-secondary: #c3c2b7;
          --text-muted: #898781;
          --grid: #2c2c2a;
          --surface: #1a1a19;
        }
      }
      :root[data-theme="dark"] .viz-root {
        --series-1: #3987e5;
        --series-2: #e8913a;
        --series-muted: #3d5675;
        --text-secondary: #c3c2b7;
        --text-muted: #898781;
        --grid: #2c2c2a;
        --surface: #1a1a19;
      }
    `}</style>
  );
}

/** Jednotný vzhled bublinky s hodnotou — recharts ji stylu je inline. */
export const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--grid)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-secondary)",
} as const;

/** Popisky os. */
export const TICK = { fontSize: 11, fill: "var(--text-muted)" } as const;
