import { createClient } from "@/lib/supabase/server";

export default async function TestDbPage() {
  const supabase = await createClient();

  const [sectors, sizeBands, kpis] = await Promise.all([
    supabase.from("sectors").select("code, name").order("sort_order"),
    supabase
      .from("company_size_bands")
      .select("code, label")
      .order("sort_order"),
    supabase
      .from("kpi_definitions")
      .select("code, name, category, unit, value_type"),
  ]);

  const firstError = sectors.error ?? sizeBands.error ?? kpis.error;

  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Test připojení na Supabase</h1>

      {firstError ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Chyba při dotazu na databázi:</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm">
            {firstError.message}
          </pre>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-2 font-medium">
              sectors ({sectors.data?.length ?? 0})
            </h2>
            <ul className="list-disc pl-5 text-sm">
              {sectors.data?.map((s) => (
                <li key={s.code}>
                  {s.name} <span className="text-zinc-500">({s.code})</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-medium">
              company_size_bands ({sizeBands.data?.length ?? 0})
            </h2>
            <ul className="list-disc pl-5 text-sm">
              {sizeBands.data?.map((b) => (
                <li key={b.code}>
                  {b.label} <span className="text-zinc-500">({b.code})</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-medium">
              kpi_definitions ({kpis.data?.length ?? 0})
            </h2>
            <ul className="list-disc pl-5 text-sm">
              {kpis.data?.map((k) => (
                <li key={k.code}>
                  {k.name} — {k.category}, {k.unit}, {k.value_type}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
