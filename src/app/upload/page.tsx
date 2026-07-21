import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Nahrát data</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Vyber šablonu, kterou chceš souborem naplnit.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates?.map((t) => (
          <Link
            key={t.id}
            href={`/upload/template/${t.id}`}
            className="flex flex-col items-start gap-2 rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <TemplateIcon />
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
          className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-zinc-300 p-5 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          <PlusIcon />
          <span className="font-medium text-black dark:text-zinc-50">
            Nová šablona
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Namapuj nový typ souboru poprvé
          </span>
        </Link>
      </div>

      <p className="mt-8 text-xs text-zinc-400">
        Starší přímé toky (bez šablony):{" "}
        <Link href="/upload/kpi" className="underline">
          standardní KPI data
        </Link>{" "}
        ·{" "}
        <Link href="/upload/deliveries" className="underline">
          report dodávek
        </Link>
      </p>
    </div>
  );
}
