"use client";

import { useState } from "react";
import { SuccessBanner, ErrorBanner } from "@/components/forms/StatusBanner";
import { PRIMARY_BUTTON, SELECT_INPUT, TEXT_INPUT } from "@/lib/ui-classes";
import { ZAMEK_HODIN } from "@/lib/firma-udaje";

type Ciselnik = { id: string; name?: string; label?: string };

type Props = {
  profil: Record<string, string | null>;
  klasifikace: Record<string, string | null>;
  sektory: Ciselnik[];
  velikosti: Ciselnik[];
  /** Kolik hodin ještě běží zámek na zařazení. 0 = jde měnit. */
  zamekHodin: number;
};

export function FirmaForm({ profil, klasifikace, sektory, velikosti, zamekHodin }: Props) {
  const [name, setName] = useState(profil.name ?? "");
  const [ico, setIco] = useState(profil.ico ?? "");
  const [dic, setDic] = useState(profil.dic ?? "");
  const [adresa, setAdresa] = useState(profil.billing_address ?? "");
  const [email, setEmail] = useState(profil.billing_email ?? "");
  const [web, setWeb] = useState(profil.website ?? "");

  const [sektor, setSektor] = useState(klasifikace.sector_id ?? "");
  const [velikost, setVelikost] = useState(klasifikace.size_band_id ?? "");
  const [zeme, setZeme] = useState(klasifikace.country ?? "");

  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<string | null>(null);

  const zamceno = zamekHodin > 0;

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setUklada(true);
    setChyba(null);
    setHotovo(null);

    const odpoved = await fetch("/api/firma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profil: {
          name,
          ico,
          dic,
          billing_address: adresa,
          billing_email: email,
          website: web,
        },
        klasifikace: { sector_id: sektor, size_band_id: velikost, country: zeme },
      }),
    });

    const data = await odpoved.json().catch(() => ({}));
    setUklada(false);

    if (!odpoved.ok) {
      setChyba(data.chyba ?? "Uložení se nepodařilo.");
      return;
    }

    if (data.zmeneno === 0) {
      setHotovo("Nic se nezměnilo — uloženo beze změny.");
      return;
    }
    setHotovo(
      data.klasifikaceZmenena
        ? `Uloženo. Zařazení firmy teď půjde změnit znovu za ${ZAMEK_HODIN} hodin.`
        : "Uloženo.",
    );
  }

  const pole = "flex flex-col gap-1 text-sm";
  const popisek = "text-xs text-zinc-600 dark:text-zinc-400";

  return (
    <form onSubmit={odesli} className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 font-medium text-black dark:text-zinc-50">
          Identifikace a fakturace
        </h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Tyhle údaje se do srovnání s ostatními firmami nepoužívají.
        </p>

        <div className="flex flex-col gap-3">
          <label className={pole}>
            <span className={popisek}>Název firmy</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={TEXT_INPUT} />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${pole} flex-1`}>
              <span className={popisek}>IČO</span>
              <input
                value={ico}
                onChange={(e) => setIco(e.target.value)}
                inputMode="numeric"
                placeholder="8 číslic"
                className={TEXT_INPUT}
              />
            </label>
            <label className={`${pole} flex-1`}>
              <span className={popisek}>DIČ</span>
              <input
                value={dic}
                onChange={(e) => setDic(e.target.value)}
                placeholder="např. CZ12345678"
                className={TEXT_INPUT}
              />
            </label>
          </div>

          <label className={pole}>
            <span className={popisek}>Fakturační adresa</span>
            <input value={adresa} onChange={(e) => setAdresa(e.target.value)} className={TEXT_INPUT} />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${pole} flex-1`}>
              <span className={popisek}>E-mail pro faktury</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={TEXT_INPUT}
              />
            </label>
            <label className={`${pole} flex-1`}>
              <span className={popisek}>Web</span>
              <input value={web} onChange={(e) => setWeb(e.target.value)} className={TEXT_INPUT} />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 font-medium text-black dark:text-zinc-50">Zařazení firmy</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Podle těchhle údajů se firma srovnává s podobnými. Proto jdou měnit
          jen jednou za {ZAMEK_HODIN} hodin — aby se srovnání nedalo ohýbat
          přenastavováním parametrů.
        </p>

        {zamceno && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Zařazení se nedávno měnilo. Další změna půjde za {zamekHodin} h.
            Údaje nahoře uložit můžeš.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <label className={pole}>
            <span className={popisek}>Obor</span>
            <select
              value={sektor}
              onChange={(e) => setSektor(e.target.value)}
              disabled={zamceno}
              className={`${SELECT_INPUT} disabled:opacity-60`}
            >
              <option value="">— nevyplněno —</option>
              {sektory.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${pole} flex-1`}>
              <span className={popisek}>Velikost firmy</span>
              <select
                value={velikost}
                onChange={(e) => setVelikost(e.target.value)}
                disabled={zamceno}
                className={`${SELECT_INPUT} disabled:opacity-60`}
              >
                <option value="">— nevyplněno —</option>
                {velikosti.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${pole} flex-1`}>
              <span className={popisek}>Země</span>
              <input
                value={zeme}
                onChange={(e) => setZeme(e.target.value)}
                disabled={zamceno}
                placeholder="např. CZ"
                className={`${TEXT_INPUT} disabled:opacity-60`}
              />
            </label>
          </div>
        </div>
      </section>

      {chyba && <ErrorBanner>{chyba}</ErrorBanner>}
      {hotovo && <SuccessBanner>{hotovo}</SuccessBanner>}

      <button type="submit" disabled={uklada} className={`self-start ${PRIMARY_BUTTON}`}>
        {uklada ? "Ukládám…" : "Uložit změny"}
      </button>
    </form>
  );
}
