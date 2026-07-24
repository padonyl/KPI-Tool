import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 py-6 dark:border-zinc-800">
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2 px-8 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/about" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          O nás
        </Link>
        <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Ceník
        </Link>
        <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Kontakt
        </Link>
        <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Časté otázky
        </Link>
        <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Obchodní podmínky
        </Link>
        <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Ochrana osobních údajů
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-600">
        © {new Date().getFullYear()} Padonyl s.r.o.
      </p>
    </footer>
  );
}
