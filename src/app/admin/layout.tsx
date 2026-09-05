import Link from "next/link";
import { notFound } from "next/navigation";
import { overAdmina } from "@/lib/admin";

// Společný rám admin prostředí: ověření a podnavigace.
//
// Ověření je tu ZÁMĚRNĚ, i když ho má každá stránka i sama u sebe. Rám
// se vykresluje kolem všech a chybu v jedné stránce tím zachytí; a
// naopak, kdyby někdo rám odstranil, stránky se ubrání samy. Dva zámky,
// kde stačil jeden — u přístupu napříč firmami to stojí za to.
//
// Sekce jsou tady, ne v horní liště: ta říká „jsi provozovatel a tudy
// zpátky", členění provozu patří dovnitř.

const SEKCE = [
  { href: "/admin", label: "Přehled", popis: "Co vyžaduje tvoji pozornost" },
  { href: "/admin/firmy", label: "Firmy", popis: "Kdo se registroval a co dělá" },
  { href: "/admin/provoz", label: "Provoz nástroje", popis: "Jak si vede samotný produkt" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Komu tady nic není, ten se nemá dozvědět, že tu něco je. Proto 404,
  // ne 403 — odmítnutí by existenci sekce potvrdilo.
  if (!(await overAdmina())) notFound();

  return (
    <div className="mx-auto max-w-6xl px-8 pt-10 font-sans">
      <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
        Provoz
      </p>

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {SEKCE.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            title={s.popis}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
