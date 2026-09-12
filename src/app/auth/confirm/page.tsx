import { PRIMARY_BUTTON } from "@/lib/ui-classes";
import Link from "next/link";

// Přistání odkazu z e-mailu — ZÁMĚRNĚ tu nic neověřujeme.
//
// Odkaz nese jednorázový token. Kdyby ho ověřilo už samotné načtení téhle
// stránky (GET), spotřeboval by ho kdokoliv, kdo si adresu jen otevře —
// a to dělají mailové aplikace a bezpečnostní skenery schránek běžně:
// než odkaz ukážou člověku, načtou si ho, aby zkontrolovaly, kam vede.
// Uživatel pak klikne a dostane „odkaz už neplatí", protože ho někdo
// spotřeboval před ním. Nahlásil uživatel 12. 9. 2026 přesně takhle:
// odkaz otevřený z mailové appky na telefonu skončil chybou, tentýž tok
// v běžném prohlížeči prošel.
//
// Proto se tady jen ukáže tlačítko. Ověření dělá až POST na
// /auth/confirm/potvrdit, který skener nevyvolá — ten umí jen GET.

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  const karta =
    "w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950";
  const obal =
    "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black";

  if (!token_hash || !type) {
    return (
      <div className={obal}>
        <div className={karta}>
          <h1 className="mb-2 text-xl font-semibold text-black dark:text-zinc-50">
            Odkaz nefunguje
          </h1>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Odkaz je neúplný nebo poškozený. Nech si prosím poslat nový.
          </p>
          <Link href="/login" className="text-sm text-brand underline">
            Zpět na přihlášení
          </Link>
        </div>
      </div>
    );
  }

  const popis =
    type === "recovery"
      ? "Potvrď, že jsi to ty, a můžeš si nastavit nové heslo."
      : "Potvrď, že jsi to ty, a dokončíme přihlášení.";

  return (
    <div className={obal}>
      <div className={karta}>
        <h1 className="mb-2 text-xl font-semibold text-black dark:text-zinc-50">
          Ještě jedno kliknutí
        </h1>
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">{popis}</p>

        <form method="POST" action="/auth/confirm/potvrdit">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <button type="submit" className={PRIMARY_BUTTON}>
            {type === "recovery" ? "Nastavit nové heslo" : "Pokračovat"}
          </button>
        </form>
      </div>
    </div>
  );
}
