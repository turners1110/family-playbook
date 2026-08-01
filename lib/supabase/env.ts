/**
 * Server-side Supabase public env resolution.
 *
 * Accepts an optional ProcessEnv for unit tests. Production server/edge code
 * should call without args so values come from the live process environment.
 *
 * Browser / client components must use `@/lib/supabase/browser-env` instead —
 * injectable `env.NEXT_PUBLIC_*` access is not inlined into client bundles.
 */

import {
  SupabaseConfigError,
  logSupabaseConfigError,
} from "@/lib/supabase/config-errors";

export type { SupabaseConfigReason } from "@/lib/supabase/config-errors";
export {
  SupabaseConfigError,
  SUPABASE_CONFIG_USER_MESSAGE,
  logSupabaseConfigError,
} from "@/lib/supabase/config-errors";

export type SupabasePublicKeySource = "publishable" | "anon";

export function resolveSupabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || null;
}

/**
 * Public API key for server user clients.
 * Order: PUBLISHABLE_KEY, then ANON_KEY.
 */
export function resolveSupabasePublicKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) return publishable;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon) return anon;
  return null;
}

export function resolveSupabasePublicKeySource(
  env: NodeJS.ProcessEnv = process.env,
): SupabasePublicKeySource | null {
  if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) return "publishable";
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) return "anon";
  return null;
}

export function hasSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(resolveSupabaseUrl(env) && resolveSupabasePublicKey(env));
}

export type ResolvedSupabasePublicConfig = {
  url: string;
  key: string;
  keySource: SupabasePublicKeySource;
};

/**
 * Resolves URL + public key or throws SupabaseConfigError.
 * Logs a specific reason for operators; callers should show generic UI copy.
 */
export function requireSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedSupabasePublicConfig {
  const url = resolveSupabaseUrl(env);
  if (!url) {
    const error = new SupabaseConfigError(
      "missing_url",
      "Missing NEXT_PUBLIC_SUPABASE_URL.",
    );
    logSupabaseConfigError(error);
    throw error;
  }

  const key = resolveSupabasePublicKey(env);
  const keySource = resolveSupabasePublicKeySource(env);
  if (!key || !keySource) {
    const error = new SupabaseConfigError(
      "missing_public_key",
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    logSupabaseConfigError(error);
    throw error;
  }

  return { url, key, keySource };
}
