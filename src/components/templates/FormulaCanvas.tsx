"use client";

import { useRef, useState } from "react";
import type { SlotToken } from "@/lib/formula";
import { formatNumber } from "@/lib/format-number";

// ============================================================
// Plátno pro skládání výrazu slotu.
//
// Prvky se přetahují z palety dole na plátno a dají se na plátně přerovnávat.
// Vedle drag and dropu funguje i klik na prvek v paletě (připne se na konec) -
// je to rychlejší při skládání zleva doprava a zároveň to dává cestu bez myši.
// ============================================================

type DragPayload =
  | { from: "palette"; token: SlotToken }
  | { from: "canvas"; token: SlotToken; index: number };

type Props = {
  tokens: SlotToken[];
  columns: string[];
  onChange: (tokens: SlotToken[]) => void;
  error?: string | null;
  previewValue?: number | null;
};

const OPERATORS: { token: SlotToken; glyph: string; title: string }[] = [
  { token: { kind: "op", value: "+" }, glyph: "+", title: "sečíst" },
  { token: { kind: "op", value: "-" }, glyph: "−", title: "odečíst" },
  { token: { kind: "op", value: "*" }, glyph: "×", title: "vynásobit" },
  { token: { kind: "op", value: "/" }, glyph: "÷", title: "vydělit" },
];

const PARENS: { token: SlotToken; glyph: string; title: string }[] = [
  { token: { kind: "lparen" }, glyph: "(", title: "otevřít závorku" },
  { token: { kind: "rparen" }, glyph: ")", title: "zavřít závorku" },
];

function tokenGlyph(token: SlotToken): string {
  if (token.kind === "column") return token.column;
  if (token.kind === "num") return String(token.value);
  if (token.kind === "lparen") return "(";
  if (token.kind === "rparen") return ")";
  return { "+": "+", "-": "−", "*": "×", "/": "÷" }[token.value];
}

export function FormulaCanvas({
  tokens,
  columns,
  onChange,
  error,
  previewValue,
}: Props) {
  const dragPayload = useRef<DragPayload | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");

  function startDrag(payload: DragPayload, e: React.DragEvent) {
    dragPayload.current = payload;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    // Firefox nespustí drag bez nastavených dat.
    e.dataTransfer.setData("text/plain", tokenGlyph(payload.token));
  }

  function endDrag() {
    dragPayload.current = null;
    setDropIndex(null);
    setIsDragging(false);
  }

  function handleDrop(targetIndex: number) {
    const payload = dragPayload.current;
    endDrag();
    if (!payload) return;

    if (payload.from === "palette") {
      const next = [...tokens];
      next.splice(targetIndex, 0, payload.token);
      onChange(next);
      return;
    }

    // přerovnání na plátně
    if (targetIndex === payload.index || targetIndex === payload.index + 1) return;
    const next = [...tokens];
    next.splice(payload.index, 1);
    next.splice(targetIndex > payload.index ? targetIndex - 1 : targetIndex, 0, payload.token);
    onChange(next);
  }

  function append(token: SlotToken) {
    onChange([...tokens, token]);
  }

  function removeAt(index: number) {
    onChange(tokens.filter((_, i) => i !== index));
  }

  function addNumber() {
    const parsed = Number(numberDraft.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    append({ kind: "num", value: parsed });
    setNumberDraft("");
  }

  /** Úzká mezera mezi prvky, která se při přetahování roztáhne na cíl. */
  function DropZone({ index }: { index: number }) {
    const active = dropIndex === index;
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropIndex(index);
        }}
        onDragLeave={() => setDropIndex((cur) => (cur === index ? null : cur))}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(index);
        }}
        className={[
          "self-stretch rounded-full transition-all",
          active ? "w-10 bg-brand/30" : isDragging ? "w-4 bg-brand/5" : "w-1",
        ].join(" ")}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------- PLÁTNO ---------------- */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dropIndex === null) handleDrop(tokens.length);
        }}
        className={[
          "min-h-[104px] rounded-xl border-2 p-3 transition-colors",
          error
            ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
            : isDragging
              ? "border-brand border-dashed bg-brand/5"
              : "border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40",
        ].join(" ")}
      >
        {tokens.length === 0 ? (
          <div className="flex h-[80px] items-center justify-center text-center text-xs text-zinc-400">
            Přetáhni sem sloupec z palety níže — nebo na něj klikni.
          </div>
        ) : (
          <div className="flex flex-wrap items-stretch gap-y-2">
            <DropZone index={0} />
            {tokens.map((token, i) => (
              <div key={i} className="flex items-stretch">
                <div
                  draggable
                  onDragStart={(e) => startDrag({ from: "canvas", token, index: i }, e)}
                  onDragEnd={endDrag}
                  className={[
                    "group relative flex cursor-grab items-center rounded-lg border-2 px-3 py-2 text-sm active:cursor-grabbing",
                    token.kind === "column"
                      ? "border-brand/50 bg-white font-medium text-brand-ink shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                      : token.kind === "num"
                        ? "border-zinc-300 bg-white font-mono text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        : token.kind === "op"
                          ? "border-transparent bg-transparent px-2 text-xl text-zinc-500"
                          : "border-transparent bg-transparent px-1 text-xl text-zinc-400",
                  ].join(" ")}
                >
                  {tokenGlyph(token)}
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    title="Odebrat"
                    className="absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white shadow group-hover:flex"
                  >
                    ×
                  </button>
                </div>
                <DropZone index={i + 1} />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {!error && previewValue !== null && previewValue !== undefined && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Z celého souboru vychází{" "}
          <span className="font-mono font-semibold text-brand-ink dark:text-zinc-100">
            {formatNumber(previewValue)}
          </span>
        </p>
      )}

      {/* ---------------- PALETA ---------------- */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Paleta — táhni na plátno nebo klikni
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[...OPERATORS, ...PARENS].map((item, i) => (
            <button
              key={i}
              type="button"
              draggable
              onDragStart={(e) => startDrag({ from: "palette", token: item.token }, e)}
              onDragEnd={endDrag}
              onClick={() => append(item.token)}
              title={item.title}
              className="h-10 w-10 cursor-grab rounded-lg border border-zinc-300 bg-zinc-50 text-xl text-zinc-600 transition-colors hover:border-brand hover:text-brand active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {item.glyph}
            </button>
          ))}

          <span className="mx-1 h-8 w-px bg-zinc-200 dark:bg-zinc-800" />

          <input
            type="text"
            inputMode="decimal"
            value={numberDraft}
            onChange={(e) => setNumberDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNumber();
              }
            }}
            placeholder="číslo"
            className="h-10 w-24 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={addNumber}
            disabled={numberDraft.trim() === ""}
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-600 transition-colors hover:border-brand hover:text-brand disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            přidat
          </button>
        </div>

        <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Sloupce ze zdrojového souboru
        </p>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {columns.map((column) => (
            <button
              key={column}
              type="button"
              draggable
              onDragStart={(e) =>
                startDrag({ from: "palette", token: { kind: "column", column } }, e)
              }
              onDragEnd={endDrag}
              onClick={() => append({ kind: "column", column })}
              className="cursor-grab rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-sm text-brand-ink transition-colors hover:border-brand hover:bg-brand/10 active:cursor-grabbing dark:text-zinc-100"
            >
              {column}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
