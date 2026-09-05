"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // Hláška o odeslané pozvánce sama zmizí.
  //
  // Dřív zůstávala svítit napořád — uživatel pak odebral někomu přístup a
  // nad formulářem pořád stálo „Pozvánka odeslána", takže to vypadalo,
  // že se odeslala znovu. Potvrzení akce má mít stejně krátký život jako
  // ta akce.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 6000);
    return () => clearTimeout(t);
  }, [sent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setLoading(true);

    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Pozvání se nepodařilo.");
      return;
    }

    // Opětovné pozvání dřív odebraného kolegu vrací, nezakládá nového —
    // hláška to má říct, jinak si admin myslí, že vznikl druhý účet.
    setSent(
      body.obnoveno
        ? `${email} má přístup zpátky.`
        : `Pozvánka pro ${email} odeslána.`,
    );
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Hlášky jsou POD řádkem s poli, ne v něm. Když byly uvnitř, tlačil
          je flex do zbytku místa vedle tlačítka a text přetékal. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="pozvat-email" className="text-xs text-zinc-600 dark:text-zinc-400">
            E-mail kolegy
          </label>
          <input
            id="pozvat-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent(null);
              setError(null);
            }}
            placeholder="kolega@firma.cz"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pozvat-role" className="text-xs text-zinc-600 dark:text-zinc-400">
            Role
          </label>
          <select
            id="pozvat-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="user">Uživatel (jen čtení)</option>
            <option value="customer_superuser">Superuser (nahrává data)</option>
            <option value="customer_admin">Admin (mapuje a nastavuje)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
        >
          {loading ? "Odesílám…" : "Pozvat"}
        </button>
      </div>

      {sent && (
        <p className="text-sm text-green-700 dark:text-green-400">{sent}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
