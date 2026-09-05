import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormularJmena, FormularHesla } from "./UcetForms";

// Nastavení vlastního účtu.
//
// Odděleno od /settings, které je nastavení FIRMY (tolerance a cíle KPI).
// Tohle je o člověku: jak se jmenuje a jakým heslem se přihlašuje.
//
// E-mail je zatím jen k přečtení. Jeho změna není políčko ve formuláři —
// musí se ověřit nová adresa, jinak by šlo přihlášení omylem (nebo
// záměrně) převést na cizí schránku. Až na to dojde, bude to vlastní tok
// s potvrzovacím e-mailem.

const ROLE_POPIS: Record<string, string> = {
  user: "Uživatel — vidí KPI, nenahrává",
  customer_superuser: "Superuser — nahrává data",
  customer_admin: "Admin firmy — mapuje, nastavuje a spravuje tým",
};

function Sekce({
  nadpis,
  popis,
  children,
}: {
  nadpis: string;
  popis?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-display mb-1 text-lg font-semibold text-brand-ink dark:text-zinc-100">
        {nadpis}
      </h2>
      {popis && <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{popis}</p>}
      {children}
    </section>
  );
}

export default async function UcetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("users")
    .select("full_name, role, companies(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // @ts-expect-error - supabase join typing
  const nazevFirmy: string | null = profil?.companies?.name ?? null;

  return (
    <div className="mx-auto max-w-6xl px-8 py-16 font-sans">
      <h1 className="font-display mb-1 text-3xl font-semibold text-brand-ink dark:text-zinc-100">
        Můj účet
      </h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Nastavení tvojí osoby. Nastavení firmy najdeš v sekci Nastavení.
      </p>

      <div className="grid items-start gap-x-6 lg:grid-cols-2">
        <div>
          <Sekce nadpis="Profil">
            <FormularJmena jmeno={profil?.full_name ?? ""} />
          </Sekce>

          <Sekce nadpis="Přihlašovací e-mail">
            <p className="text-sm text-black dark:text-zinc-100">{user.email}</p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Změna e-mailu zatím v aplikaci není — musí se ověřit nová schránka,
              jinak by šlo přihlášení převést na cizí adresu. Napiš nám a přehodíme to.
            </p>
          </Sekce>

          {profil && (
            <Sekce nadpis="Zařazení">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Firma:</dt>
                  <dd className="text-black dark:text-zinc-100">{nazevFirmy ?? "—"}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Role:</dt>
                  <dd className="text-black dark:text-zinc-100">
                    {ROLE_POPIS[profil.role] ?? profil.role}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                Roli ti může změnit jen admin tvojí firmy.
              </p>
            </Sekce>
          )}
        </div>

        <div>
          <Sekce
            nadpis="Změna hesla"
            popis="Ptáme se i na současné heslo — samotné přihlášení na změnu nestačí, jinak by k převzetí účtu stačil cizí nezamčený počítač. Po změně se zruší všechna přihlášení a budeš se muset přihlásit znovu."
          >
            <FormularHesla />
          </Sekce>
        </div>
      </div>
    </div>
  );
}
