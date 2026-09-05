import Link from "next/link";
import { notFound } from "next/navigation";
import { overAdmina } from "@/lib/admin";
import { nactiFirmy } from "@/lib/admin-data";
import { CompanyStatusBadge } from "@/components/CompanyStatusBadge";
import { RozhodnutiOFirme } from "@/components/admin/RozhodnutiOFirme";
import { formatNumber } from "@/lib/format-number";

// Admin prostředí provozovatele — přehled firem.
//
// Vidí METADATA, ne obsah: kdo se registroval, jestli čeká, jestli s
// nástrojem pracuje. Žádná hodnota KPI se sem nedostane, viz admin-data.ts.

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filtr?: string; hledat?: string }>;
}) {
  const admin = await overAdmina();
  // Komu tady nic není, ten se nemá dozvědět, že tu něco je.
  if (!admin) notFound();

  const { filtr, hledat } = await searchParams;
  const jenCekajici = filtr === "cekajici";
  const dotaz = (hledat ?? "").trim();

  const vseVeFiltru = await nactiFirmy(jenCekajici);
  const vsechny = jenCekajici ? await nactiFirmy(false) : vseVeFiltru;
  const pocetCekajicich = vsechny.filter((f) => f.stav === "pending").length;

  // Hledá se v paměti, ne v databázi. Při dnešních počtech je to
  // jednodušší a rychlejší; až jich budou tisíce, přesune se to do
  // dotazu. Porovnává se bez diakritiky a bez ohledu na velikost písmen —
  // „Pekarna" má najít „Pekárna", jinak je hledání k ničemu.
  const bezDiakritiky = (t: string) =>
    t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const firmy = dotaz
    ? vseVeFiltru.filter((f) => bezDiakritiky(f.nazev).includes(bezDiakritiky(dotaz)))
    : vseVeFiltru;

  // Rám a označení sekce dodává layout.tsx — tady začíná rovnou obsah.
  return (
    <div className="pb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-ink dark:text-zinc-100">
            Firmy
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Přihlášen jako {admin.email}. Vidíš metadata firem, ne jejich data.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={dotaz ? `/admin/firmy?hledat=${encodeURIComponent(dotaz)}` : "/admin/firmy"}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              jenCekajici
                ? "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                : "border-brand-solid bg-brand-solid font-medium text-white"
            }`}
          >
            Všechny ({formatNumber(vsechny.length)})
          </Link>
          <Link
            href={`/admin/firmy?filtr=cekajici${dotaz ? `&hledat=${encodeURIComponent(dotaz)}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              jenCekajici
                ? "border-brand-solid bg-brand-solid font-medium text-white"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            Čekající ({formatNumber(pocetCekajicich)})
          </Link>
        </div>
      </div>

      {/* Obyčejný formulář odesílaný metodou GET: hledání zůstane v adrese,
          takže se dá poslat odkazem a funguje i tlačítko zpět. Na tohle
          není potřeba komponenta běžící v prohlížeči. */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        {jenCekajici && <input type="hidden" name="filtr" value="cekajici" />}
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="hledat" className="text-xs text-zinc-600 dark:text-zinc-400">
            Hledat firmu
          </label>
          <input
            id="hledat"
            name="hledat"
            type="search"
            defaultValue={dotaz}
            placeholder="název firmy"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
        >
          Hledat
        </button>
        {dotaz && (
          <Link
            href={jenCekajici ? "/admin/firmy?filtr=cekajici" : "/admin/firmy"}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Zrušit
          </Link>
        )}
      </form>

      {dotaz && (
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Hledání „{dotaz}" — {formatNumber(firmy.length)}{" "}
          {firmy.length === 1 ? "firma" : firmy.length < 5 ? "firmy" : "firem"}
        </p>
      )}

      {firmy.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {dotaz
            ? `Nic neodpovídá hledání „${dotaz}".`
            : jenCekajici
            ? "Žádná firma nečeká na schválení."
            : "Zatím tu není žádná firma."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {firmy.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/firmy/${f.id}`}
                    className="font-medium text-brand-ink hover:underline dark:text-zinc-100"
                  >
                    {f.nazev}
                  </Link>
                  <CompanyStatusBadge status={f.stav} />
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {popisAktivity(f.pocetUzivatelu, f.pocetSablon, f.posledniNahrani)}
                </p>
              </div>

              <RozhodnutiOFirme companyId={f.id} stav={f.stav} nazev={f.nazev} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Shrne v jedné větě, jestli firma nástroj používá, nebo jen sedí. */
function popisAktivity(
  uzivatelu: number,
  sablon: number,
  posledni: string | null,
): string {
  const casti = [
    `${formatNumber(uzivatelu)} ${sklonuj(uzivatelu, "uživatel", "uživatelé", "uživatelů")}`,
    `${formatNumber(sablon)} ${sklonuj(sablon, "šablona", "šablony", "šablon")}`,
  ];

  casti.push(
    posledni
      ? `naposledy nahráno ${new Date(posledni).toLocaleDateString("cs-CZ")}`
      : "nikdy nic nenahrála",
  );

  return casti.join(" · ");
}

function sklonuj(n: number, jedna: string, dva: string, pet: string): string {
  if (n === 1) return jedna;
  if (n >= 2 && n <= 4) return dva;
  return pet;
}
