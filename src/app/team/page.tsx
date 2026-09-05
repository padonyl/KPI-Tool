import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";
import { SpravaClena } from "./SpravaClena";
import { CrystalField } from "@/components/marketing/CrystalField";

const ROLE_LABELS: Record<string, string> = {
  user: "Uživatel (jen čtení)",
  customer_superuser: "Superuser (nahrává data)",
  customer_admin: "Admin (mapuje a nastavuje)",
};

// Štítky rolí, které nesou barvu značky, mají PLNOU VÝPLŇ tokenem, který
// se v tmavém režimu nepřeklápí (`--brand-solid`, `--brand-light`), a bílý
// text. Vychází z toho stejný poměr v obou režimech.
//
// Původní `bg-brand/10 text-brand` bralo text i podbarvení z TÉHOŽ
// překlápějícího se tokenu, takže v tmavém režimu splynuly (1,17:1). Byl
// to za jeden den třetí výskyt téhož vzorce — po záložce Administrace a
// filtru firem. Poloprůhledné podbarvení pod textem stejné barvy je past;
// když má prvek nést barvu značky, patří na něj plná výplň.
const ROLE_BADGE: Record<string, string> = {
  user: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  customer_superuser: "bg-brand-light text-white",
  customer_admin: "bg-brand-solid text-white",
};

const ACTION_LABELS: Record<string, string> = {
  "upload.completed": "nahrál data",
  "template.created": "založil šablonu",
  "team.invited": "pozval kolegu",
  "team.role_changed": "změnil roli",
  "team.access_changed": "změnil přístup",
};

// Stavy z migrace 0013. 'active' se nezobrazuje - normální stav nemá mít
// štítek, jinak se ztratí ty výjimečné mezi šumem.
const STATUS_LABELS: Record<string, string> = {
  deactivated: "Bez přístupu",
  suspended: "Pozastaveno provozovatelem",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tento uživatel zatím není napojený na žádnou firmu.
        </p>
      </div>
    );
  }

  // [01d] Pouze customer_admin smí vidět/spravovat tým - stejná kontrola,
  // jakou má i /api/team/invite. Nižší role vidí zdvořilou zprávu, ne
  // chybu - konzistentní se stylem "Tento uživatel zatím není napojený..."
  // použitým jinde v appce.
  if (profile.role !== "customer_admin") {
    return (
      <div className="mx-auto max-w-6xl px-8 py-16 font-sans">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Správu týmu vidí jen admin firmy.
        </p>
      </div>
    );
  }

  const { data: teammates } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at, status, status_reason")
    .eq("company_id", profile.company_id)
    .order("created_at");

  const aktivni = (teammates ?? []).filter((t) => t.status === "active");
  const odebrani = (teammates ?? []).filter((t) => t.status !== "active");

  const { data: activity } = await supabase
    .from("activity_log")
    .select("id, action, created_at, users(email, full_name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="relative isolate overflow-hidden">
      <CrystalField variant="light" />
      <div className="relative mx-auto max-w-6xl px-8 py-16 font-sans">
        <p className="mb-1 text-sm font-medium tracking-wide text-brand uppercase">
          Firma
        </p>
        <h1 className="font-display mb-2 text-3xl font-semibold text-brand-ink">
          Tým
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pozvi kolegu a nastav mu roli.
        </p>

        <div className="mb-8 flex flex-col gap-2">
          {aktivni.map((t) => (
            <RadekClena key={t.id} clen={t} jaSam={t.id === profile.id} />
          ))}
        </div>

        {/* Odebraní se nezobrazují mezi aktivními — v běžném pohledu jen
            překážejí. Nemizí ale úplně: admin musí mít jak je vrátit a
            jak si ověřit, komu přístup vzal. Proto sbalená sekce. */}
        {odebrani.length > 0 && (
          <details className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
            <summary className="cursor-pointer px-4 py-3 text-sm text-zinc-600 select-none dark:text-zinc-400">
              Bez přístupu ({odebrani.length})
            </summary>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {odebrani.map((t) => (
                <RadekClena key={t.id} clen={t} jaSam={t.id === profile.id} />
              ))}
            </div>
          </details>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <InviteForm />
        </div>

        <h2 className="mb-2 mt-10 text-sm font-medium tracking-wide text-brand uppercase">
          Poslední aktivita
        </h2>
        <div className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
          {(activity ?? []).length === 0 && (
            <p className="px-4 py-3 text-zinc-500 dark:text-zinc-400">Zatím žádná aktivita.</p>
          )}
          {(activity ?? []).map((a) => {
            // @ts-expect-error - supabase nested join typing
            const who = a.users?.full_name || a.users?.email || "?";
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium text-black dark:text-zinc-50">{who}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {ACTION_LABELS[a.action] ?? a.action}
                  </span>
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {new Date(a.created_at).toLocaleString("cs-CZ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Jeden člen týmu. Stejný vzhled pro aktivní i odebrané, liší se ztlumením. */
function RadekClena({
  clen,
  jaSam,
}: {
  clen: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    status: string;
    status_reason: string | null;
  };
  jaSam: boolean;
}) {
  const label = clen.full_name || clen.email;
  const bezPristupu = clen.status !== "active";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
        bezPristupu
          ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          bezPristupu
            ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            : "bg-brand/10 text-brand"
        }`}
      >
        {initials(label)}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={
            bezPristupu
              ? "font-medium text-zinc-600 dark:text-zinc-400"
              : "font-medium text-black dark:text-zinc-50"
          }
        >
          {label}
        </span>
        {jaSam && <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">(ty)</span>}
        {/* Důvod vidí jen firma - do admin prostředí se nedostane. */}
        {bezPristupu && clen.status_reason && (
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {clen.status_reason}
          </p>
        )}
      </div>

      {bezPristupu && (
        <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {STATUS_LABELS[clen.status] ?? clen.status}
        </span>
      )}

      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          bezPristupu
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            : (ROLE_BADGE[clen.role] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-900")
        }`}
      >
        {ROLE_LABELS[clen.role] ?? clen.role}
      </span>

      <SpravaClena
        userId={clen.id}
        role={clen.role}
        status={clen.status}
        jaSam={jaSam}
      />
    </div>
  );
}
