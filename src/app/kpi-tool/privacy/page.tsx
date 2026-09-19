import { LegalDraftNotice, Fill, Firma } from "@/components/LegalDraftNotice";

// Text odpovídá 10_concept/zasady_ochrany_osobnich_udaju_DRAFT.md — při změně upravit obojí.

const H = "mb-2 font-medium text-black dark:text-zinc-50";
const TH = "pb-2 pr-4 text-left font-medium text-black dark:text-zinc-50";
const TD = "border-t border-zinc-200 py-2 pr-4 align-top dark:border-zinc-800";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Zásady ochrany osobních údajů</h1>
      <LegalDraftNotice />

      <div className="flex flex-col gap-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <section>
          <h2 className={H}>1. Kdo jsme a v jaké roli</h2>
          <p>
            Provozovatelem služby KPI Tool na doméně padonyl.com je <Firma />,
            IČO <Fill>IČO</Fill>, se sídlem <Fill>sídlo</Fill>. Kontakt ve věcech
            ochrany osobních údajů: contact@padonyl.com.
          </p>
          <p className="mt-3">
            Vystupujeme ve dvou různých rolích a je důležité je nezaměňovat:
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Role</th>
                  <th className={TH}>Čeho se týká</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>Správce</td>
                  <td className={TD}>
                    údaje o uživatelích účtu — e-mail, jméno, přihlášení,
                    provozní záznamy
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Zpracovatel</td>
                  <td className={TD}>
                    data, která do Služby nahraje Zákazník
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            Jinak řečeno: o vašem účtu rozhodujeme my, o vašich datech vy.
            Nahraná data nepoužíváme k žádnému vlastnímu účelu.
          </p>
        </section>

        <section>
          <h2 className={H}>2. Jaké údaje zpracováváme jako správce</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-zinc-800 dark:text-zinc-200">
                Přihlašovací údaje:
              </strong>{" "}
              e-mail, volitelně jméno a příjmení, role ve firmě
            </li>
            <li>
              <strong className="text-zinc-800 dark:text-zinc-200">
                Provozní metadata:
              </strong>{" "}
              kdy se uživatel přihlásil, kdo nahrál který soubor, kdo změnil
              nastavení firmy
            </li>
            <li>
              <strong className="text-zinc-800 dark:text-zinc-200">
                Komunikace:
              </strong>{" "}
              obsah zpráv, které nám pošlete
            </li>
            <li>
              <strong className="text-zinc-800 dark:text-zinc-200">
                Anonymní návštěvnost webu:
              </strong>{" "}
              Vercel Web Analytics — agregovaná statistika bez cookies.
              Návštěvník je dočasně identifikován hashem odvozeným z požadavku,
              ne IP adresou; relace se zahazuje po 24 hodinách.
            </li>
          </ul>
          <p className="mt-2">
            Nezpracováváme platební údaje, údaje umožňující identifikovat
            konkrétní návštěvníky webu ani nic pro reklamní účely.
          </p>
        </section>

        <section>
          <h2 className={H}>3. Jaká data zpracováváme jako zpracovatel</h2>
          <p>
            Data, která nahrajete — typicky provozní exporty (tržby, dodávky,
            výroba). Většinou nejde o osobní údaje, ale mohou je obsahovat,
            jsou-li v souboru například jména obchodních zástupců nebo kontaktní
            osoby u odběratelů.
          </p>
          <p className="mt-2">
            Za to, jaké údaje nahrajete, a za právní základ jejich zpracování
            odpovídáte vy. My je zpracováváme výhradně podle vašich pokynů.
          </p>
        </section>

        <section>
          <h2 className={H}>4. Na základě čeho údaje zpracováváme</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>poskytování Služby a správa účtu — plnění smlouvy</li>
            <li>bezpečnostní záznamy a prevence zneužití — oprávněný zájem</li>
            <li>komunikace k vašemu účtu — plnění smlouvy</li>
            <li>plnění zákonných povinností — právní povinnost</li>
          </ul>
        </section>

        <section>
          <h2 className={H}>5. Jak dlouho údaje uchováváme</h2>
          <p>
            <strong className="text-zinc-800 dark:text-zinc-200">
              Údaje o účtu
            </strong>{" "}
            po dobu trvání smlouvy a 12 měsíců po jejím ukončení, abyste si
            stihli data vyexportovat. Poté se mažou.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">
              Nahraná data:
            </strong>{" "}
            vypočtené hodnoty KPI po dobu smlouvy; původní soubory po dobu,
            kterou si nastavíte u šablony; jednotlivé řádky jen tehdy, když to
            u šablony výslovně zapnete, a jen po nastavenou dobu.
          </p>
          <p className="mt-2">
            Po uplynutí se řádky i původní soubor automaticky a nevratně mažou.
            O každém mazání vedeme záznam. Mazání dat není zpoplatněno.
          </p>
        </section>

        <section>
          <h2 className={H}>6. Zvláštní kategorie osobních údajů</h2>
          <p>
            Ukazatele z kategorie „Lidé a růst“ (absence, pracovní úrazy) mohou
            vycházet ze souborů obsahujících údaje o zdravotním stavu. U takové
            šablony proto neukládáme jednotlivé řádky ani původní soubor
            a pracujeme jen s vypočteným souhrnem. Omezení je vynucené technicky
            a nelze je vypnout.
          </p>
        </section>

        <section>
          <h2 className={H}>7. Komu údaje předáváme</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Subdodavatel</th>
                  <th className={TH}>Role</th>
                  <th className={TH}>Umístění</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>Supabase</td>
                  <td className={TD}>databáze, přihlašování, úložiště souborů</td>
                  <td className={TD}>EU — Frankfurt</td>
                </tr>
                <tr>
                  <td className={TD}>Vercel</td>
                  <td className={TD}>hosting aplikace, anonymní analytika</td>
                  <td className={TD}>
                    <Fill>ověřit region</Fill>
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Resend</td>
                  <td className={TD}>odesílání transakčních e-mailů</td>
                  <td className={TD}>
                    <Fill>ověřit region</Fill>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            Jiným třetím stranám údaje nepředáváme. Neprodáváme je, nepronajímáme
            ani nepoužíváme k cílené reklamě.
          </p>
          <p className="mt-2">
            O zapojení nového subdodavatele informujeme alespoň 30 dní předem.
            Můžete proti změně vznést odůvodněnou námitku z důvodů ochrany
            údajů; nedojde-li k dohodě, můžete smlouvu ukončit bez sankce.
          </p>
        </section>

        <section>
          <h2 className={H}>8. Předání dat mimo EU/EHP</h2>
          <p>
            Nepředáváme. Data zpracováváme v Evropské unii. Pokud by se to
            změnilo, tato sekce se aktualizuje jako první a budete informováni
            předem.
          </p>
        </section>

        <section>
          <h2 className={H}>9. Vaše práva</h2>
          <p>
            Máte právo na přístup ke svým osobním údajům, jejich opravu, výmaz,
            omezení zpracování, přenositelnost, vznesení námitky proti
            zpracování na základě oprávněného zájmu, a podat stížnost u Úřadu
            pro ochranu osobních údajů (uoou.gov.cz).
          </p>
          <p className="mt-2">
            Jméno a e-mail si můžete zkontrolovat a opravit přímo ve Službě.
            Ostatní žádosti vyřizujeme na contact@padonyl.com bez zbytečného
            odkladu, nejpozději do jednoho měsíce.
          </p>
          <p className="mt-2">
            Týká-li se žádost dat nahraných Zákazníkem, obraťte se na Zákazníka
            — správcem těchto údajů je on, ne my. Poskytneme mu součinnost.
          </p>
        </section>

        <section>
          <h2 className={H}>10. Zabezpečení</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>šifrování při přenosu (HTTPS) i v uložení</li>
            <li>
              oddělení dat po firmách na úrovni databáze — firma A nemá
              technickou možnost dostat se k datům firmy B
            </li>
            <li>přístup k produkčním datům jen pro nezbytné provozní účely</li>
            <li>záznam o činnostech v účtu</li>
          </ul>
        </section>

        <section>
          <h2 className={H}>11. Oznámení porušení zabezpečení</h2>
          <p>
            Dojde-li k porušení zabezpečení osobních údajů, oznámíme to Úřadu
            pro ochranu osobních údajů do 72 hodin od zjištění, je-li to podle
            GDPR vyžadováno, a bez zbytečného odkladu informujeme dotčené
            Zákazníky.
          </p>
        </section>

        <section>
          <h2 className={H}>12. Záznam o činnostech v účtu</h2>
          <p>
            Vedeme záznam o podstatných úkonech (nahrání dat, změna nastavení
            firmy, změna rolí, schválení přístupu). Slouží k dohledatelnosti
            a k řešení sporů o to, kdo co udělal. U změn firemních údajů
            zaznamenáváme, která pole se změnila, ne jejich obsah.
          </p>
        </section>

        <section>
          <h2 className={H}>13. Srovnání napříč firmami</h2>
          <p>
            Připravujeme funkci srovnání s ostatními firmami. Zatím není
            součástí Služby. Až bude, budou do srovnání vstupovat výhradně
            agregované poměrové ukazatele, nikdy hrubé částky ani jednotlivé
            řádky; srovnání se nezobrazí, není-li ve skupině dostatečný počet
            firem; a zapojení bude dobrovolné. Do té doby se k tomuto účelu
            žádná data nepoužívají.
          </p>
        </section>

        <section>
          <h2 className={H}>14. Cookies</h2>
          <p>
            Používáme pouze technické cookies nutné pro přihlášení. Marketingové
            ani analytické cookies třetích stran nepoužíváme. Analytika
            návštěvnosti funguje bez cookies a nesbírá údaje umožňující
            identifikovat konkrétní osobu — proto Služba nepotřebuje cookie
            lištu.
          </p>
        </section>

        <section>
          <h2 className={H}>15. Děti</h2>
          <p>
            Služba je určena podnikatelům a jejich zaměstnancům. Není určena
            osobám mladším 18 let a účty jim nezakládáme.
          </p>
        </section>

        <section>
          <h2 className={H}>16. Zpřístupnění na základě zákona</h2>
          <p>
            Údaje zpřístupníme třetí straně bez souhlasu Zákazníka pouze tehdy,
            vyžaduje-li to zákon nebo rozhodnutí soudu či jiného orgánu veřejné
            moci. Je-li to právně možné, Zákazníka o tom předem informujeme.
          </p>
        </section>

        <section>
          <h2 className={H}>17. Změny těchto zásad</h2>
          <p>
            O podstatné změně budeme informovat e-mailem alespoň 30 dní před
            účinností.
          </p>
        </section>
      </div>
    </div>
  );
}
