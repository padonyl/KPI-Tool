import { LegalDraftNotice, Fill, Firma } from "@/components/LegalDraftNotice";

// Text odpovídá 10_concept/obchodni_podminky_DRAFT.md — při změně upravit obojí.
// Rozsah úmyslně zůstává úzký (max-w-2xl): souvislý text se čte nejlíp
// na 60–75 znacích na řádek, viz komentář v ui-classes.ts.

const H = "mb-2 font-medium text-black dark:text-zinc-50";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Obchodní podmínky</h1>
      <LegalDraftNotice />

      <div className="flex flex-col gap-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <section>
          <h2 className={H}>1. Úvodní ustanovení</h2>
          <p>
            Tyto obchodní podmínky upravují vzájemná práva a povinnosti mezi
            Poskytovatelem a Zákazníkem při užívání služby KPI Tool.
          </p>
          <p className="mt-2">
            Poskytovatelem je <Firma />, IČO <Fill>IČO</Fill>, se sídlem{" "}
            <Fill>sídlo</Fill>, zapsaná v obchodním rejstříku vedeném{" "}
            <Fill>soud a spisová značka</Fill>. Kontakt: contact@padonyl.com.
          </p>
          <p className="mt-2">
            Zákazníkem je podnikatel, který Službu užívá.{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              Služba není určena spotřebitelům.
            </strong>{" "}
            Službou se rozumí webová aplikace na doméně padonyl.com.
          </p>
          <p className="mt-2">
            Registrací nebo užíváním Služby s těmito podmínkami souhlasíte.
            Činíte-li tak jménem firmy, potvrzujete, že jste k tomu oprávněni.
            Podmínky se vztahují i na uživatele, které do účtu přizvete.
          </p>
        </section>

        <section>
          <h2 className={H}>2. Popis služby a nakládání s daty</h2>
          <p>
            Služba umožňuje nahrávat provozní data (exporty z ERP, tabulky CSV
            a Excel) a na jejich základě sledovat klíčové ukazatele výkonnosti
            v čase. Je v aktivním vývoji — negarantujeme bezchybnost výpočtů
            ani nepřetržitou dostupnost.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">
              Za správnost vstupních dat odpovídá Zákazník.
            </strong>{" "}
            Odpovídáme za správný výpočet z dat tak, jak byla nahrána — ne za
            jejich věcnou správnost ani za rozhodnutí přijatá na jejich základě.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">
              Uchování souborů a řádků.
            </strong>{" "}
            Nahraný soubor ukládáme, aby šlo výpočet zpětně ověřit. Jednotlivé
            řádky souboru ukládáme jen u šablony, kde to Zákazník výslovně
            zapne — ve výchozím stavu je to vypnuté.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">
              Doba uchování.
            </strong>{" "}
            Dobu si Zákazník nastavuje sám u každé šablony. Po jejím uplynutí se
            řádky i původní soubor automaticky a nevratně mažou; o mazání vedeme
            záznam. Vypočtené hodnoty KPI zůstávají — bez nich by zmizela
            historie ukazatelů.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">
              Ukazatele o lidech.
            </strong>{" "}
            U šablony s ukazateli z kategorie „Lidé a růst“ (absence, pracovní
            úrazy) neukládáme jednotlivé řádky ani původní soubor a pracujeme
            jen s vypočteným souhrnem. Takové soubory mohou obsahovat údaje
            o zdravotním stavu. Omezení je vynucené technicky a nelze je vypnout.
          </p>
          <p className="mt-2">
            Mazání dat není zpoplatněno a nikdy nebude.
          </p>
        </section>

        <section>
          <h2 className={H}>3. Účet, uživatelé a přístup</h2>
          <p>
            K užívání Služby je nutná registrace a firemní účet. Zákazník
            odpovídá za zabezpečení přístupových údajů, za to, kdo k účtu
            přistupuje, a za nastavení rolí svých uživatelů.
          </p>
          <p className="mt-2">
            K účtu Zákazníka můžeme přistoupit výhradně kvůli technické podpoře,
            řešení chyby nebo splnění zákonné povinnosti.
          </p>
          <p className="mt-2">
            Nově registrovaná firma získá přístup k datům až po schválení
            Poskytovatelem. Přístup uživatele nebo celé firmy můžeme pozastavit
            či zrušit, zejména při porušení podmínek, podezření na zneužití nebo
            ohrožení provozu Služby.
          </p>
        </section>

        <section>
          <h2 className={H}>4. Duševní vlastnictví a data</h2>
          <p>
            Software, design a katalog ukazatelů jsou vlastnictvím Poskytovatele.
            Data nahraná Zákazníkem zůstávají jeho vlastnictvím — zpracováváme je
            výhradně kvůli poskytování Služby.
          </p>
          <p className="mt-2">
            Zákazník odpovídá za to, že data smí poskytnout, že jejich obsahem
            neporušuje práva třetích osob, a že má právní základ pro zpracování
            osobních údajů, které v nich případně jsou.
          </p>
          <p className="mt-2">
            Poskytne-li Zákazník návrh nebo připomínku k Službě, můžeme je
            bezúplatně použít k jejímu rozvoji.
          </p>
        </section>

        <section>
          <h2 className={H}>5. Povinnosti Zákazníka</h2>
          <p>
            Zákazník se zavazuje Službu neužívat k nezákonným účelům,
            nepokoušet se o neoprávněný přístup k datům jiných firem ani
            o obcházení bezpečnostních opatření, nezatěžovat Službu způsobem
            ohrožujícím její provoz, a bez zbytečného odkladu nahlásit každou
            zjištěnou bezpečnostní chybu nebo zneužití účtu.
          </p>
        </section>

        <section>
          <h2 className={H}>6. Licence k užívání</h2>
          <p>
            Po dobu trvání smlouvy udělujeme Zákazníkovi nevýhradní,
            nepřevoditelnou licenci k užívání Služby pro vlastní vnitřní
            potřebu. Zpětné inženýrství, kopírování, pronájem ani další prodej
            nejsou dovoleny.
          </p>
        </section>

        <section>
          <h2 className={H}>7. Cena a platba</h2>
          <p>
            V pilotní fázi je Služba poskytována bezplatně, po dobu a za
            podmínek individuálně dohodnutých. Po jejím skončení se cena řídí
            aktuálním ceníkem: <Fill>ceník zatím není rozhodnutý</Fill>
          </p>
          <p className="mt-2">
            O zvýšení ceny informujeme alespoň 30 dní předem. Nesouhlasí-li
            Zákazník, může smlouvu k datu účinnosti změny ukončit.
          </p>
        </section>

        <section>
          <h2 className={H}>8. Srovnání napříč firmami</h2>
          <p>
            Připravujeme funkci, která umožní porovnat vlastní ukazatele
            s ostatními firmami.{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              Zatím není součástí Služby
            </strong>{" "}
            — ustanovení sjednáváme předem, aby bylo zřejmé, za jakých podmínek
            by k takovému zpracování mohlo dojít.
          </p>
          <p className="mt-2">
            Do srovnání by vstupovaly výhradně agregované a poměrové ukazatele,
            nikdy hrubé částky, jednotlivé řádky ani údaje umožňující
            identifikovat konkrétní firmu. Srovnání se zobrazí jen tehdy, je-li
            ve skupině dostatečný počet firem. Zapojení je dobrovolné a lze je
            kdykoliv odmítnout bez ztráty přístupu k ostatním funkcím.
          </p>
        </section>

        <section>
          <h2 className={H}>9. Dostupnost, ukončení a pozastavení</h2>
          <p>
            Zákazník může užívání kdykoliv ukončit. Poskytovatel může ukončit
            s výpovědní lhůtou 30 dní, při závažném porušení podmínek okamžitě.
          </p>
          <p className="mt-2">
            Po ukončení má Zákazník právo na export svých dat po dobu 12 měsíců,
            poté data trvale smažeme. O smazání lze požádat i dříve.
          </p>
          <p className="mt-2">
            Službu můžeme dočasně pozastavit kvůli údržbě, bezpečnostnímu
            incidentu nebo jednání ohrožujícímu provoz. O plánované odstávce
            informujeme předem, je-li to možné.
          </p>
        </section>

        <section>
          <h2 className={H}>10. Odpovědnost</h2>
          <p>
            Neodpovídáme za škodu vzniklou nesprávným vstupem dat ani za
            rozhodnutí přijatá na základě výstupů Služby. Službu poskytujeme
            „tak, jak je“, bez záruky dostupnosti (SLA) a bez záruky vhodnosti
            pro konkrétní účel Zákazníka.
          </p>
          <p className="mt-2">
            Celková odpovědnost za škodu je omezena částkou, kterou Zákazník za
            Službu skutečně zaplatil za posledních 12 měsíců předcházejících
            vzniku škody — v pilotní fázi tedy nulou. Neodpovídáme za nepřímou
            škodu, ušlý zisk ani následné škody.
          </p>
          <p className="mt-2">
            Tato omezení se nepoužijí v rozsahu, v jakém to právní předpisy
            nedovolují, zejména u škody způsobené úmyslně nebo z hrubé
            nedbalosti a u újmy na zdraví.
          </p>
        </section>

        <section>
          <h2 className={H}>11. Odškodnění</h2>
          <p>
            Zákazník nahradí Poskytovateli škodu vzniklou z toho, že nahraná
            data porušují práva třetí osoby nebo právní předpisy, nebo že
            Zákazník neměl právní základ pro zpracování osobních údajů v nich
            obsažených.
          </p>
        </section>

        <section>
          <h2 className={H}>12. Vyšší moc</h2>
          <p>
            Neodpovídáme za nesplnění povinností způsobené okolnostmi mimo naši
            kontrolu — výpadkem subdodavatele, poruchou datového centra,
            kybernetickým útokem, výpadkem elektřiny či konektivity, přírodní
            událostí nebo zásahem orgánu veřejné moci.
          </p>
        </section>

        <section>
          <h2 className={H}>13. Ochrana osobních údajů</h2>
          <p>
            U údajů o uživatelích účtu vystupujeme jako správce — viz Zásady
            ochrany osobních údajů. U dat, která Zákazník nahraje, vystupujeme
            jako zpracovatel a Zákazník jako správce; podmínky upravuje
            Zpracovatelská smlouva, která tvoří nedílnou součást těchto podmínek.
          </p>
        </section>

        <section>
          <h2 className={H}>14. Postoupení práv</h2>
          <p>
            Zákazník nesmí svá práva a povinnosti postoupit bez našeho souhlasu.
            Poskytovatel může podmínky postoupit v souvislosti s převodem svého
            podniku nebo jeho části; o postoupení Zákazníka informuje.
          </p>
        </section>

        <section>
          <h2 className={H}>15. Změna podmínek</h2>
          <p>
            Podmínky můžeme změnit; o změně informujeme alespoň 30 dní před
            účinností. Nesouhlasí-li Zákazník, může smlouvu k datu účinnosti
            ukončit. Pokračováním v užívání Služby změnu přijímá.
          </p>
        </section>

        <section>
          <h2 className={H}>16. Závěrečná ustanovení</h2>
          <p>
            Podmínky se řídí právním řádem České republiky, zejména zákonem
            č. 89/2012 Sb., občanský zákoník. Spory řeší soudy České republiky
            podle sídla Poskytovatele.
          </p>
          <p className="mt-2">
            Je-li některé ustanovení neplatné, nemá to vliv na platnost
            ostatních. Podmínky nabývají účinnosti dne <Fill>datum</Fill>.
          </p>
        </section>
      </div>
    </div>
  );
}
