import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrystalField } from "@/components/marketing/CrystalField";
import { DeleteTemplateButton } from "./DeleteTemplateButton";

function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M3 9h18M9 9v12" />
    </svg>
  );
}

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
    .select("company_id, role")
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
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-3xl px-8 py-16 font-sans">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
              Data
            </p>
            <h1 className="font-display text-3xl font-semibold text-brand-ink">
              Šablony
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Jednou namapuješ, pak už jen vybíráš při nahrávání.
            </p>
          </div>
          <Link
            href="/templates/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-ink"
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
            <div
              key={t.id}
              className="group flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Link
                href={`/upload/template/${t.id}`}
                className="flex flex-1 items-center gap-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <TemplateIcon />
                </div>
                <span className="flex-1 font-medium text-black dark:text-zinc-50">
                  {t.name}
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {t.template_kpi_rules?.length ?? 0} KPI
                </span>
              </Link>
              {profile.role === "customer_admin" && (
                <DeleteTemplateButton templateId={t.id} templateName={t.name} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
