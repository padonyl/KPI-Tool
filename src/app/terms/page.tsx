import { LegalDraftNotice, Fill } from "@/components/LegalDraftNotice";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Obchodní podmínky</h1>
      <LegalDraftNotice />

      <div className="flex flex-col gap-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            1. Úvodní ustanovení
          </h2>
          <p>
            Tyto obchodní podmínky upravují vzájemná práva a povinnosti mezi
            poskytovatelem služby KPI Tool (dále jen „Poskytovatel“) a firmou,
            která službu využívá (dále jen „Zákazník“).
          </p>
          <p className="mt-2">
            Poskytovatel: <Fill>jméno a příjmení / IČO / sídlo</Fill>, kontakt:{" "}
            <Fill>e-mail</Fill>. Službou se rozumí webová aplikace dostupná na
            doméně padonyl.com.
          </p>
          <p className="mt-2">
            Registrací nebo použitím Služby s těmito podmínkami souhlasíte.
            Pokud tak činíte jménem firmy, potvrzujete, že k tomu máte
            oprávnění.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            2. Popis služby
          </h2>
          <p>
            Služba umožňuje Zákazníkovi nahrávat provozní data (exporty z ERP,
            tabulky) a na jejich základě sledovat klíčové ukazatele výkonnosti
            (KPI) v čase.
          </p>
          <p className="mt-2">
            Služba je v aktivním vývoji (MVP fáze). Poskytovatel negarantuje
            bezchybnost výpočtů ani nepřetržitou dostupnost. Správnost
            vstupních dat je odpovědností Zákazníka — Poskytovatel odpovídá za
            správný výpočet KPI z dat tak, jak byla nahrána, ne za jejich
            věcnou správnost.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            3. Účet a přístup
          </h2>
          <p>
            Pro použití Služby je nutná registrace a založení firemního účtu.
            Zákazník odpovídá za zabezpečení přístupových údajů svých
            uživatelů a za to, kdo v rámci jeho firmy k účtu přistupuje.
            Zákazník může v rámci svého účtu spravovat role dalších uživatelů
            (admin/superuser/uživatel) — za správné nastavení oprávnění
            odpovídá Zákazník.
          </p>
          <p className="mt-2">
            Poskytovatel může k účtu Zákazníka přistoupit výhradně za účelem
            technické podpory nebo řešení chyby, ne z jiného důvodu.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            4. Obsah a duševní vlastnictví
          </h2>
          <p>
            Software, design a veškerý obsah Služby jsou vlastnictvím
            Poskytovatele. Data, která Zákazník do Služby nahraje, zůstávají
            vlastnictvím Zákazníka — Poskytovatel je zpracovává výhradně za
            účelem poskytování Služby.
          </p>
          <p className="mt-2">
            Zákazník odpovídá za to, že nahraná data smí legálně poskytnout a
            že jejich obsahem neporušuje práva třetích osob.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            5. Povinnosti Zákazníka
          </h2>
          <p>
            Zákazník se zavazuje Službu nepoužívat k nezákonným účelům,
            nepokoušet se o neoprávněný přístup k datům jiných firem a bez
            zbytečného odkladu nahlásit Poskytovateli jakoukoliv zjištěnou
            bezpečnostní chybu nebo zneužití účtu.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            6. Licence k užívání
          </h2>
          <p>
            Poskytovatel uděluje Zákazníkovi po dobu trvání smlouvy omezenou,
            nepřevoditelnou licenci k užívání Služby výhradně pro vlastní
            vnitřní potřebu. Zpětné inženýrství, kopírování nebo další prodej
            Služby nejsou dovoleny.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            7. Cena a platba
          </h2>
          <p>
            V pilotní fázi je Služba poskytována zdarma, po dobu a za podmínek
            individuálně dohodnutých se Zákazníkem. Po skončení pilotní fáze
            se cena řídí aktuálně platným ceníkem Poskytovatele.{" "}
            <Fill>ceník zatím neexistuje</Fill>
          </p>
          <p className="mt-2">
            O zvýšení ceny bude Zákazník informován s předstihem alespoň 30
            dní před účinností.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            8. Doba trvání a ukončení
          </h2>
          <p>
            Zákazník může kdykoliv ukončit používání Služby. Poskytovatel
            může ukončit poskytování Služby s přiměřenou výpovědní lhůtou, s
            výjimkou závažného porušení podmínek, kdy může ukončit okamžitě.
          </p>
          <p className="mt-2">
            Po ukončení má Zákazník právo na export svých dat po dobu{" "}
            <strong className="text-black dark:text-zinc-50">12 měsíců</strong>{" "}
            od ukončení, poté budou data trvale smazána.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            9. Odpovědnost
          </h2>
          <p>
            Poskytovatel neodpovídá za škodu vzniklou nesprávným vstupem dat
            ze strany Zákazníka. V rané fázi produktu Poskytovatel
            neposkytuje žádnou záruku nepřetržité dostupnosti (SLA). Celková
            odpovědnost Poskytovatele za škodu je omezena na výši částky, kterou
            Zákazník za Službu skutečně zaplatil za posledních 12 měsíců.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            10. Odškodnění
          </h2>
          <p>
            Zákazník odpovídá Poskytovateli za škodu vzniklou z toho, že data
            nahraná Zákazníkem porušují práva třetí osoby nebo platné
            právní předpisy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            11. Postoupení práv
          </h2>
          <p>
            Zákazník nesmí svá práva a povinnosti z těchto podmínek postoupit
            třetí straně bez souhlasu Poskytovatele. Poskytovatel může
            podmínky postoupit v souvislosti s převodem svého podnikání.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            12. Ochrana osobních údajů
          </h2>
          <p>
            Zpracování osobních údajů se řídí samostatnými{" "}
            <a href="/privacy" className="underline">
              Zásadami ochrany osobních údajů
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            13. Změna podmínek
          </h2>
          <p>
            Poskytovatel může tyto podmínky změnit, o změně informuje
            Zákazníka s předstihem alespoň 30 dní před účinností.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-black dark:text-zinc-50">
            14. Závěrečná ustanovení
          </h2>
          <p>
            Tyto podmínky se řídí právním řádem České republiky. Případné
            spory řeší věcně a místně příslušné soudy České republiky. Je-li
            některé ustanovení neplatné, nemá to vliv na platnost ostatních.
          </p>
        </section>
      </div>
    </div>
  );
}
