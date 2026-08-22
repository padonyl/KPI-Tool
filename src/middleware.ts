import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jeChranenaCesta, CEKACI_CESTA } from "@/lib/access";

// Bez tohohle middlewaru server komponenty (např. NavBar) občas vidí
// zastaralý stav přihlášení, protože se auth cookies neobnovují na
// každý request - viz doporučený vzor @supabase/ssr pro Next.js App Router.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nic mezi createServerClient a getUser() - viz Supabase docs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate na schválení firmy (migrace 0009). Dotaz se pouští jen na
  // chráněných cestách, ať se veřejný web nezpomaluje o dotaz do DB.
  //
  // Chybějící řádek v users NENÍ důvod k přesměrování - to je čerstvě
  // zaregistrovaný člověk před založením firmy a ten patří na
  // onboarding.
  if (user && jeChranenaCesta(request.nextUrl.pathname)) {
    const { data: profil } = await supabase
      .from("users")
      .select("companies(status)")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const firma = profil?.companies as unknown as { status: string } | null;

    if (firma && firma.status !== "approved") {
      const url = request.nextUrl.clone();
      url.pathname = CEKACI_CESTA;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
