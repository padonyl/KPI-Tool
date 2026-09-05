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
  const { data: nahrani, error: chybaNahrani } = await db
    .from("uploads")
    .select("company_id, uploaded_at")
    .order("uploaded_at", { ascending: false });

  // Chybu NESMÍME spolknout. Dřív se tu jen bral `data`, a když
  // service_role na `uploads` neměl grant (do migrace 0014), vracelo se
  // null — takže u KAŽDÉ firmy stálo „nikdy nic nenahrála". Nepravda,
  // která vypadá jako fakt, je horší než chybová hláška.
  if (chybaNahrani) {
    console.error("[admin] uploads:", chybaNahrani.message);
  }

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

// ============================================================
// PŘEHLED A PROVOZ NÁSTROJE
// ------------------------------------------------------------
// Obojí staví VÝHRADNĚ na metadatech: kdy firma vznikla, jestli je
// schválená, kolik má uživatelů a šablon, kdy naposledy nahrávala a
// jestli jí nahrávání neselhalo. Ani jeden dotaz nesahá na kpi_values,
// deliveries ani kpi_budgets — a od migrace 0014 z `uploads` nemůže
// přečíst obsah, i kdyby chtěl: sloupcový grant pouští jen id,
// company_id, status, uploaded_at a processed_at.
//
// Z `activity_log` se ZÁMĚRNĚ nečte sloupec `metadata`. Jsou v něm
// poznámky, které admin firmy píše o svých zaměstnancích u odebrání
// přístupu — osobní údaje o třetí osobě, které zůstávají uvnitř firmy
// (rozhodnuto 2026-09-05). Provozovatel má vidět, ŽE se něco stalo.
// ============================================================

/** Firma, která nejspíš potřebuje pozornost. */
export type FirmaKVsimnuti = {
  id: string;
  nazev: string;
  vznikla: string;
  posledniNahrani: string | null;
  dniOdNahrani: number | null;
  chybnychNahrani?: number;
};

export type Prehled = {
  cekaNaSchvaleni: FirmaVPrehledu[];
  novePosledniTyden: number;
  usnule: FirmaKVsimnuti[];
  sChybami: FirmaKVsimnuti[];
};

const DEN = 24 * 60 * 60 * 1000;

/** Kolik celých dní uplynulo od data. */
function dniOd(kdy: string | null): number | null {
  if (!kdy) return null;
  return Math.floor((Date.now() - new Date(kdy).getTime()) / DEN);
}

/**
 * Co vyžaduje pozornost provozovatele.
 *
 * ZÁMĚRNĚ SEZNAMY, NE STATISTIKY. Seznam „těmhle firmám zavolej" dává
 * smysl od prvního zákazníka; míra aktivace nad dvěma firmami je šum.
 * Statistiky žijí zvlášť na /admin/provoz.
 */
export async function nactiPrehled(): Promise<Prehled> {
  const db = createAdminClient();
  const firmy = await nactiFirmy();

  const { data: nahrani, error } = await db
    .from("uploads")
    .select("company_id, status, uploaded_at");
  if (error) console.error("[admin] uploads:", error.message);

  // Firma se považuje za usnulou, až když měla čas se rozjet. Bez toho by
  // v seznamu skončil každý, kdo se zaregistroval včera.
  const USNULA_PO_DNECH = 30;
  const HAJENI_PO_REGISTRACI = 14;

  const usnule: FirmaKVsimnuti[] = firmy
    .filter((f) => f.stav === "approved")
    .filter((f) => (dniOd(f.vznikla) ?? 0) >= HAJENI_PO_REGISTRACI)
    .filter((f) => (dniOd(f.posledniNahrani) ?? Infinity) >= USNULA_PO_DNECH)
    .map((f) => ({
      id: f.id,
      nazev: f.nazev,
      vznikla: f.vznikla,
      posledniNahrani: f.posledniNahrani,
      dniOdNahrani: dniOd(f.posledniNahrani),
    }))
    .sort((a, b) => (b.dniOdNahrani ?? 1e9) - (a.dniOdNahrani ?? 1e9));

  // Firmy, kterým v posledním týdnu selhalo nahrávání. Nejpřímější signál
  // „zákazník je v úzkých" — a dnes ho neuvidíš nikde jinde.
  const tydenZpet = Date.now() - 7 * DEN;
  const chyby = new Map<string, number>();
  for (const u of nahrani ?? []) {
    if (u.status !== "error") continue;
    if (new Date(u.uploaded_at).getTime() < tydenZpet) continue;
    chyby.set(u.company_id, (chyby.get(u.company_id) ?? 0) + 1);
  }

  const sChybami: FirmaKVsimnuti[] = [...chyby.entries()]
    .map(([id, pocet]) => {
      const f = firmy.find((x) => x.id === id);
      return {
        id,
        nazev: f?.nazev ?? "(neznámá firma)",
        vznikla: f?.vznikla ?? "",
        posledniNahrani: f?.posledniNahrani ?? null,
        dniOdNahrani: dniOd(f?.posledniNahrani ?? null),
        chybnychNahrani: pocet,
      };
    })
    .sort((a, b) => (b.chybnychNahrani ?? 0) - (a.chybnychNahrani ?? 0));

  return {
    cekaNaSchvaleni: firmy.filter((f) => f.stav === "pending"),
    novePosledniTyden: firmy.filter((f) => (dniOd(f.vznikla) ?? 99) < 7).length,
    usnule,
    sChybami,
  };
}

