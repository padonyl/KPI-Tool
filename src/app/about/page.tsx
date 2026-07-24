export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">O nás</p>
      <h1 className="font-display mb-8 text-3xl font-semibold text-balance text-brand-ink">
        Postavené na deseti letech v provozu, ne na tabulce v prezentaci
      </h1>

      <div className="flex flex-col gap-6 text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
        <p>
          Padonyl vzniklo z jedné opakující se zkušenosti — přes deset let
          v supply chain, farmaceutické výrobě a projektovém řízení jsme
          pořád viděli stejný vzorec: firmy mají v ERP nebo v Excelu spoustu
          provozních dat, ale nikdo v nich systematicky nehledá, co z nich
          jde vyčíst navíc. Sledování KPI zůstává buď na papíře, nebo
          v ruční tabulce, kterou aktualizuje jeden člověk jednou za měsíc.
        </p>
        <p>
          Nechtěli jsme stavět další nástroj pro firmy, co už vědí, co chtějí
          sledovat, a stačí jim hezčí graf — to zvládne Excel sám. Chtěli
          jsme nástroj pro firmu, co neví, že z dodacích listů, faktur nebo
          výrobních záznamů, které už má, jde konkrétní ukazatel spočítat
          automaticky, v čase, bez ručního přepočítávání každý měsíc.
        </p>
        <p>
          Appka je dnes v rané, pilotní fázi. Stavíme ji přímo s prvními
          firmami, ne dopředu za zavřenými dveřmi — pokud píšeš z výrobní
          firmy a chceš být mezi prvními, kdo appku zkusí, napiš nám.
        </p>
      </div>
    </div>
  );
}
