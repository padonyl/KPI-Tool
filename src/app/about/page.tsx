import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";

// ------------------------------------------------------------
// Firemní „O nás" (přepsáno 2026-08-14).
//
// Vědomě NEopakuje příběh nástroje („firmy nevědí, co jim data řeknou") -
// ten patří na /kpi-tool. Tady je řeč o firmě: odkud bereme know-how, jak
// pracujeme, v jaké jsme fázi. Viz znacka_a_marketingovy_web.md.
// ------------------------------------------------------------

const HIGHLIGHTS = [
  { value: "10+", label: "let praxe v supply chain, farmaceutické výrobě a projektovém řízení" },
  { value: "3", label: "obory, ve kterých se opakovaly stejné provozní problémy" },
  { value: "1", label: "nástroj v pilotní fázi — a poradenství na vyžádání" },
];

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        eyebrow="O nás"
        title="Postavené na letech v provozu, ne na tabulce v prezentaci"
      />

      <section className="mx-auto max-w-3xl px-8 py-4">
        <div className="grid gap-6 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="font-display text-3xl font-semibold text-brand">{item.value}</p>
              <p className="mt-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-8 py-16">
        <blockquote className="font-display border-l-4 border-brand pl-6 text-xl leading-8 text-balance text-brand-ink italic">
          „Většinu problémů, na které jsme v provozu naráželi, nešlo koupit
          jako software. Ale skoro u všech pomohlo vidět čísla, která tam
          celou dobu byla."
        </blockquote>

        <div className="mt-10 flex flex-col gap-6 text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          <p>
            Za Padonylem stojí přes deset let práce v supply chainu,
            farmaceutické výrobě a projektovém řízení — tedy v provozu, ne nad
            ním. To je zároveň jediné, co umíme nabídnout navíc oproti komukoliv
            jinému: víme, jak takové firmy reálně fungují, kde vznikají data
            a proč se s nimi většinou nic neděje.
          </p>
          <p>
            Tuhle zkušenost doručujeme dvěma způsoby. Prvním je{" "}
            <Link href="/kpi-tool" className="text-brand hover:underline">
              KPI Tool
            </Link>{" "}
            — nástroj, který firmě spočítá ukazatele z dat, která už dnes
            eviduje. Druhým je poradenství na vyžádání, když se ukáže, že
            problém není v číslech, ale v procesu za nimi.
          </p>
          <p>
            Jsme malá firma v rané fázi a nehrajeme si na víc. Nástroj je
            v pilotním provozu a stavíme ho přímo s prvními zákazníky — což
            znamená rychlejší reakci na konkrétní požadavek, ale i to, že se
            věci ještě mění.
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-ink py-20">
        <div
          aria-hidden="true"
          className="animate-pulse-glow pointer-events-none absolute -bottom-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-glow blur-3xl"
        />
        <div className="relative mx-auto max-w-xl px-8 text-center">
          <h2 className="font-display mb-3 text-2xl font-semibold text-white">
            Pojďme se bavit
          </h2>
          <p className="mb-7 text-white/70">
            Ať už řešíte konkrétní ukazatel, nebo jen tušíte, že vám data něco
            říkají a nevíte co — napište nám.
          </p>
          <Link
            href="/contact"
            className="inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-brand-ink shadow-lg transition-transform hover:scale-[1.03]"
          >
            Napsat nám
          </Link>
        </div>
      </section>
    </div>
  );
}
