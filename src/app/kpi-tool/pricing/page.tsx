import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 shrink-0 text-brand">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const PILOT_INCLUDES = [
  "Neomezené nahrávání dat po dobu pilotu",
  "Vlastní šablony pro automatické zpracování souborů",
  "Víc uživatelů ve firmě, s rolemi (admin/superuser/uživatel)",
  "Přímá linka na nás — tvůj požadavek ovlivní, co aplikace umí dál",
];

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        eyebrow="Ceník"
        title="V pilotní fázi aplikaci dostaneš zdarma"
        subtitle="Hledáme první firmy, které nám pomůžou aplikaci dotvarovat. Výměnou za zpětnou vazbu ji po dobu pilotu nepoužíváš za nic."
      />

      <section className="mx-auto max-w-2xl px-8 py-4">
        <div className="rounded-2xl border-2 border-brand bg-gradient-to-br from-brand/5 to-transparent p-8 shadow-xl shadow-brand/10">
          <div className="mb-1 flex items-center gap-3">
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
              Pilotní program
            </span>
          </div>
          <p className="font-display mt-4 text-4xl font-semibold text-brand-ink">
            0 Kč <span className="font-sans text-base font-normal text-zinc-500">po dobu pilotu</span>
          </p>
          <ul className="mt-7 mb-8 flex flex-col gap-3">
            {PILOT_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="inline-block rounded-md bg-brand px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand/30 transition-transform hover:scale-[1.03] hover:bg-brand-ink"
          >
            Přihlásit se do pilotu
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-8 py-20">
        <h2 className="font-display mb-2 text-center text-2xl font-semibold text-brand-ink">
          Co bude po pilotu
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-center text-sm text-zinc-500 dark:text-zinc-400">
          Přesná čísla zveřejníme, až budeme mít dost zpětné vazby na to, aby
          odpovídala skutečné hodnotě, ne odhadu. Struktura je ale jasná už teď.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-1 font-medium text-brand-ink">Základ za firmu</h3>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Fixní měsíční paušál, ať máš ve firmě jednoho člověka, nebo pět.
            </p>
            <p className="text-lg font-semibold text-zinc-400">Cena po pilotu</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-1 font-medium text-brand-ink">+ podle týmu</h3>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Malý příplatek za dalšího uživatele nad rámec zahrnutého počtu.
            </p>
            <p className="text-lg font-semibold text-zinc-400">Cena po pilotu</p>
          </div>
        </div>
      </section>
    </div>
  );
}
