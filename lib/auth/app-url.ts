import {
  SupabaseConfigError,
  logSupabaseConfigError,
} from "@/lib/supabase/config-errors";

export type AppOriginSource =
  | "page_origin"
  | "next_public_app_url"
  | "next_public_vercel_url"
  | "localhost_default";

export type AppOriginResolution = {
  origin: string;
  source: AppOriginSource;
  /** Hostname of the current browser page, when known. */
  pageHost: string | null;
  /** Hostname from NEXT_PUBLIC_APP_URL, when set. */
  configuredAppUrlHost: string | null;
  /** Hostname from NEXT_PUBLIC_VERCEL_URL, when set. */
  vercelUrlHost: string | null;
  /** True when page host and configured NEXT_PUBLIC_APP_URL host differ. */
  mismatch: boolean;
  redirectHost: string;
};

export type ResolveAppOriginOptions = {
  /** Unit-test env override only. */
  env?: NodeJS.ProcessEnv;
  /**
   * Browser page origin (`window.location.origin`).
   * Prefer this on Preview so branch deployments redirect to themselves
   * even if NEXT_PUBLIC_APP_URL still points at another branch.
   */
  pageOrigin?: string | null;
};

function readEnv(env: NodeJS.ProcessEnv | undefined, key: string): string | undefined {
  if (env) return env[key];
  // Static reads so Next can inline NEXT_PUBLIC_* into the client bundle.
  if (key === "NEXT_PUBLIC_APP_URL") return process.env.NEXT_PUBLIC_APP_URL;
  if (key === "NEXT_PUBLIC_VERCEL_URL") return process.env.NEXT_PUBLIC_VERCEL_URL;
  if (key === "NODE_ENV") return process.env.NODE_ENV;
  return undefined;
}

function hostFromUrlish(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value.trim()
      : `https://${value.trim()}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

function originFromUrlish(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value)
    ? value.trim()
    : `https://${value.trim()}`;
  return new URL(withProtocol).origin.replace(/\/$/, "");
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

function isDevelopment(env?: NodeJS.ProcessEnv): boolean {
  return readEnv(env, "NODE_ENV") === "development";
}

function browserPageOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.location.origin;
  } catch {
    return null;
  }
}

/**
 * Safe host-only diagnostics for auth redirect troubleshooting.
 * Never includes secrets, tokens, or full redirect URLs with query strings.
 */
export function getAppOriginDiagnostics(
  options: ResolveAppOriginOptions = {},
): {
  source: AppOriginSource;
  pageHost: string | null;
  configuredAppUrlHost: string | null;
  vercelUrlHost: string | null;
  mismatch: boolean;
  redirectHost: string;
  hasConfiguredAppUrl: boolean;
} {
  const resolution = resolveAppOrigin(options);
  return {
    source: resolution.source,
    pageHost: resolution.pageHost,
    configuredAppUrlHost: resolution.configuredAppUrlHost,
    vercelUrlHost: resolution.vercelUrlHost,
    mismatch: resolution.mismatch,
    redirectHost: resolution.redirectHost,
    hasConfiguredAppUrl: Boolean(resolution.configuredAppUrlHost),
  };
}

/**
 * Resolves the public app origin used for auth redirects.
 *
 * Priority (non-development):
 * 1. Browser page origin when present and not localhost (current deployment)
 * 2. NEXT_PUBLIC_APP_URL when set and not localhost
 * 3. NEXT_PUBLIC_VERCEL_URL (Vercel deployment host)
 *
 * Development keeps localhost only.
 */
