"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import { AuthIdentityError } from "@/lib/auth/errors";

const emailSchema = z.string().trim().email();

export type MagicLinkResult =
  | { ok: true; message: string }
  | { ok: false; code: "invalid_email" | "config" | "magic_link_failed"; message: string };

/**
 * Sends a magic link. Always returns a generic success message on the happy path
 * and for unknown emails, to avoid account enumeration.
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

  // Intentionally do not reveal whether the email exists.
  if (error) {
    // Detailed diagnostics stay on the server; never return these to the browser.
    console.error("[auth] magic link request failed", {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error,
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
