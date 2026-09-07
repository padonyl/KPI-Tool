// Stav "přihlášený člověk, který ještě nepatří k žádné firmě". Dřív byl
// tenhle blok doslova zkopírovaný v devíti stránkách; když se měnil text
// nebo vzhled, měnil se na jednom místě a na osmi zůstal starý.
//
// Šířka se drží té, kterou má okolní stránka, ať se refaktorem nezměnil
// vzhled: většina stránek je 6xl, nahrávání přes šablonu a ruční zápis 2xl.
export function BezFirmy({ sirka = "6xl" }: { sirka?: "2xl" | "6xl" }) {
  return (
    <div
      className={`mx-auto ${sirka === "2xl" ? "max-w-2xl" : "max-w-6xl"} px-8 py-16 font-sans`}
    >
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Tento uživatel zatím není napojený na žádnou firmu.
      </p>
    </div>
  );
}
