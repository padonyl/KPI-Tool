import { PageHero } from "@/components/marketing/PageHero";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
    </svg>
  );
}

const STEPS = [
  { title: "Napíšeš", body: "Pár vět o firmě a o tom, co dnes s KPI řešíš." },
  { title: "Odpovíme osobně", body: "Ne přes tým podpory — přímo my, obvykle do pár dní." },
  { title: "Domluvíme pilot", body: "Nastavíme aplikaci na tvá data a začneš zdarma." },
];

export default function ContactPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        eyebrow="Kontakt"
        title="Napiš nám"
        subtitle="Ať už řešíš přihlášení do pilotního programu, otázku k aplikaci, nebo chceš nahlásit problém."
      />

      <section className="mx-auto max-w-2xl px-8 py-4">
        <div className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-gradient-to-br from-brand/5 to-transparent p-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-solid text-white">
            <MailIcon />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">E-mail</p>
            <p className="text-lg font-medium text-brand-ink">
              <a href="mailto:contact@padonyl.com" className="hover:underline">
                contact@padonyl.com
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-8 py-20">
        <h2 className="font-display mb-10 text-center text-2xl font-semibold text-brand-ink">
          Co se stane dál
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 font-display text-lg font-semibold text-brand">
                {i + 1}
              </div>
              <h3 className="font-medium text-black dark:text-zinc-50">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
