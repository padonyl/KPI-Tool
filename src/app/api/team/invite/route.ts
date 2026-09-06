import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";
import { overSpravce } from "@/lib/team-auth";
import { translateAuthError } from "@/lib/auth-errors";

// [01b] Invite API route. Ověření oprávnění (customer_admin své firmy)
// dělá appka sama přes team-auth - service-role klient níže obchází RLS
// úplně, takže tahle kontrola JE bezpečnostní hranice, ne jen UX.

const VALID_ROLES = ["user", "customer_superuser", "customer_admin"] as const;

export async function POST(request: Request) {
  const { email, role } = await request.json();

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Neplatný e-mail." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Neplatná role." }, { status: 400 });
  }

  const spravce = await overSpravce();
  if (!spravce.ok) {
    return NextResponse.json({ error: spravce.chyba }, { status: spravce.stav });
  }

  const admin = createAdminClient();
  const adresa = email.trim().toLowerCase();

  // ------------------------------------------------------------
  // Existující řádek: pozvání může být NÁVRAT, ne nový člen
  // ------------------------------------------------------------
  // Schéma má na `users.auth_user_id` unikátní index (jeden účet = nejvýš
  // jedna firma), takže druhý řádek pro tentýž účet vzniknout nemůže. A
  // protože odebrání přístupu řádek nemaže, jen mění stav (migrace 0013),
  // narazí každé opětovné pozvání právě sem. Bez téhle větve by admin
  // dostal hlášku o porušení unikátního indexu a nepochopil ji.
  const { data: stavajici } = await admin
    .from("users")
    .select("id, company_id, status, role")
    .eq("email", adresa)
    .limit(1)
    .maybeSingle();

  if (stavajici) {
    if (stavajici.company_id !== spravce.data.companyId) {
      return NextResponse.json(
        { error: "Tenhle e-mail už patří účtu v jiné firmě." },
        { status: 409 },
      );
    }

    if (stavajici.status === "active") {
      return NextResponse.json({ error: "Tenhle člověk už v týmu je." }, { status: 409 });
    }

    if (stavajici.status === "suspended") {
      return NextResponse.json(
        { error: "Tenhle přístup pozastavil provozovatel. Ozvi se nám." },
        { status: 409 },
      );
    }

    const { error: obnovaError } = await admin
      .from("users")
      .update({
        status: "active",
        role,
        status_reason: null,
        status_changed_at: new Date().toISOString(),
        status_changed_by: spravce.data.id,
      })
      .eq("id", stavajici.id);

    if (obnovaError) {
      return NextResponse.json({ error: obnovaError.message }, { status: 500 });
    }

    await logActivity(admin, {
      companyId: spravce.data.companyId,
      userId: spravce.data.id,
      action: "team.access_changed",
      metadata: {
        target_email: adresa,
        from: stavajici.status,
        to: "active",
        popis: "vrácen přístup",
        poznamka: "obnoveno opětovným pozváním",
      },
    });

    return NextResponse.json({ ok: true, obnoveno: true });
  }

  // ------------------------------------------------------------
  // Nový člověk
  // ------------------------------------------------------------
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    adresa,
    { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password` },
  );

  if (inviteError || !invited.user) {
    // Přeložit Supabase hlášku do češtiny — jinak adminovi u neověřitelné
    // adresy vyskočí syrové „Email address X is invalid" (nález testu 2026-09-06).
    return NextResponse.json(
      {
        error: inviteError
          ? translateAuthError(inviteError.message)
          : "Pozvání se nepodařilo odeslat.",
      },
      { status: 400 },
    );
  }

  const { error: insertError } = await admin.from("users").insert({
    auth_user_id: invited.user.id,
    company_id: spravce.data.companyId,
    email: adresa,
    role,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logActivity(admin, {
    companyId: spravce.data.companyId,
    userId: spravce.data.id,
    action: "team.invited",
    metadata: { invited_email: adresa, role },
  });

  return NextResponse.json({ ok: true });
}
