"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AuthIdentityError } from "@/lib/auth/errors";

const emailSchema = z.string().trim().email();

function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

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
      emailRedirectTo: `${appOrigin()}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  // Intentionally do not reveal whether the email exists.
  if (error) {
    // Still show the generic success copy for enumeration resistance,
    // but log server-side for operators.
    console.error("[auth] magic link request failed");
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
