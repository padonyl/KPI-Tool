import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/nav-links";
import { SignOutButton } from "./SignOutButton";
import { Logo } from "./Logo";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const links = user ? APP_LINKS : MARKETING_LINKS;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4 font-sans">
        <Link href="/">
          <Logo />
        </Link>

        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-zinc-400 sm:inline">{user.email}</span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
            >
              Přihlásit se
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
