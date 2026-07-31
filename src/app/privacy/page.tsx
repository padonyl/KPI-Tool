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
            Správcem je <Fill>obchodní firma s.r.o. / IČO / sídlo poskytovatele</Fill>,
            provozovatel Služby KPI Tool na doméně padonyl.com. Kontakt pro
            otázky ohledně ochrany osobních údajů: contact@padonyl.com.
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
              platební údaje, žádné údaje umožňující identifikovat konkrétní
              návštěvníky webu
            </li>
            <li>
              <strong className="text-black dark:text-zinc-50">
                Anonymní návštěvnost webu:
              </strong>{" "}
              Vercel Web Analytics — agregovaná statistika zobrazení stránek
              (bez cookies). Návštěvník je dočasně identifikován hashem
              odvozeným z requestu, ne IP adresou; tato relace se automaticky
              zahazuje po 24 hodinách a s žádnou konkrétní osobou se nepojí.
            </li>
          </ul>
          <p className="mt-2">
            Aplikace ukládá i firemní provozní data nahraná Zákazníkem (tržby,
            KPI, dodávky) — ta sama o sobě obvykle nejsou osobní údaje, pokud
            je Zákazník sám neobohatí o jména konkrétních osob.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            3. Jak údaje používáme
          </h2>
          <p>
            Výhradně k provozu Služby (přihlášení, výpočet a zobrazení KPI,
            komunikace se zákazníkem ohledně účtu), k zajištění bezpečnosti a
            ke sledování anonymní návštěvnosti webu (viz bod 2 a 12).{" "}
            <strong className="text-black dark:text-zinc-50">
              Nepoužíváme je k cílené reklamě ani je neprodáváme třetím
              stranám
            </strong>{" "}
            — aplikace nemá žádnou reklamní integraci ani analytiku, která by
            sledovala konkrétní osoby.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            4. Na základě čeho údaje zpracováváme
          </h2>
          <p>
            Plnění smlouvy — přihlašovací údaje jsou nutné pro poskytnutí
            Služby. Oprávněný zájem — bezpečnostní logy, prevence zneužití.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            5. Jak dlouho údaje uchováváme
          </h2>
          <p>
            Po dobu trvání smluvního vztahu. Po ukončení export dat do{" "}
            <strong className="text-black dark:text-zinc-50">
              12 měsíců
            </strong>
            , poté smazání.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            6. Komu údaje předáváme (subdodavatelé)
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
                <td className="py-1.5 pr-4">
                  Hosting webové aplikace + anonymní analytika návštěvnosti
                  (Web Analytics)
                </td>
                <td className="py-1.5">
                  <Fill>ověřit region při nasazení</Fill>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            7. Předání dat mimo EU/EHP
          </h2>
          <p>
            Nepředáváme. Všichni výše uvedení subdodavatelé zpracovávají data
            v EU regionu — pokud se to v budoucnu změní, tato sekce se
            aktualizuje jako první.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            8. Práva subjektu údajů
          </h2>
          <p>
            Každý uživatel má právo na přístup ke svým osobním údajům, jejich
            opravu, výmaz („právo být zapomenut“), omezení zpracování,
            přenositelnost, vznesení námitky a podání stížnosti u Úřadu pro
            ochranu osobních údajů (uoou.cz).
          </p>
          <p className="mt-2">
            Základní úkony (kontrola a oprava jména/e-mailu) jde provést
            přímo v aplikaci; výmaz nebo cokoliv nad rámec toho na žádost
            zaslanou na contact@padonyl.com.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            9. Ochrana dětí
          </h2>
          <p>
            Služba je určena firmám a jejich zaměstnancům, ne dětem —
            registrace je určena osobám starším 18 let.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            10. Zákonná povinnost zpřístupnit údaje
          </h2>
          <p>
            Údaje zpřístupníme třetí straně bez souhlasu Zákazníka pouze
            tehdy, vyžaduje-li to zákon nebo rozhodnutí soudu/orgánu veřejné
            moci.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            11. Zabezpečení
          </h2>
          <p>
            Údaje jsou šifrované při přenosu (HTTPS) i v klidu. Přístup k
            datům je omezen na úroveň jednotlivé firmy (row-level security) —
            firma A nemá technickou možnost vidět data firmy B.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            12. Cookies a anonymní analytika
          </h2>
          <p>
            Aplikace používá pouze technické cookies nutné pro přihlášení.
            Nepoužívá marketingové ani analytické cookies třetích stran.
          </p>
          <p className="mt-2">
            Pro sledování návštěvnosti webu (kolik lidí a jaké stránky
            navštíví) používáme <strong className="text-black dark:text-zinc-50">Vercel Web Analytics</strong> —
            nástroj, který funguje bez cookies a nesbírá údaje umožňující
            identifikovat konkrétní osobu. Aplikace proto nepotřebuje cookie
            lištu ani zvláštní souhlas s touto analytikou.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            13. Oznámení úniku dat
          </h2>
          <p>
            V případě bezpečnostního incidentu ohrožujícího osobní údaje
            budeme postupovat podle GDPR (oznámení ÚOOÚ do 72 hodin od
            zjištění, informování dotčených Zákazníků).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            14. Změny těchto zásad
          </h2>
          <p>
            O podstatné změně budeme informovat e-mailem s předstihem
            alespoň 30 dní před účinností.
          </p>
        </section>
      </div>
    </div>
  );
}
