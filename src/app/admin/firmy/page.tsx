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
  searchParams: Promise<{ filtr?: string }>;
}) {
  const admin = await overAdmina();
  // Komu tady nic není, ten se nemá dozvědět, že tu něco je.
  if (!admin) notFound();

  const { filtr } = await searchParams;
  const jenCekajici = filtr === "cekajici";

  const firmy = await nactiFirmy(jenCekajici);
  const vsechny = jenCekajici ? await nactiFirmy(false) : firmy;
  const pocetCekajicich = vsechny.filter((f) => f.stav === "pending").length;

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
            href="/admin/firmy"
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              jenCekajici
                ? "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                : "border-brand-solid bg-brand-solid font-medium text-white"
            }`}
          >
            Všechny ({formatNumber(vsechny.length)})
          </Link>
          <Link
            href="/admin/firmy?filtr=cekajici"
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

      {firmy.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {jenCekajici
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
