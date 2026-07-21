import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TemplatesPage() {
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

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tento uživatel zatím není napojený na žádnou firmu.
        </p>
      </div>
    );
  }

  const { data: templates } = await supabase
    .from("upload_templates")
    .select("id, name, created_at, template_kpi_rules(id)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-8 py-16 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Šablony</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Jednou namapuješ, pak už jen vybíráš při nahrávání.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          + Nová šablona
        </Link>
      </div>

      {(!templates || templates.length === 0) && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Zatím žádná šablona — založ první.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {templates?.map((t) => (
          <Link
            key={t.id}
            href={`/upload/template/${t.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <span className="font-medium">{t.name}</span>
            <span className="text-sm text-zinc-500">
              {t.template_kpi_rules?.length ?? 0} KPI
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