export type Trychtyr = {
  registrovano: number;
  schvaleno: number;
  maSablonu: number;
  nahralo: number;
};

export type Provoz = {
  trychtyr: Trychtyr;
  medianDnuDoPrvnihoNahrani: number | null;
  nahraniPoTydnech: { tyden: string; pocet: number; chybnych: number }[];
  celkemNahrani: number;
  celkemChybnych: number;
  celkemUzivatelu: number;
};

/**
 * KPI o samotném nástroji.
 *
 * Čísla budou zpočátku prázdná nebo bezvýznamná — nad pár firmami je
 * míra aktivace šum, ne informace. Staví se přesto teď, aby se historie
 * začala nabírat od prvního zákazníka; dopočítat ji zpětně by nešlo.
 */
export async function nactiProvoz(): Promise<Provoz> {
  const db = createAdminClient();
  const firmy = await nactiFirmy();

  const { data: nahrani, error } = await db
    .from("uploads")
    .select("company_id, status, uploaded_at")
    .order("uploaded_at");
  if (error) console.error("[admin] uploads:", error.message);

  const schvalene = firmy.filter((f) => f.stav === "approved");
  const nahralyIds = new Set((nahrani ?? []).map((u) => u.company_id));

  // Čas do první hodnoty se počítá od REGISTRACE, ne od schválení —
  // `companies` datum schválení neukládá. Je to tak i poctivější: zahrnuje
  // i to, jak dlouho firma čekala na nás.
  const prvniNahrani = new Map<string, string>();
  for (const u of nahrani ?? []) {
    if (!prvniNahrani.has(u.company_id)) prvniNahrani.set(u.company_id, u.uploaded_at);
  }
  const doby = schvalene
    .map((f) => {
      const prvni = prvniNahrani.get(f.id);
      if (!prvni) return null;
      return Math.floor(
        (new Date(prvni).getTime() - new Date(f.vznikla).getTime()) / DEN,
      );
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  const median = doby.length
    ? doby.length % 2
      ? doby[(doby.length - 1) / 2]
      : Math.round((doby[doby.length / 2 - 1] + doby[doby.length / 2]) / 2)
    : null;

  // Posledních 12 týdnů, i ty prázdné — díra v řadě je taky informace.
  const tydny: { tyden: string; pocet: number; chybnych: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const od = Date.now() - (i + 1) * 7 * DEN;
    const doKdy = Date.now() - i * 7 * DEN;
    const vTydnu = (nahrani ?? []).filter((u) => {
      const t = new Date(u.uploaded_at).getTime();
      return t >= od && t < doKdy;
    });
    tydny.push({
      tyden: new Date(od).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" }),
      pocet: vTydnu.length,
      chybnych: vTydnu.filter((u) => u.status === "error").length,
    });
  }

  return {
    trychtyr: {
      registrovano: firmy.length,
      schvaleno: schvalene.length,
      maSablonu: schvalene.filter((f) => f.pocetSablon > 0).length,
      nahralo: schvalene.filter((f) => nahralyIds.has(f.id)).length,
    },
    medianDnuDoPrvnihoNahrani: median,
    nahraniPoTydnech: tydny,
    celkemNahrani: (nahrani ?? []).length,
    celkemChybnych: (nahrani ?? []).filter((u) => u.status === "error").length,
    celkemUzivatelu: firmy.reduce((s, f) => s + f.pocetUzivatelu, 0),
  };
}
