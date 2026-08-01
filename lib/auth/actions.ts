"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import { summarizeAuthCookies } from "@/lib/auth/pkce-cookies";
import { AuthIdentityError } from "@/lib/auth/errors";
import type { MagicLinkResult } from "@/lib/auth/magic-link-types";
import { cookies } from "next/headers";

export type { MagicLinkResult };

const emailSchema = z.string().trim().email();

/**
 * Server-action magic link (legacy / non-UI callers).
 * Prefer POST /auth/magic-link so the PKCE verifier is attached via Set-Cookie
 * on a real Route Handler response.
 */
export async function requestMagicLink(emailInput: string): Promise<MagicLinkResult> {
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_email",
      message: "Enter a valid email address.",
    };
  }

  let emailRedirectTo: string;
  try {
    emailRedirectTo = getMagicLinkRedirectTo();
  } catch (error) {
    console.error("[auth] NEXT_PUBLIC_APP_URL configuration error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      code: "config",
      message:
        "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.",
    };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      ok: false,
      code: "config",
      message:
        "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.",
    };
  }

  const email = parsed.data.toLowerCase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  const cookieStore = await cookies();
  const cookieSummary = summarizeAuthCookies(cookieStore.getAll());
  console.info("[auth] magic link otp cookie state (server action)", {
    hasCode: false,
    hasPkceCodeVerifier: cookieSummary.hasPkceCodeVerifier,
    authCookieNames: cookieSummary.authCookieNames,
  });

  if (error) {
    console.error("[auth] magic link request failed", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
  }

  return {
    ok: true,
    message:
      "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox and spam folder.",
  };
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    if (!(error instanceof AuthIdentityError)) {
      console.error("[auth] logout failed");
    }
  }
  redirect("/login");
}

export async function requireAuthenticatedActionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthIdentityError("unauthenticated", "Authentication required.");
  }
  return user;
}
