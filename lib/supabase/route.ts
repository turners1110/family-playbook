import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { requireSupabasePublicConfig } from "@/lib/supabase/env";

export type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Supabase client for Route Handlers (auth callback).
 * Uses the shared public URL + publishable/anon key resolution.
 * Relies on @supabase/ssr PKCE defaults (no custom auth storage or flow overrides).
 * Buffers Set-Cookie writes onto the response after exchangeCodeForSession.
 */
export function createRouteHandlerClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const { url, key } = requireSupabasePublicConfig();

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
