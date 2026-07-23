"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setResetSent(true);
      return;
    }

    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {mode === "signup" ? "Registrace" : mode === "forgot" ? "Obnova hesla" : "Přihlášení"}
        </h1>

        {mode === "forgot" && resetSent ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pokud e-mail existuje, poslali jsme na něj odkaz na nastavení nového hesla.
          </p>
        ) : (
          <>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />

            {mode !== "forgot" && (
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Heslo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-2 pr-16 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                >
                  {showPassword ? "Skrýt" : "Zobrazit"}
                </button>
              </div>
            )}

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("forgot");
                }}
                className="self-start text-xs text-zinc-500 underline"
              >
                Zapomenuté heslo?
              </button>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading
                ? "Chvilku…"
                : mode === "signup"
                  ? "Zaregistrovat se"
                  : mode === "forgot"
                    ? "Poslat odkaz na obnovu"
                    : "Přihlásit se"}
            </button>
          </>
        )}

        {mode === "forgot" ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResetSent(false);
              setMode("signin");
            }}
            className="text-sm text-zinc-500 underline"
          >
            Zpět na přihlášení
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-sm text-zinc-500 underline"
          >
            {mode === "signup"
              ? "Už máš účet? Přihlásit se"
              : "Nemáš účet? Zaregistrovat se"}
          </button>
        )}
      </form>
    </div>
  );
}
