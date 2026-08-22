"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/lib/ui-classes";

// Tlačítka pro schválení a zamítnutí firmy v admin prostředí.
//
// Zamítnutí se ptá na potvrzení, schválení ne. Důvod: schválení se dá
// vzít zpět zamítnutím, ale zamítnutá firma se o tom dozví tím, že ji
// aplikace nepustí dál — a to je nepříjemnější než opačná chyba.

export function RozhodnutiOFirme({
  companyId,
  stav,
  nazev,
}: {
  companyId: string;
  stav: string;
  nazev: string;
}) {
  const router = useRouter();
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function rozhodni(akce: "approve" | "reject") {
    if (akce === "reject" && !confirm(`Opravdu zamítnout firmu „${nazev}"?`)) {
      return;
    }

    setPracuje(true);
    setChyba(null);

    try {
      const odpoved = await fetch("/api/admin/stav", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, akce }),
      });

      if (!odpoved.ok) {
        const telo = await odpoved.json().catch(() => ({}));
        setChyba(telo.error ?? `Nepodařilo se uložit (${odpoved.status}).`);
        return;
      }

      router.refresh();
    } catch {
      setChyba("Nepodařilo se spojit se serverem.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {stav !== "approved" && (
          <button
            onClick={() => rozhodni("approve")}
            disabled={pracuje}
            className={PRIMARY_BUTTON}
          >
            Schválit
          </button>
        )}
        {stav !== "rejected" && (
          <button
            onClick={() => rozhodni("reject")}
            disabled={pracuje}
            className={SECONDARY_BUTTON}
          >
            Zamítnout
          </button>
        )}
      </div>
      {chyba && (
        <span className="text-xs text-red-600 dark:text-red-400">{chyba}</span>
      )}
    </div>
  );
}
