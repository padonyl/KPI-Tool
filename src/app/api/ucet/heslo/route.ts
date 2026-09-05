import { NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";
import { MIN_DELKA_HESLA } from "@/lib/heslo";

// Změna vlastního hesla.
//
// PROČ TO NEDĚLÁ PROHLÍŽEČ SÁM: v nastavení projektu je zapnuté
// „Require current password when updating". Klientská knihovna nemá, jak
// staré heslo předat, takže by změna hesla z aplikace vůbec neprošla.
//
// Staré heslo proto ověřujeme sami — pokusem o přihlášení JEDNORÁZOVÝM
// klientem, který nesahá na cookies probíhajícího sezení. Teprve když
// projde, nastaví se nové přes service_role.
//
// Ta kontrola není formalita: bez ní by stačilo odcizené sezení
// (například z cizího nezamčeného počítače) k tomu, aby útočník změnil
// heslo a majitele z účtu vyšoupl.

export async function POST(request: Request) {
  const { stare, nove } = await request.json();

  if (typeof stare !== "string" || typeof nove !== "string") {
    return NextResponse.json({ error: "Chybí heslo." }, { status: 400 });
  }
  if (nove.length < MIN_DELKA_HESLA) {
    return NextResponse.json(
      { error: `Nové heslo musí mít alespoň ${MIN_DELKA_HESLA} znaků.` },
      { status: 400 },
    );
  }
  if (nove === stare) {
    return NextResponse.json(
      { error: "Nové heslo musí být jiné než to staré." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Nepřihlášeno." }, { status: 401 });
  }

  // Jednorázový klient bez vazby na cookies — ověření nesmí přepsat ani
  // zneplatnit sezení, ve kterém uživatel právě pracuje.
  const overovaci = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: chybaOvereni } = await overovaci.auth.signInWithPassword({
    email: user.email,
    password: stare,
  });
  if (chybaOvereni) {
    return NextResponse.json({ error: "Staré heslo nesouhlasí." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: nove });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: profil } = await admin
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profil) {
    await logActivity(admin, {
      companyId: profil.company_id,
      userId: profil.id,
      action: "ucet.heslo_zmeneno",
    });
  }

  return NextResponse.json({ ok: true });
}
