import { Fill } from "@/components/LegalDraftNotice";

const QA = [
  {
    q: "Kde jsou naše data uložená?",
    a: "V EU, konkrétně v Německu (Frankfurt). Nikdy mimo EU.",
  },
  {
    q: "Kdo má k našim datům přístup?",
    a: "Jen uživatelé, které do aplikace pozveš, a jen k datům tvé vlastní firmy — technicky vynucené na úrovni databáze, ne jen v nastavení aplikace. Ostatní firmy používající aplikaci nemají k tvým datům žádný přístup, ani náhodou při chybě.",
  },
  {
    q: "Musíme aplikaci dávat citlivá data (mzdy, receptury)?",
    a: "Ne. Aplikace potřebuje jen provozní čísla (tržby, dodávky, zmetkovitost apod.). Doporučujeme nenahrávat nic, co obsahuje mzdy, osobní údaje zaměstnanců nebo výrobní know-how nad rámec toho, co aplikace skutečně používá k výpočtu KPI.",
  },
  {
    q: "Co když aplikaci přestaneme používat?",
    a: "Tvá data zůstanou k dispozici k exportu 12 měsíců po zrušení, poté se trvale smažou.",
  },
  {
    q: "Kolik aplikace stojí?",
    a: null,
    fill: "jakmile bude existovat ceník",
    prefix: "V pilotní fázi aplikaci nabízíme zdarma výměnou za zpětnou vazbu. ",
  },
  {
    q: "Kdo aplikaci vlastně provozuje?",
    a: null,
    fill: "obchodní firma s.r.o. / IČO, jakmile bude založena",
  },
  {
    q: "Je aplikace hotová a stabilní?",
    a: "Je v rané fázi aktivního vývoje (MVP). To znamená rychlejší reakci na tvůj konkrétní požadavek, ale i to, že se bude v čase měnit. Nejde o hotový, zaběhlý produkt s garantovanou nepřetržitou dostupností.",
  },
  {
    q: "Musíme mít ERP, abychom aplikaci mohli použít?",
    a: "Ne — aplikace je právě pro firmy bez ERP nebo s omezeným ERP. Stačí Excel/CSV export toho, co už dnes sleduješ (i ručně).",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Časté otázky</h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Odpovědi na to, co firmy nejčastěji zajímá, než začnou aplikaci používat.
      </p>

      <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {QA.map((item) => (
          <div key={item.q} className="py-5">
            <h2 className="mb-1.5 text-sm font-medium text-black dark:text-zinc-50">
              {item.q}
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {item.prefix}
              {item.a ?? <Fill>{item.fill}</Fill>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
