import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 py-6 dark:border-zinc-800">
      <div className="mx-auto flex max-w-4xl justify-center gap-6 px-8 text-xs text-zinc-500 dark:text-zinc-400">
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
    </footer>
  );
}
