"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
    </svg>
  );
}

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Opravdu smazat šablonu „${templateName}“? Tohle nejde vzít zpět.`)) {
      return;
    }

    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("upload_templates").delete().eq("id", templateId);
    setDeleting(false);

    if (error) {
      alert(`Šablonu se nepodařilo smazat: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Smazat šablonu"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-[#d03b3b]/10 hover:text-[#d03b3b] disabled:opacity-50"
    >
      <TrashIcon />
    </button>
  );
}
