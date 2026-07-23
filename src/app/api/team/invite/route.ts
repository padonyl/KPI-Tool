import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";

const VALID_ROLES = ["user", "customer_superuser", "customer_admin"] as const;

// [01b] Invite API route. Ověření oprávnění (customer_admin své firmy)
// dělá appka sama zde - service-role klient níže obchází RLS úplně,
// takže tahle kontrola JE bezpečnostní hranice, ne jen UX.
export async function POST(request: Request) {
  const { email, role } = await request.json();

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Neplatný e-mail." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Neplatná role." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nepřihlášeno." }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("users")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!caller || caller.role !== "customer_admin") {
    return NextResponse.json(
      { error: "Pozvat kolegu smí jen customer_admin." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password` },
  );

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Pozvání se nepodařilo odeslat." },
      { status: 400 },
    );
  }

  const { error: insertError } = await admin.from("users").insert({
    auth_user_id: invited.user.id,
    company_id: caller.company_id,
    email,
    role,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logActivity(admin, {
    companyId: caller.company_id,
    userId: caller.id,
    action: "team.invited",
    metadata: { invited_email: email, role },
  });

  return NextResponse.json({ ok: true });
}
