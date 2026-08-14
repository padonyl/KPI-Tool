"use client";

import { useState } from "react";
import { parseNumber } from "@/lib/parse-values";
import { formatNumber } from "@/lib/format-number";

// ============================================================
// Číselné pole s oddělovačem tisíců.
//
// Proč ne <input type="number">: prohlížeč u něj oddělovače nepovolí -
// "1 000 000" by považoval za neplatnou hodnotu a pole by se tvářilo prázdné.
// Navíc přidává šipky nahoru/dolů, které u částek v milionech nedávají smysl.
//
// Řešení: textové pole. Při psaní nechá uživateli volnost (může psát mezery,
// čárku i tečku), po opuštění pole hodnotu naformátuje. Vstup se čte stejnou
// funkcí jako čísla z nahrávaných souborů, takže "1 000 000", "1000000"
// i "1000000,5" projdou.
// ============================================================

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Zobrazí se za polem, ať je jasné, v čem se hodnota zadává. */
  unit?: string;
  placeholder?: string;
  className?: string;
};

export function NumberInput({ value, onChange, unit, placeholder, className = "" }: Props) {
  const [focused, setFocused] = useState(false);

  const parsed = parseNumber(value);
  const isInvalid = value.trim() !== "" && parsed === null;

  // Při psaní ukazuj přesně to, co uživatel napsal; jinak naformátovanou hodnotu.
  const display = focused || parsed === null ? value : formatNumber(parsed);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Uložit v jednotném tvaru, ať se do databáze nedostane "1 000 000".
            if (parsed !== null) onChange(String(parsed));
          }}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "rounded-md border bg-white px-3 py-2 text-right font-mono text-sm tabular-nums shadow-sm transition-colors focus:ring-2 focus:outline-none dark:bg-zinc-900",
            isInvalid
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
              : "border-zinc-300 focus:border-brand focus:ring-brand/20 dark:border-zinc-700",
            className || "w-44",
          ].join(" ")}
        />
        {unit && <span className="text-sm text-zinc-500 dark:text-zinc-400">{unit}</span>}
      </div>
      {isInvalid && (
        <span className="text-xs text-red-600 dark:text-red-400">Zadej číslo</span>
      )}
    </div>
  );
}
