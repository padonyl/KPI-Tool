import { Fill } from "@/components/LegalDraftNotice";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">Kontakt</p>
      <h1 className="font-display mb-6 text-3xl font-semibold text-balance text-brand-ink">
        Napiš nám
      </h1>
      <p className="mb-8 max-w-xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
        Ať už řešíš přihlášení do pilotního programu, otázku k appce, nebo
        chceš nahlásit problém — napiš přímo na e-mail níže. Odpovídáme sami,
        ne přes tým podpory.
      </p>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">E-mail</p>
        <p className="mt-1 text-lg font-medium text-brand-ink">
          <Fill>kontaktní e-mail — bude doplněn</Fill>
        </p>
      </div>
    </div>
  );
}
