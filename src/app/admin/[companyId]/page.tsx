import Link from "next/link";
import { notFound } from "next/navigation";
import { overAdmina } from "@/lib/admin";
import { nactiDetailFirmy } from "@/lib/admin-data";
import { CompanyStatusBadge } from "@/components/CompanyStatusBadge";
import { RozhodnutiOFirme } from "@/components/admin/RozhodnutiOFirme";
import { BACK_LINK } from "@/lib/ui-classes";

// Detail firmy v admin prostředí — pořád jen metadata.
//
// Chybí tu záměrně cokoliv o jejích číslech. Vidět, ŽE firma nahrála
// data, je provozní informace; vidět CO nahrála, je její věc. Přístup
// k číslům bude samostatná funkce na pozvání od té firmy.

export default async function DetailFirmyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const admin = await overAdmina();
  if (!admin) notFound();

  const { companyId } = await params;
  const firma = await nactiDetailFirmy(companyId);
  if (!firma) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-12 font-sans">
      <Link href="/admin" className={`mb-6 inline-block ${BACK_LINK}`}>
        ← Zpět na firmy
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-3xl font-semibold text-brand-ink">
              {firma.nazev}
            </h1>
            <CompanyStatusBadge status={firma.stav} />
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registrována {new Date(firma.vznikla).toLocaleString("cs-CZ")}
          </p>
        </div>

        <RozhodnutiOFirme
          companyId={firma.id}
          stav={firma.stav}
          nazev={firma.nazev}
        />
      </div>

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          O firmě
        </h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Polozka nazev="Obor" hodnota={firma.obor} />
          <Polozka nazev="Velikost" hodnota={firma.velikost} />
          <Polozka nazev="Země" hodnota={firma.zeme} />
          <Polozka nazev="Šablon" hodnota={String(firma.pocetSablon)} />
          <Polozka
            nazev="Naposledy nahráno"
            hodnota={
              firma.posledniNahrani
                ? new Date(firma.posledniNahrani).toLocaleString("cs-CZ")
                : "nikdy"
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          Uživatelé ({firma.uzivatele.length})
        </h2>

        {firma.uzivatele.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Firma nemá žádného uživatele — vznikla, ale nikdo se k ní nenapojil.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {firma.uzivatele.map((u) => (
              <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-brand-ink dark:text-zinc-100">
                    {u.email}
                  </p>
                  {u.jmeno && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {u.jmeno}
                    </p>
                  )}
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        Data firmy — hodnoty KPI, nahrané soubory — tu vidět nejsou a nebudou.
        Přístup k nim bude možný jen na pozvání od firmy, časově omezeně.
      </p>
    </div>
  );
}

function Polozka({ nazev, hodnota }: { nazev: string; hodnota: string | null }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{nazev}</dt>
      <dd className="text-sm text-brand-ink dark:text-zinc-100">
        {hodnota ?? "—"}
      </dd>
    </div>
  );
}
