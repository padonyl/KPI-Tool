"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Ovládání jednoho člena týmu: změna role a odebrání či vrácení přístupu.
//
// Panel se rozbaluje na místě, ne v modálním okně — admin často mění víc
// lidí po sobě a zavírání okna po každém by ho zdržovalo.
//
// Poznámka je u obou akcí, protože důvod se hodí i u povýšení, nejen u
// odebrání. Ukládá se do `users.status_reason` (jen u změny přístupu) a
// vždy do `activity_log`, kde zůstane i po další změně.

const ROLE_VOLBY = [
  { hodnota: "user", popis: "Uživatel (jen čtení)" },
  { hodnota: "customer_superuser", popis: "Superuser (nahrává data)" },
  { hodnota: "customer_admin", popis: "Admin (mapuje a nastavuje)" },
];

export function SpravaClena({
  userId,
  role,
  status,
  jaSam,
}: {
  userId: string;
  role: string;
  status: string;
  jaSam: boolean;
}) {
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [novaRole, setNovaRole] = useState(role);
  const [poznamka, setPoznamka] = useState("");
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  // Pozastavení nastavuje provozovatel a firma s ním nesmí hýbat —
  // tlačítko se proto vůbec nenabídne. Server to hlídá taky.
  const pozastaveno = status === "suspended";

  async function posli(cesta: string, telo: Record<string, unknown>) {
    setChyba(null);
    setPracuje(true);
    const res = await fetch(cesta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, poznamka, ...telo }),
    });
    const odpoved = await res.json().catch(() => ({}));
    setPracuje(false);

    if (!res.ok) {
      setChyba(odpoved.error ?? "Nepodařilo se to uložit.");
      return;
    }

    setPoznamka("");
    setOtevreno(false);
    router.refresh();
  }

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        Spravovat
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor={`role-${userId}`}
            className="text-xs text-zinc-600 dark:text-zinc-400"
          >
            Role
          </label>
          <select
            id={`role-${userId}`}
            value={novaRole}
            onChange={(e) => setNovaRole(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ROLE_VOLBY.map((r) => (
              <option key={r.hodnota} value={r.hodnota}>
                {r.popis}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-[2] flex-col gap-1">
          <label
            htmlFor={`poznamka-${userId}`}
            className="text-xs text-zinc-600 dark:text-zinc-400"
          >
            Poznámka (volitelná, uvidí ji jen tvoje firma)
          </label>
          <input
            id={`poznamka-${userId}`}
            type="text"
            maxLength={500}
            value={poznamka}
            onChange={(e) => setPoznamka(e.target.value)}
            placeholder="Např. odešel z firmy k 31. 8."
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pracuje || novaRole === role}
          onClick={() => posli("/api/team/role", { role: novaRole })}
          className="rounded bg-brand-solid px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Uložit roli
        </button>

        {!pozastaveno &&
          (status === "active" ? (
            <button
              type="button"
              disabled={pracuje}
              onClick={() => posli("/api/team/access", { status: "deactivated" })}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {jaSam ? "Odebrat přístup sobě" : "Odebrat přístup"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pracuje}
              onClick={() => posli("/api/team/access", { status: "active" })}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Vrátit přístup
            </button>
          ))}

        <button
          type="button"
          onClick={() => {
            setOtevreno(false);
            setChyba(null);
            setNovaRole(role);
            setPoznamka("");
          }}
          className="text-xs text-zinc-600 underline dark:text-zinc-400"
        >
          Zavřít
        </button>
      </div>

      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
    </div>
  );
}
