import { LegalDraftNotice, Fill } from "@/components/LegalDraftNotice";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">
        Zásady ochrany osobních údajů
      </h1>
      <LegalDraftNotice />

      <div className="flex flex-col gap-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            1. Kdo je správcem osobních údajů
          </h2>
          <p>
            Správcem je <Fill>jméno/IČO/sídlo poskytovatele</Fill>,
            provozovatel Služby KPI Tool na doméně padonyl.com. Kontakt pro
            otázky ohledně ochrany osobních údajů: <Fill>e-mail</Fill>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            2. Jaké osobní údaje zpracováváme
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-black dark:text-zinc-50">
                Přihlašovací údaje:
              </strong>{" "}
              e-mail, volitelně jméno a příjmení
            </li>
            <li>
              <strong className="text-black dark:text-zinc-50">
                Provozní metadata:
              </strong>{" "}
              kdy se uživatel přihlásil, kdo nahrál který soubor
            </li>
            <li>
              <strong className="text-black dark:text-zinc-50">
                Neukládáme:
              </strong>{" "}
              platební údaje, údaje o návštěvnosti/chování — žádná analytika
              zatím není zapojená
            </li>
          </ul>
          <p className="mt-2">
            Appka ukládá i firemní provozní data nahraná Zákazníkem (tržby,
            KPI, dodávky) — ta sama o sobě obvykle nejsou osobní údaje, pokud
            je Zákazník sám neobohatí o jména konkrétních osob.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            3. Proč a na základě čeho údaje zpracováváme
          </h2>
          <p>
            Plnění smlouvy — přihlašovací údaje jsou nutné pro poskytnutí
            Služby. Oprávněný zájem — bezpečnostní logy, prevence zneužití.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            4. Jak dlouho údaje uchováváme
          </h2>
          <p>
            Po dobu trvání smluvního vztahu. Po ukončení export dat do{" "}
            <strong className="text-black dark:text-zinc-50">30 dní</strong>,
            poté smazání.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            5. Komu údaje předáváme (subdodavatelé)
          </h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-1.5 pr-4 font-medium text-black dark:text-zinc-50">
                  Subdodavatel
                </th>
                <th className="py-1.5 pr-4 font-medium text-black dark:text-zinc-50">
                  Role
                </th>
                <th className="py-1.5 font-medium text-black dark:text-zinc-50">
                  Umístění dat
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-4">Supabase</td>
                <td className="py-1.5 pr-4">
                  Databáze, autentizace, úložiště souborů
                </td>
                <td className="py-1.5">EU region (Frankfurt)</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4">Vercel</td>
                <td className="py-1.5 pr-4">Hosting webové aplikace</td>
                <td className="py-1.5">
                  <Fill>ověřit region při nasazení</Fill>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2">
            Data nepředáváme mimo EU/EHP, pokud výše uvedení subdodavatelé
            sami negarantují jinak.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            6. Práva subjektu údajů
          </h2>
          <p>Každý uživatel má právo na:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>přístup ke svým osobním údajům</li>
            <li>opravu nepřesných údajů</li>
            <li>výmaz („právo být zapomenut“)</li>
            <li>omezení zpracování</li>
            <li>přenositelnost údajů</li>
            <li>vznesení námitky</li>
            <li>
              podání stížnosti u Úřadu pro ochranu osobních údajů (uoou.cz)
            </li>
          </ul>
          <p className="mt-2">
            Žádosti lze zaslat na <Fill>kontaktní e-mail</Fill>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            7. Zabezpečení
          </h2>
          <p>
            Údaje jsou šifrované při přenosu (HTTPS) i v klidu. Přístup k
            datům je omezen na úroveň jednotlivé firmy (row-level security) —
            firma A nemá technickou možnost vidět data firmy B.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            8. Cookies
          </h2>
          <p>
            Appka používá pouze technické cookies nutné pro přihlášení.
            Nepoužívá marketingové ani analytické cookies třetích stran.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            9. Oznámení úniku dat
          </h2>
          <p>
            V případě bezpečnostního incidentu ohrožujícího osobní údaje
            bude Poskytovatel postupovat podle GDPR (oznámení ÚOOÚ do 72
            hodin od zjištění, informování dotčených Zákazníků).
          </p>
        </section>
      </div>
    </div>
  );
}
