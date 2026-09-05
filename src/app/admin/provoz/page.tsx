import { notFound } from "next/navigation";
import { overAdmina } from "@/lib/admin";
import { nactiProvoz } from "@/lib/admin-data";
import { formatNumber } from "@/lib/format-number";

// KPI o samotném nástroji.
//
// Postaveno vědomě dřív, než jsou data — historii nejde dopočítat zpětně,
// takže se měřit musí začít od prvního zákazníka. Do té doby tu bude
// prázdno, a to je v pořádku.
//
// ČEMU SE TU VYHÝBÁME: tvářit se, že pár vzorků je statistika. Míra
// aktivace ze dvou firem není 50 %, je to nic. Proto se u každého poměru
// ukazuje i to, z kolika se počítá, a pod pěti firmami se místo procent
// napíše, že na ně ještě není dost dat. Číslo, kterému se nedá věřit, je
// horší než prázdné místo — protože podle něj člověk začne rozhodovat.

const MIN_PRO_POMER = 5;

function Karta({
  titulek,
  hodnota,
  popis,
}: {
  titulek: string;
  hodnota: string;
  popis: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
        {titulek}
      </p>
      <p className="font-display mt-1 text-2xl font-semibold text-brand-ink dark:text-zinc-100">
        {hodnota}
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{popis}</p>
    </div>
  );
}

/** Poměr v procentech, nebo poctivé přiznání, že na něj není dost dat. */
function pomer(cast: number, celek: number): string {
  if (celek < MIN_PRO_POMER) return "—";
  return `${Math.round((cast / celek) * 100)} %`;
}

export default async function AdminProvozPage() {
  if (!(await overAdmina())) notFound();

  const p = await nactiProvoz();
  const t = p.trychtyr;
  const maloDat = t.registrovano < MIN_PRO_POMER;

  const kroky = [
    { label: "Registrovalo se", pocet: t.registrovano },
    { label: "Schváleno", pocet: t.schvaleno },
    { label: "Založilo šablonu", pocet: t.maSablonu },
    { label: "Něco nahrálo", pocet: t.nahralo },
  ];
  const nejvic = Math.max(1, t.registrovano);
  const maxTyden = Math.max(1, ...p.nahraniPoTydnech.map((x) => x.pocet));

  return (
    <div className="pb-12">
      <h1 className="font-display mb-1 text-3xl font-semibold text-brand-ink dark:text-zinc-100">
        Provoz nástroje
      </h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Jak si vede produkt sám o sobě. Vše z metadat — žádné číslo odsud nepochází
        z dat zákazníků.
      </p>

      {maloDat && (
        <p className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Zatím je tu {formatNumber(t.registrovano)}{" "}
          {t.registrovano === 1 ? "firma" : t.registrovano < 5 ? "firmy" : "firem"} — na
          poměry a mediány je to málo, takže se místo nich ukazuje pomlčka. Absolutní
          počty níž platí.
        </p>
      )}

      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <Karta
          titulek="Aktivace"
          hodnota={pomer(t.nahralo, t.schvaleno)}
          popis={`${formatNumber(t.nahralo)} z ${formatNumber(t.schvaleno)} schválených firem už něco nahrálo`}
        />
        <Karta
          titulek="Čas do první hodnoty"
          hodnota={
            p.medianDnuDoPrvnihoNahrani === null
              ? "—"
              : `${formatNumber(p.medianDnuDoPrvnihoNahrani)} dní`
          }
          popis="Medián od registrace k prvnímu nahrání. Počítá se od registrace, ne od schválení — zahrnuje i to, jak dlouho firma čekala na nás."
        />
        <Karta
          titulek="Chybovost nahrávání"
          hodnota={pomer(p.celkemChybnych, p.celkemNahrani)}
          popis={`${formatNumber(p.celkemChybnych)} chybných z ${formatNumber(p.celkemNahrani)} nahrání celkem`}
        />
      </div>

      <h2 className="font-display mb-1 text-lg font-semibold text-brand-ink dark:text-zinc-100">
        Kudy firmy procházejí
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Kde lidé odpadávají. Největší propad ukazuje, co je na produktu nejtěžší —
        podezřelý je krok se šablonou.
      </p>
      <div className="mb-10 flex flex-col gap-2">
        {kroky.map((k, i) => (
          <div key={k.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
              {k.label}
            </span>
            <div className="h-7 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded bg-brand-solid"
                style={{ width: `${Math.round((k.pocet / nejvic) * 100)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-sm text-zinc-700 dark:text-zinc-300">
              {formatNumber(k.pocet)}
              {i > 0 && (
                <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400">
                  ({pomer(k.pocet, kroky[i - 1].pocet)})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <h2 className="font-display mb-1 text-lg font-semibold text-brand-ink dark:text-zinc-100">
        Nahrávání po týdnech
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Posledních dvanáct týdnů. Prázdné sloupce jsou tu schválně — díra v řadě je
        taky informace.
      </p>
      <div className="mb-4 flex h-32 items-end gap-1.5">
        {p.nahraniPoTydnech.map((t2) => (
          <div key={t2.tyden} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-brand-solid"
              style={{ height: `${Math.round((t2.pocet / maxTyden) * 100)}%` }}
              title={`${t2.tyden}: ${t2.pocet} nahrání, z toho ${t2.chybnych} chybných`}
            />
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{t2.tyden}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Celkem {formatNumber(p.celkemUzivatelu)} uživatelů napříč firmami.
      </p>
    </div>
  );
}
