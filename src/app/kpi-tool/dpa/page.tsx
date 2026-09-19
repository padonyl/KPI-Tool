import { LegalDraftNotice, Fill, Firma } from "@/components/LegalDraftNotice";

// Text odpovídá 10_concept/zpracovatelska_smlouva_DPA_DRAFT.md — při změně upravit obojí.
//
// PROČ TAHLE STRÁNKA VZNIKLA: ukládáním syrových řádků (migrace 0016) se
// z nás stal zpracovatel osobních údajů zákazníka. Čl. 28 odst. 3 GDPR na to
// vyžaduje písemnou smlouvu s přesně vymezeným obsahem — bez ní je zpracování
// v rozporu s nařízením na obou stranách.

const H = "mb-2 font-medium text-black dark:text-zinc-50";
const TH = "pb-2 pr-4 text-left font-medium text-black dark:text-zinc-50";
const TD = "border-t border-zinc-200 py-2 pr-4 align-top dark:border-zinc-800";

export default function DpaPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Zpracovatelská smlouva</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Podmínky zpracování osobních údajů podle čl. 28 GDPR
      </p>
      <LegalDraftNotice />

      <div className="flex flex-col gap-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <section>
          <p>
            Tato smlouva tvoří nedílnou součást Obchodních podmínek a uzavírá se
            jejich přijetím. Vztahuje se výhradně na osobní údaje, které
            Zákazník do Služby nahraje — ne na údaje o uživatelích účtu, u nichž
            jsme sami správcem.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">Správce:</strong>{" "}
            Zákazník užívající Službu KPI Tool.{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              Zpracovatel:
            </strong>{" "}
            <Firma />, IČO <Fill>IČO</Fill>, se sídlem <Fill>sídlo</Fill>.
          </p>
        </section>

        <section>
          <h2 className={H}>1. Předmět, povaha, účel a doba zpracování</h2>
          <p>
            <strong className="text-zinc-800 dark:text-zinc-200">
              Předmět a povaha:
            </strong>{" "}
            ukládání, výpočet a zobrazení ukazatelů z dat, která Správce nahraje,
            včetně volitelného uchování jednotlivých řádků pro zobrazení detailu.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">Účel:</strong>{" "}
            výhradně poskytování Služby. K žádnému vlastnímu účelu Zpracovatele
            se údaje nepoužívají.
          </p>
          <p className="mt-2">
            <strong className="text-zinc-800 dark:text-zinc-200">Doba:</strong>{" "}
            po dobu trvání smluvního vztahu a dále podle čl. 8. Typ údajů
            a kategorie subjektů viz Příloha 1.
          </p>
        </section>

        <section>
          <h2 className={H}>2. Pokyny Správce</h2>
          <p>
            Osobní údaje zpracováváme výhradně na základě doložených pokynů
            Správce. Pokynem se rozumí tato smlouva, Obchodní podmínky
            a nastavení, která Správce ve Službě provede — zejména zapnutí
            ukládání řádků a nastavení doby uchování.
          </p>
          <p className="mt-2">
            Máme-li za to, že pokyn porušuje GDPR nebo jiný předpis, Správce
            o tom neprodleně informujeme.
          </p>
        </section>

        <section>
          <h2 className={H}>3. Mlčenlivost</h2>
          <p>
            Osoby oprávněné zpracovávat osobní údaje jsou zavázány mlčenlivostí
            a poučeny o povinnostech při ochraně osobních údajů. Závazek trvá
            i po skončení jejich spolupráce se Zpracovatelem.
          </p>
        </section>

        <section>
          <h2 className={H}>4. Zabezpečení</h2>
          <p>
            Přijali jsme technická a organizační opatření podle čl. 32 GDPR —
            přehled je v Příloze 2. Opatření můžeme měnit, nesmíme však snížit
            celkovou úroveň zabezpečení.
          </p>
        </section>

        <section>
          <h2 className={H}>5. Další zpracovatelé</h2>
          <p>
            Správce nám uděluje obecné povolení zapojit další zpracovatele;
            aktuální seznam je v Příloze 3. O zamýšlené změně informujeme
            alespoň 30 dní předem.
          </p>
          <p className="mt-2">
            Správce může vznést odůvodněnou námitku z důvodů ochrany osobních
            údajů. Nedojde-li k dohodě, může smlouvu ukončit bez sankce ke dni,
            kdy má změna nabýt účinnosti.
          </p>
          <p className="mt-2">
            Dalšímu zpracovateli ukládáme stejné povinnosti jako v této smlouvě
            a odpovídáme Správci za plnění jejich povinností.
          </p>
        </section>

        <section>
          <h2 className={H}>6. Součinnost při právech subjektů údajů</h2>
          <p>
            Poskytneme Správci přiměřenou součinnost při vyřizování žádostí
            subjektů údajů. Řadu úkonů může Správce provést sám přímo ve Službě
            — zobrazit, exportovat a smazat nahraná data.
          </p>
          <p className="mt-2">
            Obrátí-li se subjekt údajů přímo na nás, žádost nevyřizujeme a bez
            zbytečného odkladu ji předáme Správci.
          </p>
        </section>

        <section>
          <h2 className={H}>7. Součinnost při dalších povinnostech</h2>
          <p>
            <strong className="text-zinc-800 dark:text-zinc-200">
              Porušení zabezpečení
            </strong>{" "}
            ohlásíme Správci bez zbytečného odkladu, nejpozději do 72 hodin od
            okamžiku, kdy se o něm dozvíme, a poskytneme informace potřebné
            k ohlášení dozorovému úřadu. Dozorovému úřadu neohlašujeme za
            Správce.
          </p>
          <p className="mt-2">
            Poskytneme součinnost při posouzení vlivu na ochranu osobních údajů
            (DPIA) a při případné předchozí konzultaci s dozorovým úřadem —
            v rozsahu odpovídajícím povaze zpracování.
          </p>
        </section>

        <section>
          <h2 className={H}>8. Výmaz a vrácení údajů</h2>
          <p>
            Po ukončení Služby má Správce 12 měsíců na export dat. Po uplynutí
            této doby osobní údaje trvale smažeme, ledaže nám jejich uchování
            ukládá právo EU nebo členského státu. O smazání lze požádat kdykoliv
            dříve.
          </p>
          <p className="mt-2">
            Nezávisle na ukončení smlouvy se jednotlivé řádky a původní soubory
            mažou automaticky po uplynutí doby uchování nastavené Správcem;
            o proběhlém mazání vedeme záznam. Mazání údajů není zpoplatněno.
          </p>
        </section>

        <section>
          <h2 className={H}>9. Doložení souladu a audit</h2>
          <p>
            Poskytneme Správci informace potřebné k doložení splnění povinností
            podle čl. 28 GDPR. Správce je oprávněn provést audit nejvýše jednou
            za 12 měsíců, po oznámení alespoň 30 dní předem, v pracovní době
            a způsobem, který nenaruší provoz Služby.
          </p>
          <p className="mt-2">
            Častěji jen při důvodném podezření na porušení nebo uloží-li to
            dozorový úřad. Náklady nese Správce, ledaže audit prokáže podstatné
            porušení našich povinností. Auditem nesmí být dotčena důvěrnost
            údajů jiných zákazníků.
          </p>
        </section>

        <section>
          <h2 className={H}>10. Předání mimo EU/EHP</h2>
          <p>
            Osobní údaje nepředáváme mimo Evropskou unii ani Evropský
            hospodářský prostor. Změní-li se to, informujeme Správce předem
            a zajistíme odpovídající záruky podle kapitoly V GDPR.
          </p>
        </section>

        <section>
          <h2 className={H}>11. Odpovědnost a závěrečná ustanovení</h2>
          <p>
            Odpovědnost Zpracovatele se řídí Obchodními podmínkami včetně
            omezení výše náhrady škody. Tím není dotčena odpovědnost podle
            čl. 82 GDPR vůči subjektům údajů.
          </p>
          <p className="mt-2">
            Smlouva se řídí právním řádem České republiky. V rozsahu, v jakém je
            v rozporu s Obchodními podmínkami, má ve věcech ochrany osobních
            údajů přednost tato smlouva.
          </p>
        </section>

        <section>
          <h2 className={H}>Příloha 1 — Podrobnosti o zpracování</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={TD}>Předmět</td>
                  <td className={TD}>
                    ukládání, výpočet a zobrazení ukazatelů z nahraných dat
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Povaha</td>
                  <td className={TD}>
                    shromažďování, ukládání, strukturování, výpočet, zobrazení,
                    výmaz
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Doba</td>
                  <td className={TD}>
                    po dobu smlouvy + 12 měsíců; řádky a soubory po dobu
                    nastavenou Správcem
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Kategorie subjektů</td>
                  <td className={TD}>
                    zaměstnanci Správce, jeho obchodní partneři, kontaktní osoby
                    u odběratelů a dodavatelů — podle toho, co Správce nahraje
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Typ údajů</td>
                  <td className={TD}>
                    identifikační a kontaktní údaje obsažené v nahraných
                    souborech; rozsah určuje Správce tím, co nahraje
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Zvláštní kategorie</td>
                  <td className={TD}>
                    nejsou zpracovávány — u šablon s ukazateli „Lidé a růst“ se
                    řádky ani soubor neukládají; omezení je vynucené technicky
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className={H}>Příloha 2 — Technická a organizační opatření</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>HTTPS při přenosu, šifrování v uložení</li>
            <li>
              oddělení zákazníků řádkovou bezpečností na úrovni databáze, ne jen
              aplikace
            </li>
            <li>role uživatelů a schvalování nových firem</li>
            <li>záznam o podstatných úkonech v účtu</li>
            <li>
              ukládání jednotlivých řádků je volitelné a ve výchozím stavu
              vypnuté; zvláštní kategorie údajů se neukládají vůbec
            </li>
            <li>
              automatické a nevratné mazání po uplynutí nastavené doby, se
              záznamem o proběhlém mazání
            </li>
            <li>zálohování databáze u poskytovatele infrastruktury</li>
            <li>
              pravidelný test obnovy ze zálohy: <Fill>zatím nezaveden</Fill>
            </li>
          </ul>
        </section>

        <section>
          <h2 className={H}>Příloha 3 — Další zpracovatelé</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Subdodavatel</th>
                  <th className={TH}>Účel</th>
                  <th className={TH}>Umístění</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>Supabase</td>
                  <td className={TD}>
                    databáze, přihlašování, úložiště souborů
                  </td>
                  <td className={TD}>EU — Frankfurt</td>
                </tr>
                <tr>
                  <td className={TD}>Vercel</td>
                  <td className={TD}>provoz aplikace</td>
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
        </section>
      </div>
    </div>
  );
}
