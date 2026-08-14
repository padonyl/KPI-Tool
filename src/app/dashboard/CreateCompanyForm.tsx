"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; label: string };

type Props = {
  authUserId: string;
  email: string;
  sectors: Option[];
  sizeBands: Option[];
};

export function CreateCompanyForm({
  authUserId,
  email,
  sectors,
  sizeBands,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [sizeBandId, setSizeBandId] = useState(sizeBands[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Zadej název firmy (minimálně 2 znaky).");
      return;
    }
    if (trimmedName.length > 120) {
      setError("Název firmy je moc dlouhý (max 120 znaků).");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // id generujeme tady, ne v databázi - appka se tak po vložení
    // řádku nemusí ptát na jeho vrácení zpátky (.select()), což by
    // narazilo na RLS "Users see own company" politiku: v tuhle
    // chvíli ještě uživatel na žádnou firmu napojený není, takže by
    // nově vloženou firmu nesměl ani přečíst, i když ji sám založil.
    const companyId = crypto.randomUUID();

    const { error: companyError } = await supabase.from("companies").insert({
      id: companyId,
      name: trimmedName,
      sector_id: sectorId,
      size_band_id: sizeBandId,
      country: "CZ",
    });

    if (companyError) {
      setError(`Nepodařilo se založit firmu: ${companyError.message}`);
      setLoading(false);
      return;
    }

    const { error: userError } = await supabase.from("users").insert({
      auth_user_id: authUserId,
      company_id: companyId,
      email,
      role: "customer_admin",
    });

    if (userError) {
      setError(`Firma založena, ale napojení uživatele selhalo: ${userError.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:p-8"
    >
      <div>
        <h2 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">
          Založit firmu
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Tento účet zatím není napojený na žádnou firmu — vyplň základní
          údaje, ať s ním můžeš pracovat.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Název firmy
        <input
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Sektor
        <select
          value={sectorId}
          onChange={(e) => setSectorId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Velikost firmy
        <select
          value={sizeBandId}
          onChange={(e) => setSizeBandId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {sizeBands.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {loading ? "Zakládám…" : "Založit firmu"}
      </button>
    </form>
  );
}
