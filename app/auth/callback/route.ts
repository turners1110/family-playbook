import { NextResponse, type NextRequest } from "next/server";
import {
  buildSafeCallbackRequestLog,
  redactRedirectTargetForLog,
} from "@/lib/auth/callback-log";
import { summarizeAuthCookies } from "@/lib/auth/pkce-cookies";
import {
  applyPendingCookies,
  createRouteHandlerClient,
  type PendingCookie,
} from "@/lib/supabase/route";

function logAuthCallback(
  level: "info" | "error",
  stage: string,
  payload: Record<string, unknown>,
) {
  const line = { stage, ...payload };
  if (level === "error") {
    console.error("[auth] callback", line);
  } else {
    console.info("[auth] callback", line);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { origin } = url;

  // Cookie name summary only — no values — before any auth exchange.
  const incomingCookies = summarizeAuthCookies(request.cookies.getAll());
  const requestLog = buildSafeCallbackRequestLog({
    url,
    method: request.method,
    headers: request.headers,
    hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
    hasAnyCookies: request.cookies.getAll().length > 0,
    authCookieNames: incomingCookies.authCookieNames,
  });

  // Log the incoming request before ANY auth logic executes.
  logAuthCallback("info", "incoming_request", {
    ...requestLog,
    reachedExchangeCodeForSession: false,
  });

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  const pendingCookies: PendingCookie[] = [];

  const redirectWithCookies = (
    target: string,
    reason: string,
    extra?: Record<string, unknown>,
  ) => {
    logAuthCallback("info", "redirect", {
      ...requestLog,
      reason,
      redirectTo: redactRedirectTargetForLog(target, origin),
      reachedExchangeCodeForSession: Boolean(extra?.reachedExchangeCodeForSession),
      ...extra,
    });
    return applyPendingCookies(NextResponse.redirect(target), pendingCookies);
  };

  if (!code) {
    logAuthCallback("error", "missing_code", {
      ...requestLog,
      reachedExchangeCodeForSession: false,
      message: "No auth code in callback URL",
    });
    return redirectWithCookies(
      `${origin}/login?error=callback_failed`,
      "missing_code",
      { reachedExchangeCodeForSession: false },
    );
  }

  if (!incomingCookies.hasPkceCodeVerifier) {
    logAuthCallback("error", "missing_pkce_verifier", {
      ...requestLog,
      reachedExchangeCodeForSession: false,
      message:
        "PKCE code-verifier cookie missing; exchangeCodeForSession will fail. Request the magic link in the same browser that opens the email link.",
    });
  }

  try {
    const supabase = createRouteHandlerClient(request, pendingCookies);

    logAuthCallback("info", "before_exchangeCodeForSession", {
      ...requestLog,
      reachedExchangeCodeForSession: true,
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      logAuthCallback("error", "exchangeCodeForSession", {
        ...requestLog,
        reachedExchangeCodeForSession: true,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.user),
      });
      return redirectWithCookies(
        `${origin}/login?error=callback_failed`,
        "exchangeCodeForSession_failed",
        { reachedExchangeCodeForSession: true },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logAuthCallback("error", "getUser", {
        ...requestLog,
        reachedExchangeCodeForSession: true,
        message: userError?.message,
        status: userError?.status,
        code: userError?.code,
      });
      return redirectWithCookies(
        `${origin}/login?error=callback_failed`,
        "getUser_failed",
        { reachedExchangeCodeForSession: true },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logAuthCallback("error", "profile_lookup", {
        ...requestLog,
        reachedExchangeCodeForSession: true,
        message: profileError.message,
        code: profileError.code,
      });
      return redirectWithCookies(
        `${origin}/login?error=callback_failed`,
        "profile_lookup_failed",
        { reachedExchangeCodeForSession: true },
      );
    }

    if (!profile) {
      const displayName =
        (user.user_metadata?.display_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Family member";

      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          display_name: displayName,
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        logAuthCallback("error", "profile_upsert", {
          ...requestLog,
          reachedExchangeCodeForSession: true,
          message: upsertError.message,
          code: upsertError.code,
        });
        return redirectWithCookies(
          `${origin}/login?error=no_profile`,
          "profile_upsert_failed",
          { reachedExchangeCodeForSession: true },
        );
      }
    }

    logAuthCallback("info", "success", {
      ...requestLog,
      reachedExchangeCodeForSession: true,
      authCookieNames: [
        ...new Set([
          ...requestLog.authCookieNames,
          ...pendingCookies
            .map((c) => c.name)
            .filter((n) => n.startsWith("sb-")),
        ]),
      ].sort(),
    });

    return redirectWithCookies(`${origin}${safeNext}`, "success", {
      reachedExchangeCodeForSession: true,
    });
  } catch (error) {
    logAuthCallback("error", "unhandled", {
      ...requestLog,
      reachedExchangeCodeForSession: false,
      message: error instanceof Error ? error.message : String(error),
    });
    return redirectWithCookies(
      `${origin}/login?error=callback_failed`,
      "unhandled",
      { reachedExchangeCodeForSession: false },
    );
  }
}
