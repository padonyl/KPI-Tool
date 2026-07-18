import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function BarChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-8 w-8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
      />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-8 w-8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17l6-6 4 4 8-8M21 7h-6v6"
      />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-8 w-8"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-6 px-8 py-20 text-center">
        <div className="flex gap-4 text-zinc-300 dark:text-zinc-700">
          <BarChartIcon />
          <TrendUpIcon />
          <TargetIcon />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          KPI Tool
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Sleduj klíčové ukazatele své výroby v čase — bez senzorů, bez ERP
          integrace, jen data, co už máš.
        </p>

        <Link
          href="/login"
          className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Přihlásit se / Zaregistrovat se
        </Link>
      </main>
    </div>
  );
}
