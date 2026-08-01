/**
 * Browser-safe Supabase public env.
 *
 * Next.js only inlines NEXT_PUBLIC_* into the client bundle when accessed
 * via static property reads on process.env (not via env[name], copied
 * objects, or injectable ProcessEnv parameters).
 *
 * Do not import server helpers, service-role keys, or Node-only modules here.
 */

import {
  SupabaseConfigError,
  logSupabaseConfigError,
} from "@/lib/supabase/config-errors";

export type SupabasePublicKeySource = "publishable" | "anon";

export type BrowserSupabasePublicEnvDiagnostics = {
  hasUrl: boolean;
  hasPublishableKey: boolean;
  hasAnonKey: boolean;
  hasAppUrl: boolean;
};

/** Presence flags only — never log secret values. */
export function getBrowserSupabasePublicEnvDiagnostics(): BrowserSupabasePublicEnvDiagnostics {
  return {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasPublishableKey: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    ),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  };
}

export function resolveBrowserSupabaseUrl(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const trimmed = supabaseUrl?.trim();
  return trimmed || null;
}

/**
 * Prefer publishable key; fall back to legacy anon key.
 * Both property names are referenced statically for Next.js inlining.
 */
export function resolveBrowserSupabasePublicKey(): string | null {
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const trimmed = supabasePublicKey?.trim();
  return trimmed || null;
}

export function resolveBrowserSupabasePublicKeySource(): SupabasePublicKeySource | null {
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    return "publishable";
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "anon";
  }
  return null;
}

export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(
    resolveBrowserSupabaseUrl() && resolveBrowserSupabasePublicKey(),
  );
}

export type ResolvedBrowserSupabaseConfig = {
  url: string;
  key: string;
  keySource: SupabasePublicKeySource;
};

export function requireBrowserSupabaseConfig(): ResolvedBrowserSupabaseConfig {
  const url = resolveBrowserSupabaseUrl();
  if (!url) {
    const error = new SupabaseConfigError(
      "missing_url",
      "Missing NEXT_PUBLIC_SUPABASE_URL.",
    );
    logSupabaseConfigError(error);
    throw error;
  }

  const key = resolveBrowserSupabasePublicKey();
  const keySource = resolveBrowserSupabasePublicKeySource();
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
