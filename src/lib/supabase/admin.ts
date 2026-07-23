import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// [01c] Service-role klient - POUZE pro server-side použití (API routes),
// nikdy neimportovat z klientské komponenty. Obchází RLS úplně, proto
// se používá jen tam, kde appka sama ověří oprávnění (viz /api/team/invite).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
