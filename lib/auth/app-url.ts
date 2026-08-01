import {
  SupabaseConfigError,
  logSupabaseConfigError,
} from "@/lib/supabase/env";

/**
 * Resolves the public app origin used for auth redirects.
 *
 * - Prefers NEXT_PUBLIC_APP_URL (required outside local development).
 * - Allows a localhost default only when NODE_ENV === "development".
 * - Rejects localhost origins on deployed / production builds.
 */
export function getAppOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  const isDevelopment = env.NODE_ENV === "development";

  if (configured) {
    let origin: string;
    try {
      origin = new URL(configured).origin;
    } catch {
      const error = new SupabaseConfigError(
        "invalid_app_url",
        `NEXT_PUBLIC_APP_URL is not a valid URL: ${configured}`,
      );
      logSupabaseConfigError(error);
      throw error;
    }

    if (!isDevelopment && isLocalhostOrigin(origin)) {
      const error = new SupabaseConfigError(
        "invalid_app_url",
        "NEXT_PUBLIC_APP_URL must not point to localhost outside development. Set it to your deployed app URL (e.g. https://your-app.vercel.app).",
      );
      logSupabaseConfigError(error);
      throw error;
    }
    return origin.replace(/\/$/, "");
  }

  if (isDevelopment) {
    return "http://localhost:3000";
  }

  const error = new SupabaseConfigError(
    "invalid_app_url",
    "NEXT_PUBLIC_APP_URL is required. Set it to your deployed app origin (e.g. https://your-app.vercel.app).",
  );
  logSupabaseConfigError(error);
  throw error;
}

/** Magic-link landing path: ${NEXT_PUBLIC_APP_URL}/auth/callback */
export function getMagicLinkRedirectTo(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${getAppOrigin(env)}/auth/callback`;
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}
