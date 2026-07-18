import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_LINKS } from "@/lib/nav-links";
import { SignOutButton } from "./SignOutButton";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4 font-sans">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          KPI Tool
        </Link>

        <div className="flex items-center gap-6">
          {user &&
            APP_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {link.label}
              </Link>
            ))}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">{user.email}</span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Přihlásit se
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
