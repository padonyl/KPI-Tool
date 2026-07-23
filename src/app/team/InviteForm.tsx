"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Pozvání se nepodařilo.");
      return;
    }

    setSent(true);
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs text-zinc-500 dark:text-zinc-400">E-mail kolegy</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kolega@firma.cz"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 dark:text-zinc-400">Role</label>
        <select
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
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Odesílám…" : "Pozvat"}
      </button>

      {sent && <p className="text-sm text-green-600 dark:text-green-400">Pozvánka odeslána.</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
