import { NextResponse, type NextRequest } from "next/server";
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
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  const incomingCookies = summarizeAuthCookies(request.cookies.getAll());

  logAuthCallback("info", "start", {
    hasCode: Boolean(code),
    hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
    authCookieNames: incomingCookies.authCookieNames,
  });

  if (!code) {
    logAuthCallback("error", "missing_code", {
      hasCode: false,
      hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
      authCookieNames: incomingCookies.authCookieNames,
      message: "No auth code in callback URL",
    });
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  if (!incomingCookies.hasPkceCodeVerifier) {
    logAuthCallback("error", "missing_pkce_verifier", {
      hasCode: true,
      hasPkceCodeVerifier: false,
      authCookieNames: incomingCookies.authCookieNames,
      message:
        "PKCE code-verifier cookie missing; exchangeCodeForSession will fail. Request the magic link in the same browser that opens the email link.",
    });
  }

  const pendingCookies: PendingCookie[] = [];

  const redirectWithCookies = (url: string) =>
    applyPendingCookies(NextResponse.redirect(url), pendingCookies);

  try {
    const supabase = createRouteHandlerClient(request, pendingCookies);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      logAuthCallback("error", "exchangeCodeForSession", {
        hasCode: true,
        hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
        authCookieNames: incomingCookies.authCookieNames,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.user),
      });
      return redirectWithCookies(`${origin}/login?error=callback_failed`);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logAuthCallback("error", "getUser", {
        hasCode: true,
        message: userError?.message,
        status: userError?.status,
        code: userError?.code,
      });
      return redirectWithCookies(`${origin}/login?error=callback_failed`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logAuthCallback("error", "profile_lookup", {
        hasCode: true,
        message: profileError.message,
        code: profileError.code,
      });
      return redirectWithCookies(`${origin}/login?error=callback_failed`);
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
          hasCode: true,
          message: upsertError.message,
          code: upsertError.code,
        });
        return redirectWithCookies(`${origin}/login?error=no_profile`);
      }
    }

    logAuthCallback("info", "success", {
      hasCode: true,
      hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
      authCookieNames: [
        ...new Set([
          ...incomingCookies.authCookieNames,
          ...pendingCookies
            .map((c) => c.name)
            .filter((n) => n.startsWith("sb-")),
        ]),
      ].sort(),
    });

    return redirectWithCookies(`${origin}${safeNext}`);
  } catch (error) {
    logAuthCallback("error", "unhandled", {
      hasCode: Boolean(code),
      hasPkceCodeVerifier: incomingCookies.hasPkceCodeVerifier,
      authCookieNames: incomingCookies.authCookieNames,
      message: error instanceof Error ? error.message : String(error),
    });
    return redirectWithCookies(`${origin}/login?error=callback_failed`);
  }
}
