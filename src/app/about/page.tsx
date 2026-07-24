import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";

const HIGHLIGHTS = [
  { value: "10+", label: "let v supply chain, farmaceutické výrobě a projektovém řízení" },
  { value: "3", label: "obory, ve kterých se ten samý vzorec opakoval pořád dokola" },
  { value: "0", label: "senzorů nebo drahých integrací potřeba k prvnímu KPI" },
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
            <div key={item.label} className="rounded-xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-display text-3xl font-semibold text-brand">{item.value}</p>
              <p className="mt-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-8 py-16">
        <blockquote className="font-display border-l-4 border-brand pl-6 text-xl leading-8 text-balance text-brand-ink italic">
          "Firmy mají v ERP nebo v Excelu spoustu provozních dat, ale nikdo
          v nich systematicky nehledá, co z nich jde vyčíst navíc."
        </blockquote>

        <div className="mt-10 flex flex-col gap-6 text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          <p>
            Padonyl vzniklo z jedné opakující se zkušenosti — přes deset let
            v supply chain, farmaceutické výrobě a projektovém řízení jsme
            pořád viděli stejný vzorec: sledování KPI zůstává buď na papíře,
            nebo v ruční tabulce, kterou aktualizuje jeden člověk jednou za
            měsíc.
          </p>
          <p>
            Nechtěli jsme stavět další nástroj pro firmy, co už vědí, co
            chtějí sledovat, a stačí jim hezčí graf — to zvládne Excel sám.
            Chtěli jsme nástroj pro firmu, co neví, že z dodacích listů,
            faktur nebo výrobních záznamů, které už má, jde konkrétní
            ukazatel spočítat automaticky, v čase, bez ručního přepočítávání
            každý měsíc.
          </p>
          <p>
            Appka je dnes v rané, pilotní fázi. Stavíme ji přímo s prvními
            firmami, ne dopředu za zavřenými dveřmi.
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
            Chceš být mezi prvními?
          </h2>
          <p className="mb-7 text-white/70">
            Pokud píšeš z výrobní firmy a chceš appku vyzkoušet jako jeden
            z prvních, napiš nám.
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
