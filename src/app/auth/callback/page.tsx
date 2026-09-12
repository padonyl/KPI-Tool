import { DokonceniPrihlaseni } from "./DokonceniPrihlaseni";

// Přistání po kliknutí na odkaz z e-mailu.
//
// Tahle stránka sama NIC neověřuje — jen si přebere, kam se má po
// přihlášení pokračovat, a zbytek nechá na prohlížeči. Proč to tak je, a
// co se stane, když se výměna kódu udělá na serveru, vysvětluje komentář
// v DokonceniPrihlaseni.tsx.

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; chyba?: string }>;
}) {
  const { next, chyba } = await searchParams;
  // Jen relativní cesta — s cizí adresou by z toho byla otevřená
  // přesměrovací díra použitelná v podvodných e-mailech.
  const kam = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return <DokonceniPrihlaseni kam={kam} pocatecniChyba={chyba ?? null} />;
}
