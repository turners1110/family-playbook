/**
 * Admin / service-role client.
 *
 * ONLY import from trusted setup, seed, or admin scripts.
 * Do NOT import from client components, pages, ordinary server actions,
 * or normal application services.
 */
import { createClient } from "@supabase/supabase-js";

export function hasSupabaseAdminConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** @deprecated Use hasSupabaseAdminConfig — kept for temporary callers during migration. */
export function hasSupabaseServerConfig() {
  return hasSupabaseAdminConfig();
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase admin env vars are not configured.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
