import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasSupabasePublicConfig,
  requireSupabasePublicConfig,
} from "@/lib/supabase/env";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import { hasValidEmergencySessionFromRequest } from "@/lib/auth/emergency-session";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/access",
  "/storage-unavailable",
];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isProtectedPath(pathname: string) {
  const protectedPrefixes = [
    "/home",
    "/before-baby",
    "/discuss",
    "/questions",
    "/decisions",
    "/outcomes",
    "/knowledge",
    "/playbook",
    "/dashboard",
    "/settings",
    "/babymoon",
    "/search",
  ];
  return protectedPrefixes.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Auth callback manages its own cookies (PKCE exchange).
  // Do not run getUser()/setAll here — it can drop or rewrite auth cookies.
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) {
    return supabaseResponse;
  }

  // Trip mode off: /access is unavailable.
  if (
    !isEmergencyAccessModeEnabled() &&
    (pathname === "/access" || pathname.startsWith("/access/"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const emergencyOk = hasValidEmergencySessionFromRequest(
    request.headers.get("cookie") ?? undefined,
  );

  if (!hasSupabasePublicConfig()) {
    try {
      requireSupabasePublicConfig();
    } catch {
      /* already logged */
    }

    if (isProtectedPath(pathname)) {
      if (isEmergencyAccessModeEnabled() && emergencyOk) {
        return supabaseResponse;
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isEmergencyAccessModeEnabled() ? "/access" : "/login";
      if (!isEmergencyAccessModeEnabled()) {
        redirectUrl.searchParams.set("error", "config");
      }
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const { url, key } = requireSupabasePublicConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    if (isEmergencyAccessModeEnabled() && emergencyOk) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isEmergencyAccessModeEnabled() ? "/access" : "/login";
    if (!isEmergencyAccessModeEnabled()) {
      redirectUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/home";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/access" || pathname.startsWith("/access/"))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/home";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (emergencyOk && (pathname === "/access" || pathname === "/login")) {
    // Allow /access/actor even with session; only bounce bare /access and /login.
    if (pathname === "/access" || pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/home";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (user && pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/home";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && emergencyOk && pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/home";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
