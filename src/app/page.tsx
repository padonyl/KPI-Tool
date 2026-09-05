import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrystalField } from "@/components/marketing/CrystalField";

// ------------------------------------------------------------
// Firemní homepage (rozhodnuto 2026-08-14).
//
// Tahle stránka je o PADONYLU, ne o nástroji - proto se tu záměrně
// neopakuje pitch KPI Toolu. Teze: Padonyl = expertiza na firemní provoz,
// doručovaná softwarem i radou. Nástroj je jedna z forem, ne celek.
// Detail produktu žije pod /kpi-tool/*. Viz znacka_a_marketingovy_web.md.
//
// POZOR na rozdíl (rozhodnuto 2026-08-14): zmínka o výrobě v headlinu je
// ŽIVOTOPIS, ne vymezení cílovky. Odkud zkušenost je ≠ pro koho je nástroj -
// ten cílí na firmy obecně (viz /kpi-tool "Pro koho je aplikace určená").
// ------------------------------------------------------------

function ToolIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7h-6v6" />
    </svg>
  );
}

function AdviceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 11-3.2-6.4M4.5 19.5L3 21l1-4" />
    </svg>
  );
}

const PRINCIPLES = [
  {
    title: "Z toho, co už máte",
    body: "Žádné senzory, žádná měsíční integrace na ERP. Vycházíme z dat, která ve firmě reálně vznikají — i když jsou dnes jen v Excelu.",
  },
  {
    title: "Přímá linka",
    body: "Mluvíte s člověkem, který tomu rozumí a zároveň to staví. Žádná vrstva obchodníků mezi problémem a řešením.",
  },
  {
    title: "Stavíme se zákazníky",
    body: "První firmy tvarují, jak nástroj vypadá. Radši opravíme, co nesedí, než abychom rok stavěli za zavřenými dveřmi.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Přihlášený uživatel míří do aplikace, ne na firemní vizitku.
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 via-white to-white dark:from-zinc-950 dark:via-black dark:to-black">
        <div
          aria-hidden="true"
          className="animate-pulse-glow pointer-events-none absolute top-[-12rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-brand blur-3xl"
        />
        <div
          aria-hidden="true"
          className="animate-float-slow pointer-events-none absolute right-[-8rem] bottom-[-4rem] h-72 w-72 rounded-full bg-brand-glow opacity-20 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-8 py-28 text-center sm:py-32">
          <p className="animate-fade-up mb-5 text-sm font-medium tracking-[0.2em] text-brand uppercase">
            Padonyl
          </p>
          <h1
            className="animate-fade-up font-display text-4xl leading-[1.1] font-semibold text-balance text-brand-ink sm:text-5xl lg:text-[3.4rem]"
            style={{ animationDelay: "80ms" }}
          >
            Deset let v provozu výrobních firem. Teď z toho stavíme nástroje.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-7 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400"
            style={{ animationDelay: "160ms" }}
          >
            Supply chain, farmaceutická výroba, projektové řízení. Ve všech třech
            se opakovalo to samé: firmy sedí na datech, ze kterých nikdo
            systematicky nečte, jak si vedou. Tuhle zkušenost dnes doručujeme
            dvěma způsoby — softwarem a radou.
          </p>
        </div>
      </section>

      {/* Dvě formy, jedna věc */}
      <section className="relative overflow-hidden py-24">
        <CrystalField variant="light" />
        <div className="relative mx-auto max-w-5xl px-8">
          <h2 className="font-display mb-3 text-center text-3xl font-semibold text-brand-ink">
            Čím se zabýváme
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-zinc-500 dark:text-zinc-400">
            Stejná otázka, dvě odpovědi podle toho, kde firmu tlačí bota.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Produkt */}
            <Link
              href="/kpi-tool"
              className="group flex flex-col rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 to-transparent p-8 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-solid text-white">
                <ToolIcon />
              </div>
              <p className="text-xs font-medium tracking-wide text-brand uppercase">
                Nástroj
              </p>
              <h3 className="font-display mt-1 mb-3 text-2xl font-semibold text-brand-ink">
                KPI Tool
              </h3>
              <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Sleduje klíčové ukazatele firmy v čase — z exportů, které už
                dnes děláte. Namapujete jednou, dál se počítá samo. Aktuálně
                v pilotní fázi, pro první firmy zdarma.
              </p>
              <span className="mt-auto text-sm font-medium text-brand group-hover:underline">
                Prohlédnout nástroj →
              </span>
            </Link>

            {/* Consulting */}
            <Link
              href="/contact"
              className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <AdviceIcon />
              </div>
              <p className="text-xs font-medium tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                Poradenství
              </p>
              <h3 className="font-display mt-1 mb-3 text-2xl font-semibold text-brand-ink">
                Konzultace k provozu
              </h3>
              <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Někdy není problém v tom, že chybí čísla, ale v tom, jak proces
                běží. Na vyžádání se podíváme na konkrétní téma ze supply chainu
                nebo řízení výroby — bez nutnosti cokoliv nasazovat.
              </p>
              <span className="mt-auto text-sm font-medium text-brand group-hover:underline">
                Napsat nám →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Jak pracujeme */}
      <section className="relative overflow-hidden bg-brand-deep py-24">
        <CrystalField variant="dark" />
        <div className="relative mx-auto max-w-5xl px-8">
          <h2 className="font-display mb-14 text-center text-3xl font-semibold text-white">
            Jak pracujeme
          </h2>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="flex flex-col gap-3">
                <span className="h-px w-10 bg-brand-glow/50" />
                <h3 className="font-medium text-white">{principle.title}</h3>
                <p className="text-sm leading-6 text-white/60">{principle.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kontakt */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-8 text-center">
          <h2 className="font-display mb-3 text-3xl font-semibold text-brand-ink">
            Řešíte něco podobného?
          </h2>
          <p className="mb-8 text-zinc-600 dark:text-zinc-400">
            Napište nám, o co jde. Odpovídáme osobně — ne přes tým podpory.
          </p>
          <Link
            href="/contact"
            className="inline-block rounded-md bg-brand-solid px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-solid/30 transition-transform hover:scale-[1.03] hover:bg-brand-deep"
          >
            Napsat nám
          </Link>
        </div>
      </section>
    </div>
  );
}
