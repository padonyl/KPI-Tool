import Link from "next/link";

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
  "Přímá linka na nás — tvůj požadavek ovlivní, co appka umí dál",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">Ceník</p>
      <h1 className="font-display mb-4 text-3xl font-semibold text-balance text-brand-ink">
        V pilotní fázi appku dostaneš zdarma
      </h1>
      <p className="mb-10 max-w-xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
        Appka je v aktivním vývoji a hledáme první firmy, které nám pomůžou
        ji dotvarovat. Výměnou za zpětnou vazbu appku po dobu pilotu
        nepoužíváš za nic.
      </p>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-8">
        <h2 className="mb-1 text-lg font-semibold text-brand-ink">Pilotní program</h2>
        <p className="mb-6 text-3xl font-semibold text-brand-ink">
          0 Kč <span className="text-base font-normal text-zinc-500">po dobu pilotu</span>
        </p>
        <ul className="mb-8 flex flex-col gap-3">
          {PILOT_INCLUDES.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <CheckIcon />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/contact"
          className="inline-block rounded-md bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
        >
          Přihlásit se do pilotu
        </Link>
      </div>

      <div className="mt-10 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        <p>
          <strong className="text-zinc-700 dark:text-zinc-300">Co bude po pilotu?</strong>{" "}
          Cena bude odpovídat tomu, jak appku reálně používáte — kolik lidí
          ve firmě s ní pracuje a kolik ukazatelů sledujete. Přesný ceník
          zveřejníme, až budeme mít dost zpětné vazby z pilotů na to, aby
          odpovídal skutečné hodnotě, ne odhadu.
        </p>
      </div>
    </div>
  );
}
