// Supabase client para uso no SERVIDOR (Server Components, Route Handlers)
// Usa a service_role key para bypassar RLS em operações server-side
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}