import Link from "next/link";
import { notFound } from "next/navigation";
import { overAdmina } from "@/lib/admin";
import { nactiPrehled } from "@/lib/admin-data";
import { RozhodnutiOFirme } from "@/components/admin/RozhodnutiOFirme";
import { formatNumber } from "@/lib/format-number";

// Domovská obrazovka provozovatele: co vyžaduje jeho pozornost.
//
// ZÁMĚRNĚ SEZNAMY, NE STATISTIKY. Seznam „těmhle firmám zavolej" dává
// smysl od prvního zákazníka. Míra aktivace nad dvěma firmami je šum —
// ta patří na /admin/provoz, kde je jasné, že jde o statistiku.

function Cislo({
  hodnota,
  popis,
  zvyraznit = false,
}: {
  hodnota: number;
  popis: string;
  zvyraznit?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        zvyraznit && hodnota > 0
          ? "border-brand/40 bg-brand/5"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <p className="font-display text-2xl font-semibold text-brand-ink dark:text-zinc-100">
        {formatNumber(hodnota)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{popis}</p>
    </div>
  );
}

function Sekce({
  nadpis,
  vysvetleni,
  prazdno,
  children,
  pocet,
}: {
  nadpis: string;
  vysvetleni: string;
  prazdno: string;
  pocet: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 font-display text-lg font-semibold text-brand-ink dark:text-zinc-100">
        {nadpis}
      </h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{vysvetleni}</p>
      {pocet === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {prazdno}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {children}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPrehledPage() {
  if (!(await overAdmina())) notFound();

  const prehled = await nactiPrehled();

  return (
    <div className="pb-12">
      <h1 className="font-display mb-6 text-3xl font-semibold text-brand-ink dark:text-zinc-100">
        Přehled
      </h1>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cislo hodnota={prehled.cekaNaSchvaleni.length} popis="čeká na schválení" zvyraznit />
        <Cislo hodnota={prehled.novePosledniTyden} popis="nových za týden" />
        <Cislo hodnota={prehled.usnule.length} popis="usnulých firem" />
        <Cislo hodnota={prehled.sChybami.length} popis="firem s chybným nahráním" zvyraznit />
      </div>

      <Sekce
        nadpis="Čeká na schválení"
        vysvetleni="Firmy, které se registrovaly a bez tvého rozhodnutí se do nástroje nedostanou."
        prazdno="Nic nečeká."
        pocet={prehled.cekaNaSchvaleni.length}
      >
        {prehled.cekaNaSchvaleni.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <Link
                href={`/admin/firmy/${f.id}`}
                className="font-medium text-brand-ink hover:underline dark:text-zinc-100"
              >
                {f.nazev}
              </Link>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                registrace {new Date(f.vznikla).toLocaleDateString("cs-CZ")} ·{" "}
                {formatNumber(f.pocetUzivatelu)} uživ.
              </p>
            </div>
            <RozhodnutiOFirme companyId={f.id} stav={f.stav} nazev={f.nazev} />
          </li>
        ))}
      </Sekce>

      <Sekce
        nadpis="Firmám selhalo nahrávání"
        vysvetleni="Za poslední týden. Nejpřímější signál, že zákazník někde uvázl — zavolej dřív, než to vzdá."
        prazdno="Za poslední týden nic neselhalo."
        pocet={prehled.sChybami.length}
      >
        {prehled.sChybami.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Link
              href={`/admin/firmy/${f.id}`}
              className="font-medium text-brand-ink hover:underline dark:text-zinc-100"
            >
              {f.nazev}
            </Link>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {formatNumber(f.chybnychNahrani ?? 0)}× chyba
            </span>
          </li>
        ))}
      </Sekce>

      <Sekce
        nadpis="Usnulé firmy"
        vysvetleni="Schválené déle než 14 dní, ale posledních 30 dní nic nenahrály. Lhůta je tam schválně — kdo se registroval včera, ještě nespí."
        prazdno="Žádná firma nespí."
        pocet={prehled.usnule.length}
      >
        {prehled.usnule.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Link
              href={`/admin/firmy/${f.id}`}
              className="font-medium text-brand-ink hover:underline dark:text-zinc-100"
            >
              {f.nazev}
            </Link>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {f.dniOdNahrani === null
                ? "nikdy nic nenahrála"
                : `naposledy před ${formatNumber(f.dniOdNahrani)} dny`}
            </span>
          </li>
        ))}
      </Sekce>
    </div>
  );
}
