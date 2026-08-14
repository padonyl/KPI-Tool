import Link from "next/link";
import { KPI_TOOL_LINKS } from "@/lib/nav-links";

/**
 * Podnavigace uvnitř produktu KPI Tool.
 *
 * Drží dohromady stránky nástroje a zároveň drobečkem „Padonyl /“ pořád
 * připomíná, že nástroj je jedna z věcí, které firma dělá - právě kvůli tomu
 * celé oddělení vzniklo (viz nav-links.ts).
 */
export function ProductNav() {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5 font-sans text-sm">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <Link href="/" className="transition-colors hover:text-brand">
            Padonyl
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-brand-ink dark:text-zinc-100">KPI Tool</span>
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">
          {KPI_TOOL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-zinc-600 transition-colors hover:text-brand dark:text-zinc-400"
            >
              {link.label}
            </Link>
          ))}
        </span>
      </div>
    </div>
  );
}
