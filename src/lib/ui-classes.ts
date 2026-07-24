// Sdílené třídy pro formulářové prvky napříč appkou (upload/šablony/nastavení) -
// aby tlačítka, selecty a odkazy vypadaly všude stejně, ne každý soubor jinak.

export const PRIMARY_BUTTON =
  "rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-ink disabled:opacity-50";

export const SECONDARY_BUTTON =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export const SELECT_INPUT =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";

export const SELECT_INPUT_SM =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";

export const TEXT_INPUT = SELECT_INPUT;

export const BACK_LINK =
  "text-sm text-zinc-500 hover:text-brand dark:hover:text-brand-light";

export const SPINNER =
  "h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-brand dark:border-zinc-700";

export const STEP_EYEBROW = "text-sm font-medium tracking-wide text-brand uppercase";
