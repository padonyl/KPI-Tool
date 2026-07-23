import type { SupabaseClient } from "@supabase/supabase-js";

// [15] Lehký aktivitní log - viz kpi_tool_schema.sql, sekce 14.
// Chyba při logování nesmí shodit hlavní akci (upload, pozvánku...),
// proto se chyba jen tiše zaznamená do konzole, ne že by vyhodila.
export async function logActivity(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    userId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("activity_log").insert({
    company_id: params.companyId,
    user_id: params.userId ?? null,
    action: params.action,
    metadata: params.metadata ?? null,
  });

  if (error) {
    console.error("[activity_log]", params.action, error.message);
  }
}
