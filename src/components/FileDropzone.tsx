"use client";

import { useState } from "react";

type Props = {
  file: File | null;
  onFileSelected: (file: File) => void;
};

export function FileDropzone({ file, onFileSelected }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragging
          ? "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900"
          : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
      }`}
    >
      <span className="text-sm font-medium">
        {file ? file.name : "Přetáhni sem soubor, nebo klikni a vyber"}
      </span>
      <span className="text-xs text-zinc-500">Excel (.xlsx) nebo CSV</span>
      <input
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onFileSelected(selected);
        }}
        className="hidden"
      />
    </label>
  );
}
