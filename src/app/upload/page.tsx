import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrystalField } from "@/components/marketing/CrystalField";

function TemplateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M3 9h18M9 9v12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6"
    >
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
      />
    </svg>
  );
}

export default async function UploadChooserPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: templates } = profile
    ? await supabase
        .from("upload_templates")
        .select("id, name, template_kpi_rules(id)")
        .eq("company_id", profile.company_id)
        .order("name")
    : { data: [] };

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-6xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Data
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Nahrát data
        </h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          Vyber šablonu, kterou chceš souborem naplnit.
        </p>

        {/* Šablony vlevo, zápis bez souboru stranou - jsou to dvě různé
            činnosti, ne tři rovnocenné dlaždice v jedné mřížce. */}
        <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates?.map((t) => (
                <Link
                  key={t.id}
                  href={`/upload/template/${t.id}`}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <TemplateIcon />
                  </div>
                  <span className="font-medium text-black dark:text-zinc-50">
                    {t.name}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t.template_kpi_rules?.length ?? 0} KPI z tohoto souboru
                  </span>
                </Link>
              ))}

              <Link
                href="/templates/new"
                className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-300 p-5 text-left transition-colors hover:border-brand/50 hover:bg-brand/5 dark:border-zinc-700 dark:hover:border-brand/50 dark:hover:bg-brand/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                  <PlusIcon />
                </div>
                <span className="font-medium text-black dark:text-zinc-50">
                  Nová šablona
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Namapuj nový typ souboru poprvé
                </span>
              </Link>
            </div>
          </div>

          <aside className="lg:border-l lg:border-zinc-200 lg:pl-8 dark:lg:border-zinc-800">
            <h2 className="mb-1 text-sm font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
              Bez souboru
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Některá čísla nemá smysl tahat ze souboru — počet úrazů, výsledek
              dotazníku, investice do školení.
            </p>
            <Link
              href="/upload/manual"
              className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <PencilIcon />
              </span>
              <span className="font-medium text-black dark:text-zinc-50">
                Zapsat hodnotu ručně
              </span>
            </Link>
          </aside>
        </div>

      </div>
    </div>
  );
}
