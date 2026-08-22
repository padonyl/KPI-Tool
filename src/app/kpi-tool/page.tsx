import Link from "next/link";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { CrystalField } from "@/components/marketing/CrystalField";

function UploadStepIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
    </svg>
  );
}
function MapStepIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 6l4-3M4 6l4 3M20 6l-4-3M20 6l-4 3M4 18h16M4 18l4-3M4 18l4 3M20 18l-4-3M20 18l-4 3" />
    </svg>
  );
}
function CalcStepIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path strokeLinecap="round" d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3" />
    </svg>
  );
}
function TrackStepIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7h-6v6" />
    </svg>
  );
}

const STEPS = [
  { icon: UploadStepIcon, title: "Nahraješ, co už máš", body: "Excel export z ERP, CSV ze skladu, cokoliv s daty o dodávkách, prodejích nebo kvalitě." },
  { icon: MapStepIcon, title: "Namapuješ jednou", body: "Aplikace se zeptá, co který sloupec znamená. Příště už soubor rozpozná sama." },
  { icon: CalcStepIcon, title: "KPI se dopočítají sama", body: "Tržby, OTIF, zmetkovitost — odvozené přímo ze surových dat, ne z ručně předpočítaných čísel." },
  { icon: TrackStepIcon, title: "Sleduješ vývoj v čase", body: "Každý další upload přidá bod do grafu. Vidíš trend, ne jen jeden snímek." },
];

export default function KpiToolPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 via-white to-white dark:from-zinc-950 dark:via-black dark:to-black">
        <div
          aria-hidden="true"
          className="animate-pulse-glow pointer-events-none absolute top-[-10rem] left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand blur-3xl"
        />
        <div
          aria-hidden="true"
          className="animate-float-slow pointer-events-none absolute top-24 right-[-6rem] h-72 w-72 rounded-full bg-brand-glow opacity-20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="animate-float-slower pointer-events-none absolute bottom-[-6rem] left-[-4rem] h-80 w-80 rounded-full bg-brand-light opacity-10 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-8 py-24 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:py-32">
          <div className="text-center lg:text-left">
            <p className="animate-fade-up mb-4 text-sm font-medium tracking-wide text-brand uppercase">
              <Link href="/" className="transition-colors hover:text-brand-ink">
                Padonyl
              </Link>{" "}
              <span className="text-brand/40">/</span> KPI Tool
            </p>
            <h1
              className="animate-fade-up font-display text-4xl leading-[1.1] font-semibold text-balance text-brand-ink sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              Data, která už ve firmě máš, ti řeknou víc, než čekáš.
            </h1>
            <p
              className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-7 text-zinc-600 lg:mx-0 dark:text-zinc-400"
              style={{ animationDelay: "160ms" }}
            >
              KPI Tool sleduje klíčové ukazatele tvého provozu v čase — bez
              senzorů, bez ERP integrace, jen z dat, která už dnes
              eviduješ v Excelu nebo systému.
            </p>
            <div
              className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                href="/login"
                className="rounded-md bg-brand-solid px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-solid/30 transition-transform hover:scale-[1.03] hover:bg-brand-deep"
              >
                Vyzkoušet zdarma
              </Link>
              <a
                href="#jak-to-funguje"
                className="rounded-md px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:text-brand dark:text-zinc-300"
              >
                Jak to funguje ↓
              </a>
            </div>
          </div>

          <div
            className="animate-fade-up flex justify-center lg:justify-end"
            style={{ animationDelay: "320ms" }}
          >
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Jak to funguje — plnobarevná sekce */}
      <section id="jak-to-funguje" className="relative overflow-hidden bg-brand-deep py-24">
        <CrystalField variant="dark" />
        <div className="relative mx-auto max-w-5xl px-8">
          <h2 className="font-display mb-3 text-center text-3xl font-semibold text-white">
            Jak aplikace pracuje
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-white/60">
            Čtyři kroky, žádný z nich neděláš znovu ručně po prvním nastavení.
          </p>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-brand-glow ring-1 ring-white/15">
                  <step.icon />
                </div>
                <p className="font-display text-3xl font-semibold text-white/20">
                  0{i + 1}
                </p>
                <h3 className="font-medium text-white">{step.title}</h3>
                <p className="text-sm leading-6 text-white/60">{step.body}</p>
                {i < STEPS.length - 1 && (
                  <span className="absolute top-6 right-[-1.6rem] hidden h-px w-8 bg-white/15 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pro koho */}
      <section className="relative overflow-hidden py-24">
        <CrystalField variant="light" />
        <div className="relative mx-auto max-w-3xl px-8 text-center">
          <h2 className="font-display mb-4 text-3xl font-semibold text-brand-ink">
            Pro koho je aplikace určená
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Malé a střední firmy <strong className="text-brand-ink dark:text-zinc-100">(50–500 zaměstnanců)</strong> v ČR a na Slovensku,
            které dnes vedou KPI ručně v Excelu nebo vůbec — bez ERP integrace,
            bez rozpočtu na senzory a konzultanty. Výroba, distribuce, služby:
            rozhoduje to, jestli firma sbírá provozní data, ne v jakém je oboru.
            Nejde o to, že bys neznal svá čísla — jde o to, že z dat, která už
            sbíráš, jde vytáhnout víc, než si dnes všímáš.
          </p>
        </div>
      </section>

      {/* Pilot CTA — barevný blok */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-solid to-brand-deep py-24">
        <div
          aria-hidden="true"
          className="animate-pulse-glow pointer-events-none absolute -bottom-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-glow blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl px-8 text-center">
          <h2 className="font-display mb-3 text-3xl font-semibold text-white">
            Pilotní program zdarma
          </h2>
          <p className="mb-8 text-white/70">
            Aplikace je v aktivním vývoji. První firmy ji dostávají zdarma
            výměnou za zpětnou vazbu — pomůžeš tvarovat produkt, na který se
            budou moct spolehnout ostatní po tobě.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-brand-deep shadow-lg transition-transform hover:scale-[1.03]"
          >
            Přihlásit se / Zaregistrovat se
          </Link>
        </div>
      </section>
    </div>
  );
}
