"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { MIN_DELKA_HESLA, NAPOVEDA_K_HESLU } from "@/lib/heslo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Jeden přepínač pro obě pole. Nové heslo se zadává naslepo dvakrát —
  // bez možnosti se na něj podívat se překlep pozná až tím, že se pak
  // nejde přihlásit. Stejné chování má i přihlašovací stránka.
  const [showPassword, setShowPassword] = useState(false);
  // Bez relace z e-mailového odkazu nejde heslo změnit. Zjistit se to musí
  // HNED — dřív se formulář ukázal vždycky a uživatel se to dozvěděl až
  // potom, co dvakrát naslepo vyťukal nové heslo a dostal chybu.
  const [maRelaci, setMaRelaci] = useState<boolean | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setMaRelaci(!!data.session));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }

    setDone(true);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Nové heslo</h1>

        {maRelaci === null ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Ověřuju odkaz…</p>
        ) : !maRelaci ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tenhle odkaz na obnovu hesla už neplatí — buď vypršel, nebo byl
              použitý. Nech si prosím poslat nový.
            </p>
            <Link href="/login" className="text-sm text-brand underline">
              Zpět na přihlášení
            </Link>
          </>
        ) : done ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Heslo bylo změněno.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Pokračovat do aplikace
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Obal `relative` obepíná JEN vstupní pole, jinak by se tlačítko
                centrovalo na celý blok a přeleželo přes text pod ním. */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={MIN_DELKA_HESLA}
                placeholder="Nové heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 pr-16 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                {showPassword ? "Skrýt" : "Zobrazit"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={MIN_DELKA_HESLA}
              placeholder="Nové heslo znovu"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />

            <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {NAPOVEDA_K_HESLU}
            </p>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Chvilku…" : "Nastavit heslo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
