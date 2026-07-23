import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";

const ROLE_LABELS: Record<string, string> = {
  user: "Uživatel (jen čtení)",
  customer_superuser: "Superuser (nahrává data)",
  customer_admin: "Admin (mapuje a nastavuje)",
};

const ACTION_LABELS: Record<string, string> = {
  "upload.completed": "nahrál data",
  "template.created": "založil šablonu",
  "team.invited": "pozval kolegu",
};

export default async function TeamPage() {
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

  // [01d] Pouze customer_admin smí vidět/spravovat tým - stejná kontrola,
  // jakou má i /api/team/invite. Nižší role vidí zdvořilou zprávu, ne
  // chybu - konzistentní se stylem "Tento uživatel zatím není napojený..."
  // použitým jinde v appce.
  if (profile.role !== "customer_admin") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Správu týmu vidí jen admin firmy.
        </p>
      </div>
    );
  }

  const { data: teammates } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at");

  const { data: activity } = await supabase
    .from("activity_log")
    .select("id, action, created_at, users(email, full_name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Tým</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Pozvi kolegu a nastav mu roli.
      </p>

      <div className="mb-8 flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {(teammates ?? []).map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>{t.full_name || t.email}</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {ROLE_LABELS[t.role] ?? t.role}
            </span>
          </div>
        ))}
      </div>

      <InviteForm />

      <h2 className="mb-2 mt-10 text-sm font-medium">Poslední aktivita</h2>
      <div className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {(activity ?? []).length === 0 && (
          <p className="px-4 py-3 text-zinc-500 dark:text-zinc-400">Zatím žádná aktivita.</p>
        )}
        {(activity ?? []).map((a) => {
          // @ts-expect-error - supabase nested join typing
          const who = a.users?.full_name || a.users?.email || "?";
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium">{who}</span>{" "}
                {ACTION_LABELS[a.action] ?? a.action}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(a.created_at).toLocaleString("cs-CZ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
