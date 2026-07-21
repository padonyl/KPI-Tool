import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateUploadForm } from "./TemplateUploadForm";

export default async function TemplateUploadPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, company_id")
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

  const { data: template } = await supabase
    .from("upload_templates")
    .select("id, name, date_column_name, period_type, company_id")
    .eq("id", templateId)
    .maybeSingle();

  if (!template || template.company_id !== profile.company_id) {
    notFound();
  }

  const { data: rules } = await supabase
    .from("template_kpi_rules")
    .select("id, kpi_definition_id, rule_type, config, kpi_definitions(name, code)")
    .eq("template_id", templateId);

  return (
    <div className="mx-auto max-w-3xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Nahrát: {template.name}</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {rules?.length ?? 0} KPI se z tohoto souboru dopočítá automaticky.
      </p>
      <TemplateUploadForm
        companyId={profile.company_id}
        userId={profile.id}
        template={{
          id: template.id,
          dateColumnName: template.date_column_name,
          periodType: template.period_type,
        }}
        rules={(rules ?? []).map((r) => ({
          kpiDefinitionId: r.kpi_definition_id,
          // @ts-expect-error - supabase nested join typing
          kpiName: r.kpi_definitions?.name ?? "?",
          // @ts-expect-error - supabase nested join typing
          kpiCode: r.kpi_definitions?.code ?? "",
          ruleType: r.rule_type,
          config: r.config,
        }))}
      />
    </div>
  );
}
