import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";
import { CrystalField } from "@/components/marketing/CrystalField";

const ROLE_LABELS: Record<string, string> = {
  user: "Uživatel (jen čtení)",
  customer_superuser: "Superuser (nahrává data)",
  customer_admin: "Admin (mapuje a nastavuje)",
};

const ROLE_BADGE: Record<string, string> = {
  user: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
  customer_superuser: "bg-brand-light/15 text-brand-light",
  customer_admin: "bg-brand/10 text-brand",
};

const ACTION_LABELS: Record<string, string> = {
  "upload.completed": "nahrál data",
  "template.created": "založil šablonu",
  "team.invited": "pozval kolegu",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

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
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-2xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Firma
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Tým
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pozvi kolegu a nastav mu roli.
        </p>

        <div className="mb-8 flex flex-col gap-2">
          {(teammates ?? []).map((t) => {
            const label = t.full_name || t.email;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {initials(label)}
                </div>
                <span className="flex-1 font-medium text-black dark:text-zinc-50">
                  {label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[t.role] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}
                >
                  {ROLE_LABELS[t.role] ?? t.role}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <InviteForm />
        </div>

        <h2 className="mb-2 mt-10 text-sm font-medium tracking-wide text-brand uppercase">
          Poslední aktivita
        </h2>
        <div className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
          {(activity ?? []).length === 0 && (
            <p className="px-4 py-3 text-zinc-500 dark:text-zinc-400">Zatím žádná aktivita.</p>
          )}
          {(activity ?? []).map((a) => {
            // @ts-expect-error - supabase nested join typing
            const who = a.users?.full_name || a.users?.email || "?";
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium text-black dark:text-zinc-50">{who}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {ACTION_LABELS[a.action] ?? a.action}
                  </span>
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(a.created_at).toLocaleString("cs-CZ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
