import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Změna zobrazovaného jména vlastního účtu.
//
// Jde přes server, protože migrace 0013 odebrala roli `authenticated`
// právo zapisovat do `users` — jinak by si deaktivovaný uživatel mohl
// přepsat stav zpátky na aktivní. Zápis tedy dělá service_role a tahle
// funkce hlídá, že mění VÝHRADNĚ vlastní řádek volajícího.

export async function POST(request: Request) {
  const { jmeno } = await request.json();

  if (typeof jmeno !== "string") {
    return NextResponse.json({ error: "Chybí jméno." }, { status: 400 });
  }
  const ciste = jmeno.trim().slice(0, 120);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášeno." }, { status: 401 });

  const { error } = await createAdminClient()
    .from("users")
    .update({ full_name: ciste || null })
    .eq("auth_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
