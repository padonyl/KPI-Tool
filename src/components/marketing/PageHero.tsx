import { CrystalField } from "./CrystalField";

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 via-white to-white dark:from-zinc-950 dark:via-black dark:to-black">
      <div
        aria-hidden="true"
        className="animate-pulse-glow pointer-events-none absolute top-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand blur-3xl"
      />
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-2xl px-8 py-20 text-center">
        <p className="animate-fade-up mb-3 text-sm font-medium tracking-wide text-brand uppercase">
          {eyebrow}
        </p>
        <h1
          className="animate-fade-up font-display text-4xl font-semibold text-balance text-brand-ink"
          style={{ animationDelay: "80ms" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="animate-fade-up mx-auto mt-5 max-w-xl text-lg leading-7 text-zinc-600 dark:text-zinc-400"
            style={{ animationDelay: "160ms" }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
