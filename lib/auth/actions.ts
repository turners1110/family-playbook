"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthIdentityError } from "@/lib/auth/errors";

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
