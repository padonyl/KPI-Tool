import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateCompanyForm } from "./CreateCompanyForm";
import { CrystalField } from "@/components/marketing/CrystalField";
import { CompanyStatusBadge } from "@/components/CompanyStatusBadge";

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

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ml-auto h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand dark:text-zinc-600">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
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
    .select("full_name, role, companies(name, status)")
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
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div
        aria-hidden="true"
        className="animate-pulse-glow pointer-events-none absolute top-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-brand blur-3xl"
      />
      <div className="relative mx-auto max-w-2xl px-8 py-16 font-sans">
        <h1 className="font-display mb-1 text-2xl font-semibold text-brand-ink">
          Dashboard
        </h1>
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          Přihlášen jako{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {user.email}
          </span>
        </p>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error.message}
          </div>
        )}

        {!error && !profile && (
          <div>
            <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
              První krok
            </p>
            <h2 className="font-display mb-6 text-xl font-semibold text-brand-ink">
              Nastav si firmu
            </h2>
            <CreateCompanyForm
              authUserId={user.id}
              email={user.email ?? ""}
              sectors={sectors}
              sizeBands={sizeBands}
            />
          </div>
        )}

        {profile && (
          <div className="flex flex-col gap-5">
            <div className="relative overflow-hidden rounded-2xl border-2 border-brand/20 bg-gradient-to-br from-brand/5 to-transparent p-6">
              <svg
                viewBox="0 0 64 60"
                className="pointer-events-none absolute -top-3 -right-3 h-24 w-24 opacity-[0.08]"
                aria-hidden="true"
              >
                <polygon
                  points="30,4 52,16 58,36 42,54 18,50 6,30 14,12"
                  className="fill-brand"
                />
              </svg>
              <div className="relative">
                <p className="text-xs font-medium tracking-wide text-brand uppercase">
                  Firma
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-display text-xl font-semibold text-brand-ink">
                    {/* @ts-expect-error - supabase join typing */}
                    {profile.companies?.name ?? "?"}
                  </p>
                  <CompanyStatusBadge
                    /* @ts-expect-error - supabase join typing */
                    status={profile.companies?.status ?? "pending"}
                  />
                </div>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Role: {profile.role}
                </p>
              </div>
            </div>

            <Link
              href="/kpis"
              className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0ca30c]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                <ChartIcon />
              </div>
              <div>
                <p className="font-medium text-black dark:text-zinc-50">
                  Přehled KPI
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Aktuální stav a trend v čase
                </p>
              </div>
              <ArrowRightIcon />
            </Link>

            <Link
              href="/upload"
              className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <UploadIcon />
              </div>
              <div>
                <p className="font-medium text-black dark:text-zinc-50">
                  Nahrát data
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  KPI čísla nebo report dodávek
                </p>
              </div>
              <ArrowRightIcon />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
