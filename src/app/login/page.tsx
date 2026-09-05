"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { MIN_DELKA_HESLA, NAPOVEDA_K_HESLU } from "@/lib/heslo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupConfirmationSent, setSignupConfirmationSent] = useState(false);
  const [signupAlreadyExists, setSignupAlreadyExists] = useState(false);

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
        setError(translateAuthError(error.message));
        return;
      }
      setResetSent(true);
      return;
    }

    if (mode === "signup" && password !== passwordAgain) {
      setLoading(false);
      setError("Hesla se neshodují.");
      return;
    }

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }

    if (mode === "signup" && !data.session) {
      // Supabase vrací prázdné pole identities, když e-mail už existuje
      // (ochrana proti zjišťování registrovaných e-mailů) - nový účet
      // má vždy aspoň jednu identitu.
      if (data.user && data.user.identities?.length === 0) {
        setSignupAlreadyExists(true);
      } else {
        setSignupConfirmationSent(true);
      }
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
        ) : mode === "signup" && signupConfirmationSent ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Registrace proběhla. Na adresu <strong className="text-black dark:text-zinc-50">{email}</strong>{" "}
            jsme poslali potvrzovací e-mail — klikni na odkaz v něm a pak se přihlas.
          </p>
        ) : mode === "signup" && signupAlreadyExists ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tenhle e-mail už je zaregistrovaný. Pokud ještě není potvrzený,
            poslali jsme na něj nový potvrzovací odkaz — zkontroluj schránku.
            Pokud potvrzený už je, zkus se rovnou přihlásit.
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
              <div className="flex flex-col gap-2">
                {/* Obal `relative` obepíná JEN vstupní pole. Když v něm byla
                    i nápověda pod ním, tlačítko „Zobrazit" se centrovalo na
                    celý blok a přeleželo přes text. */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    // Při přihlašování se délka nekontroluje: stávající účet
                    // může mít heslo z doby, kdy platilo nižší minimum, a
                    // prohlížeč by mu bránil se vůbec přihlásit.
                    minLength={mode === "signup" ? MIN_DELKA_HESLA : undefined}
                    placeholder="Heslo"
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

                {mode === "signup" && (
                  <>
                    {/* Heslo se zadává dvakrát jen tam, kde se ZAKLÁDÁ.
                        Překlep při přihlašování se pozná hned, překlep při
                        zakládání až za den, kdy se nejde přihlásit. */}
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={MIN_DELKA_HESLA}
                      placeholder="Heslo znovu"
                      value={passwordAgain}
                      onChange={(e) => setPasswordAgain(e.target.value)}
                      className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {NAPOVEDA_K_HESLU}
                    </p>
                  </>
                )}
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
        ) : mode === "signup" && signupConfirmationSent ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSignupConfirmationSent(false);
              setMode("signin");
            }}
            className="text-sm text-zinc-500 underline"
          >
            Zpět na přihlášení
          </button>
        ) : mode === "signup" && signupAlreadyExists ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSignupAlreadyExists(false);
              setMode("signin");
            }}
            className="text-sm text-zinc-500 underline"
          >
            Zpět na přihlášení
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // E-mail se ZÁMĚRNĚ nemaže: nejčastější důvod, proč člověk
              // na registraci přepíná, je právě to, že přihlášení neprošlo.
              // Nutit ho psát adresu znovu by bylo horší, ne lepší.
              //
              // Heslo ano — kdo se při přihlašování překlepne a přepne na
              // registraci, založil by si účet s tím překlepem. Při
              // zakládání hesla má být ten úhoz vědomý.
              setError(null);
              setPassword("");
              setPasswordAgain("");
              setMode(mode === "signup" ? "signin" : "signup");
            }}
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
