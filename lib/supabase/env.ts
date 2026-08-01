/**
 * Shared resolution of public Supabase env for user-scoped clients.
 * Prefer the newer publishable key; fall back to the legacy anon key.
 */

export type SupabasePublicKeySource = "publishable" | "anon";

export type SupabaseConfigReason =
  | "missing_url"
  | "missing_public_key"
  | "invalid_app_url";

export class SupabaseConfigError extends Error {
  reason: SupabaseConfigReason;

  constructor(reason: SupabaseConfigReason, message: string) {
    super(message);
    this.name = "SupabaseConfigError";
    this.reason = reason;
  }
}

/** Generic copy safe to show in the browser. */
export const SUPABASE_CONFIG_USER_MESSAGE =
  "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.";

export function resolveSupabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || null;
}

/**
 * Public API key for browser/server user clients.
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

/** @alias hasSupabasePublicConfig — used by browser client module. */
export function hasSupabaseBrowserConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return hasSupabasePublicConfig(env);
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

export function logSupabaseConfigError(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    console.error("[supabase] config error", {
      reason: error.reason,
      message: error.message,
    });
    return;
  }
  console.error("[supabase] config error", {
    reason: "unknown",
    message: error instanceof Error ? error.message : String(error),
  });
}
