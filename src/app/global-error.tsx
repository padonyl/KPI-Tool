"use client";

import { useEffect } from "react";

// [07] Lehká záchranná síť bez externí závislosti (Sentry apod. zatím
// není zapojené, viz mapa projektu oblast 04) - alespoň se loguje na
// server a uživatel nevidí syrovou chybovou stránku Next.js.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="cs">
      <body className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Něco se nepovedlo
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Zkus to prosím znovu. Pokud to nepomůže, dej nám vědět.
          </p>
          <button
            onClick={reset}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  );
}
