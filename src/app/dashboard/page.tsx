import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateCompanyForm } from "./CreateCompanyForm";

function UploadIcon() {
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
        d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("full_name, role, companies(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let sectors: { id: string; label: string }[] = [];
  let sizeBands: { id: string; label: string }[] = [];

  if (!error && !profile) {
    const [{ data: sectorRows }, { data: sizeBandRows }] = await Promise.all([
      supabase.from("sectors").select("id, name").order("sort_order"),
      supabase
        .from("company_size_bands")
        .select("id, label")
        .order("sort_order"),
    ]);
    sectors = (sectorRows ?? []).map((s) => ({ id: s.id, label: s.name }));
    sizeBands = sizeBandRows ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Přihlášen jako <span className="font-medium">{user.email}</span>
      </p>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error.message}
        </div>
      )}

      {!error && !profile && (
        <CreateCompanyForm
          authUserId={user.id}
          email={user.email ?? ""}
          sectors={sectors}
          sizeBands={sizeBands}
        />
      )}

      {profile && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <p>
              Firma:{" "}
              <span className="font-medium">
                {/* @ts-expect-error - supabase join typing */}
                {profile.companies?.name ?? "?"}
              </span>
            </p>
            <p>Role: {profile.role}</p>
          </div>

          <Link
            href="/upload"
            className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <UploadIcon />
            <div>
              <p className="font-medium text-black dark:text-zinc-50">
                Nahrát data
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                KPI čísla nebo report dodávek
              </p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