export function resolveAppOrigin(
  options: ResolveAppOriginOptions = {},
): AppOriginResolution {
  const env = options.env;
  const pageOrigin =
    options.pageOrigin !== undefined
      ? options.pageOrigin
      : browserPageOrigin();
  const configuredRaw = readEnv(env, "NEXT_PUBLIC_APP_URL")?.trim() || null;
  const vercelRaw = readEnv(env, "NEXT_PUBLIC_VERCEL_URL")?.trim() || null;
  const pageHost = hostFromUrlish(pageOrigin ?? null);
  const configuredAppUrlHost = hostFromUrlish(configuredRaw);
  const vercelUrlHost = hostFromUrlish(vercelRaw);
  const mismatch = Boolean(
    pageHost && configuredAppUrlHost && pageHost !== configuredAppUrlHost,
  );

  const finish = (
    origin: string,
    source: AppOriginSource,
  ): AppOriginResolution => ({
    origin,
    source,
    pageHost,
    configuredAppUrlHost,
    vercelUrlHost,
    mismatch,
    redirectHost: hostFromUrlish(origin) ?? origin,
  });

  if (isDevelopment(env)) {
    if (pageOrigin && isLocalhostOrigin(pageOrigin)) {
      return finish(
        new URL(pageOrigin).origin.replace(/\/$/, ""),
        "page_origin",
      );
    }
    if (configuredRaw) {
      try {
        const origin = originFromUrlish(configuredRaw);
        if (isLocalhostOrigin(origin)) {
          return finish(origin, "next_public_app_url");
        }
      } catch {
        /* fall through to localhost default */
      }
    }
    return finish("http://localhost:3000", "localhost_default");
  }

  // Preview / Production: prefer the live page host so branch Preview
  // deployments are not stuck on a stale NEXT_PUBLIC_APP_URL from another branch.
  if (pageOrigin) {
    try {
      const origin = new URL(pageOrigin).origin.replace(/\/$/, "");
      if (!isLocalhostOrigin(origin)) {
        return finish(origin, "page_origin");
      }
      const error = new SupabaseConfigError(
        "invalid_app_url",
        "App origin must not point to localhost outside development. Set NEXT_PUBLIC_APP_URL to your deployed app URL.",
      );
      logSupabaseConfigError(error);
      throw error;
    } catch (error) {
      if (error instanceof SupabaseConfigError) throw error;
      /* invalid pageOrigin — continue */
    }
  }

  if (configuredRaw) {
    try {
      const origin = originFromUrlish(configuredRaw);
      if (isLocalhostOrigin(origin)) {
        const error = new SupabaseConfigError(
          "invalid_app_url",
          "NEXT_PUBLIC_APP_URL must not point to localhost outside development. Set it to your deployed app URL (e.g. https://your-app.vercel.app).",
        );
        logSupabaseConfigError(error);
        throw error;
      }
      return finish(origin, "next_public_app_url");
    } catch (error) {
      if (error instanceof SupabaseConfigError) throw error;
      const invalid = new SupabaseConfigError(
        "invalid_app_url",
        `NEXT_PUBLIC_APP_URL is not a valid URL: ${configuredRaw}`,
      );
      logSupabaseConfigError(invalid);
      throw invalid;
    }
  }

  if (vercelRaw) {
    try {
      const origin = originFromUrlish(vercelRaw);
      if (!isLocalhostOrigin(origin)) {
        return finish(origin, "next_public_vercel_url");
      }
    } catch {
      /* fall through */
    }
  }

  const error = new SupabaseConfigError(
    "invalid_app_url",
    "NEXT_PUBLIC_APP_URL is required. Set it to your deployed app origin (e.g. https://your-app.vercel.app).",
  );
  logSupabaseConfigError(error);
  throw error;
}

/**
 * Resolves the public app origin used for auth redirects.
 * An explicit `env` argument is for unit tests only.
 */
export function getAppOrigin(env?: NodeJS.ProcessEnv): string {
  return resolveAppOrigin({ env }).origin;
}

/**
 * Magic-link landing path: `${origin}/auth/callback`.
 *
 * Pass a ProcessEnv object in tests, or ResolveAppOriginOptions with
 * `pageOrigin` from the browser. Calling with no args uses
 * `window.location.origin` when available.
 */
export function getMagicLinkRedirectTo(
  envOrOptions?: NodeJS.ProcessEnv | ResolveAppOriginOptions,
): string {
  const options = normalizeOptions(envOrOptions);
  return `${resolveAppOrigin(options).origin}/auth/callback`;
}

function normalizeOptions(
  envOrOptions?: NodeJS.ProcessEnv | ResolveAppOriginOptions,
): ResolveAppOriginOptions {
  if (!envOrOptions) return {};
  if (
    Object.prototype.hasOwnProperty.call(envOrOptions, "pageOrigin") ||
    Object.prototype.hasOwnProperty.call(envOrOptions, "env")
  ) {
    return envOrOptions as ResolveAppOriginOptions;
  }
  return { env: envOrOptions as NodeJS.ProcessEnv };
}
