import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
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
        return NextResponse.redirect(`${origin}/login?error=no_profile`);
      }
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}
