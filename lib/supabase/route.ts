import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseAuthCookieName } from "@/lib/auth/pkce-cookies";

export type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Supabase client for Route Handlers.
 * Reads from the incoming request; buffers Set-Cookie writes so they can be
 * applied to whichever NextResponse is ultimately returned (redirect/JSON).
 */
export function createRouteHandlerClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Keep request jar in sync for same-request reads (e.g. callback).
          // Magic-link must still decide whether to flush these to the response.
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });
}

/** Force a single app-origin cookie scope so duplicate path/domain variants do not accumulate. */
export function normalizeAuthCookieOptions(
  options?: PendingCookie["options"],
): PendingCookie["options"] {
  if (!options) {
    return { path: "/", sameSite: "lax" };
  }
  const normalized: PendingCookie["options"] = {
    ...options,
    path: "/",
    sameSite: options.sameSite ?? "lax",
  };
  delete normalized.domain;
  return normalized;
}

export function isPkceVerifierCookieName(name: string): boolean {
  return name.includes("-code-verifier");
}

/**
 * Cookies that may be written after signInWithOtp.
 * On any OTP error (including rate limit), return [] so a prior browser
 * verifier cookie is left untouched.
 */
export function pendingCookiesForOtpResponse(
  pendingCookies: readonly PendingCookie[],
  otpError: { message?: string; code?: string; status?: number } | null,
): PendingCookie[] {
  if (otpError) {
    return [];
  }

  return pendingCookies
    .filter(
      (cookie) =>
        isPkceVerifierCookieName(cookie.name) ||
        isSupabaseAuthCookieName(cookie.name),
    )
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      options: normalizeAuthCookieOptions(cookie.options),
    }));
}

export function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingCookie[],
) {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, normalizeAuthCookieOptions(options));
  });
  return response;
}

/** Cookie names only — never values. */
export function pendingCookieNames(pendingCookies: readonly PendingCookie[]): string[] {
  return [...new Set(pendingCookies.map((c) => c.name))].sort();
}
