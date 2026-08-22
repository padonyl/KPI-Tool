import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Data pro admin prostředí — VÝHRADNĚ METADATA.
//
// Hranice dohodnutá 2026-08-22: provozovatel vidí, které firmy existují,
// kdo v nich má účet a jestli s nástrojem pracují. NEVIDÍ jejich čísla.
//
// Prakticky to znamená, že v tomhle souboru se nikdy nesmí objevit dotaz
// na `kpi_values`, `deliveries` ani `kpi_budgets`. Hlídá to test
// e2e/admin-hranice.spec.ts, ne jen tenhle komentář — kdyby sem někdo
// takový dotaz přidal, test spadne.
//
// Počty šablon a poslední nahrání se čtou z metadat (`upload_templates`,
// `uploads.uploaded_at`), ne z obsahu. Vědět, ŽE firma něco nahrála, je
// provozní informace; vědět CO nahrála, je její věc.
//
// Přístup k číslům bude samostatná funkce na pozvání od firmy, časově
// omezená a kdykoliv odvolatelná.
// ============================================================

export type StavFirmy = "pending" | "approved" | "rejected";

export type FirmaVPrehledu = {
  id: string;
  nazev: string;
  stav: StavFirmy;
  vznikla: string;
  pocetUzivatelu: number;
  pocetSablon: number;
  posledniNahrani: string | null;
};

export type UzivatelFirmy = {
  id: string;
  email: string;
  jmeno: string | null;
  role: string;
  vznikl: string;
};

export type DetailFirmy = FirmaVPrehledu & {
  obor: string | null;
  velikost: string | null;
  zeme: string | null;
  uzivatele: UzivatelFirmy[];
};

/** Seznam firem s metadaty. `jenCekajici` zúží na ty, co čekají na schválení. */
export async function nactiFirmy(jenCekajici = false): Promise<FirmaVPrehledu[]> {
  const db = createAdminClient();

  let dotaz = db
    .from("companies")
    .select("id, name, status, created_at, users(id), upload_templates(id)")
    .order("created_at", { ascending: false });

  if (jenCekajici) dotaz = dotaz.eq("status", "pending");

  const { data, error } = await dotaz;
  if (error || !data) return [];

  // Poslední nahrání se dotahuje zvlášť: zajímá nás jen ČAS, ne obsah,
  // takže se vybírá výhradně sloupec uploaded_at.
  const { data: nahrani } = await db
    .from("uploads")
    .select("company_id, uploaded_at")
    .order("uploaded_at", { ascending: false });

  const posledni = new Map<string, string>();
  for (const u of nahrani ?? []) {
    if (!posledni.has(u.company_id)) posledni.set(u.company_id, u.uploaded_at);
  }

  return data.map((f) => ({
    id: f.id,
    nazev: f.name,
    stav: f.status as StavFirmy,
    vznikla: f.created_at,
    pocetUzivatelu: (f.users as unknown as unknown[])?.length ?? 0,
    pocetSablon: (f.upload_templates as unknown as unknown[])?.length ?? 0,
    posledniNahrani: posledni.get(f.id) ?? null,
  }));
}

/** Detail jedné firmy včetně jejích uživatelů. Pořád jen metadata. */
export async function nactiDetailFirmy(id: string): Promise<DetailFirmy | null> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("companies")
    .select(
      "id, name, status, created_at, country, sectors(name), company_size_bands(label), users(id, email, full_name, role, created_at), upload_templates(id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: nahrani } = await db
    .from("uploads")
    .select("uploaded_at")
    .eq("company_id", id)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  const uzivatele = ((data.users ?? []) as unknown as UzivatelFirmy[] & {
    full_name: string | null;
    created_at: string;
  }[]).map((u: Record<string, unknown>) => ({
    id: String(u.id),
    email: String(u.email),
    jmeno: (u.full_name as string | null) ?? null,
    role: String(u.role),
    vznikl: String(u.created_at),
  }));

  return {
    id: data.id,
    nazev: data.name,
    stav: data.status as StavFirmy,
    vznikla: data.created_at,
    zeme: data.country,
    obor: (data.sectors as unknown as { name: string } | null)?.name ?? null,
    velikost:
      (data.company_size_bands as unknown as { label: string } | null)?.label ?? null,
    pocetUzivatelu: uzivatele.length,
    pocetSablon: (data.upload_templates as unknown as unknown[])?.length ?? 0,
    posledniNahrani: nahrani?.[0]?.uploaded_at ?? null,
    uzivatele,
  };
}
