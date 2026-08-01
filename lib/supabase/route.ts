import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Supabase client for Route Handlers (auth callback).
 * Uses the same NEXT_PUBLIC_SUPABASE_URL / ANON_KEY as createBrowserClient.
 * Relies on @supabase/ssr PKCE defaults (no custom auth storage or flow overrides).
 * Buffers Set-Cookie writes onto the response after exchangeCodeForSession.
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
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });
}

export function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingCookie[],
) {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
