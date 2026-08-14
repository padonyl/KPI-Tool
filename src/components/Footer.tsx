import Link from "next/link";
import { KPI_TOOL_LINKS, KPI_TOOL_LEGAL_LINKS } from "@/lib/nav-links";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 py-10 dark:border-zinc-800">
      <div className="mx-auto grid max-w-4xl gap-8 px-8 sm:grid-cols-3">
        {/* Firemní úroveň */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            Padonyl
          </p>
          <Link href="/" className="text-xs text-zinc-500 hover:text-brand dark:text-zinc-400">
            Úvod
          </Link>
          <Link href="/about" className="text-xs text-zinc-500 hover:text-brand dark:text-zinc-400">
            O nás
          </Link>
          <Link href="/contact" className="text-xs text-zinc-500 hover:text-brand dark:text-zinc-400">
            Kontakt
          </Link>
        </div>

        {/* Produktová úroveň */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            KPI Tool
          </p>
          {KPI_TOOL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-zinc-500 hover:text-brand dark:text-zinc-400"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Právní dokumenty - patří k nástroji, ne k firmě */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            Právní
          </p>
          {KPI_TOOL_LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-zinc-500 hover:text-brand dark:text-zinc-400"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
        © {new Date().getFullYear()} Padonyl s.r.o.
      </p>
    </footer>
  );
}
