import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/nav-links";
import { overAdmina } from "@/lib/admin";
import { SignOutButton } from "./SignOutButton";
import { Logo } from "./Logo";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const links = user ? APP_LINKS : MARKETING_LINKS;

  // Záložku vidí jen provozovatel platformy, a platí pro ni tentýž
  // DVOJITÝ ZÁMEK jako pro samotnou stránku: e-mail musí být v proměnné
  // ADMIN_EMAILS a zároveň v tabulce platform_admins. Nekontroluje se to
  // v prohlížeči — odkaz by prozradil, že ta sekce vůbec existuje.
  //
  // Levné to je proto, že overAdmina() se ptá nejdřív na proměnnou a
  // teprve pak do databáze. Pro kohokoliv jiného než provozovatele tedy
  // nepřibude ani jeden dotaz. Uživatel se předává, ať se neověřuje
  // podruhé — lišta se vykresluje na každé stránce.
  const admin = user ? await overAdmina(user) : null;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 font-sans">
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

          {admin && (
            <Link
              href="/admin"
              // Plná výplň tokenem, který se v tmavém režimu NEPŘEKLÁPÍ.
              // První verze měla bg-brand/10 + text-brand, jenže --brand se
              // v tmavém režimu překlápí na světlejší modrou — text i
              // podbarvení tím byly tentýž odstín a vyšlo z toho 1.18:1.
              // Přesně ta chyba, kvůli které --brand-solid vznikl.
              className="rounded-md bg-brand-solid px-2.5 py-1 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
            >
              Administrace
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 pr-1 pl-3 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
            >
              Přihlásit se
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
