import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function logAuthCallbackError(
  stage: string,
  error: { message?: string; status?: number | string; code?: string } | null | undefined,
  extra?: Record<string, unknown>,
) {
  console.error("[auth] callback failed", {
    stage,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    details: error,
    ...extra,
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (!code) {
    logAuthCallbackError("missing_code", { message: "No auth code in callback URL" });
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      logAuthCallbackError("exchangeCodeForSession", error, {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.user),
      });
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logAuthCallbackError("getUser", userError);
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logAuthCallbackError("profile_lookup", profileError);
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }

    if (!profile) {
      // Trigger should have created it; attempt a safe upsert for this user only.
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

      // profiles_insert_deny may block this for authenticated role — that's OK;
      // redirect with a clear no_profile message so setup can be fixed.
      if (upsertError) {
        logAuthCallbackError("profile_upsert", upsertError);
        return NextResponse.redirect(`${origin}/login?error=no_profile`);
      }
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch (error) {
    logAuthCallbackError("unhandled", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}
