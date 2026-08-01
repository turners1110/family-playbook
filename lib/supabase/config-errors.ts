/**
 * Shared Supabase config errors / logging.
 * Safe to import from browser and server (no env access, no Node APIs).
 */

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
