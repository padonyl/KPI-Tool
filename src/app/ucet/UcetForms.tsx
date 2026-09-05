"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_DELKA_HESLA, NAPOVEDA_K_HESLU } from "@/lib/heslo";

const POLE =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const TLACITKO =
  "self-start rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50";

/** Hláška o úspěchu sama zmizí — potvrzení má žít jen tak dlouho jako akce. */
function useDocasnaHlaska(): [string | null, (t: string | null) => void] {
  const [hlaska, setHlaska] = useState<string | null>(null);
  useEffect(() => {
    if (!hlaska) return;
    const t = setTimeout(() => setHlaska(null), 6000);
    return () => clearTimeout(t);
  }, [hlaska]);
  return [hlaska, setHlaska];
}

export function FormularJmena({ jmeno }: { jmeno: string }) {
  const router = useRouter();
  const [hodnota, setHodnota] = useState(jmeno);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useDocasnaHlaska();

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setChyba(null);
    setHotovo(null);
    setPracuje(true);
    const res = await fetch("/api/ucet/jmeno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jmeno: hodnota }),
    });
    const telo = await res.json().catch(() => ({}));
    setPracuje(false);
    if (!res.ok) {
      setChyba(telo.error ?? "Uložení se nepodařilo.");
      return;
    }
    setHotovo("Jméno uloženo.");
    router.refresh();
  }

  return (
    <form onSubmit={odesli} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="jmeno" className="text-xs text-zinc-600 dark:text-zinc-400">
          Jméno, které uvidí kolegové
        </label>
        <input
          id="jmeno"
          value={hodnota}
          onChange={(e) => setHodnota(e.target.value)}
          maxLength={120}
          placeholder="Jan Novák"
          className={POLE}
        />
      </div>
      <button type="submit" disabled={pracuje || hodnota === jmeno} className={TLACITKO}>
        {pracuje ? "Ukládám…" : "Uložit jméno"}
      </button>
      {hotovo && <p className="text-sm text-green-700 dark:text-green-400">{hotovo}</p>}
      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
    </form>
  );
}

export function FormularHesla() {
  const router = useRouter();
  const [stare, setStare] = useState("");
  const [nove, setNove] = useState("");
  const [znovu, setZnovu] = useState("");
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [odhlasuje, setOdhlasuje] = useState(false);

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setChyba(null);

    if (nove !== znovu) {
      setChyba("Nová hesla se neshodují.");
      return;
    }

    setPracuje(true);
    const res = await fetch("/api/ucet/heslo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stare, nove }),
    });
    const telo = await res.json().catch(() => ({}));
    setPracuje(false);
    if (!res.ok) {
      setChyba(telo.error ?? "Změna se nepodařila.");
      return;
    }

    // Změna hesla zneplatní VŠECHNA sezení, tedy i to současné. Je to
    // bezpečnostní vlastnost, ne chyba — vyhodí i útočníka s ukradeným
    // sezením. Bez tohohle vysvětlení by ale uživatel jen zničehonic
    // skončil na přihlašovací stránce a myslel si, že se něco pokazilo.
    setStare("");
    setNove("");
    setZnovu("");
    setOdhlasuje(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <form onSubmit={odesli} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="stare" className="text-xs text-zinc-600 dark:text-zinc-400">
          Současné heslo
        </label>
        <input
          id="stare"
          type="password"
          required
          value={stare}
          onChange={(e) => setStare(e.target.value)}
          className={POLE}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="nove" className="text-xs text-zinc-600 dark:text-zinc-400">
            Nové heslo
          </label>
          <input
            id="nove"
            type="password"
            required
            minLength={MIN_DELKA_HESLA}
            value={nove}
            onChange={(e) => setNove(e.target.value)}
            className={POLE}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="znovu" className="text-xs text-zinc-600 dark:text-zinc-400">
            Nové heslo znovu
          </label>
          <input
            id="znovu"
            type="password"
            required
            minLength={MIN_DELKA_HESLA}
            value={znovu}
            onChange={(e) => setZnovu(e.target.value)}
            className={POLE}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-400">{NAPOVEDA_K_HESLU}</p>

      <button type="submit" disabled={pracuje || odhlasuje} className={TLACITKO}>
        {pracuje ? "Měním…" : "Změnit heslo"}
      </button>
      {odhlasuje && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Heslo změněno. Kvůli bezpečnosti se ruší všechna přihlášení včetně
          tohohle — za chvilku tě přesměrujeme, přihlas se prosím novým heslem.
        </p>
      )}
      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
    </form>
  );
}
