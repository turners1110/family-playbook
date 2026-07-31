import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthIdentityError, type AuthErrorCode } from "@/lib/auth/errors";

export type ProfileRecord = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type FamilyRecord = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRecord = {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  role: "parent" | "caregiver" | "child" | "other";
  sort_order: number;
  created_at: string;
};

export type FamilySettingsRecord = {
  family_id: string;
  hide_partner_answers_until_both_saved: boolean;
  dark_mode: "system" | "light" | "dark";
  babymoon_target_date: string | null;
  babymoon_daily_questions: number;
  include_perspective_history_in_playbook: boolean;
  updated_at: string;
};

export type FamilyContext = {
  user: User;
  profile: ProfileRecord;
  member: FamilyMemberRecord;
  family: FamilyRecord;
  settings: FamilySettingsRecord;
};

function redirectWithAuthError(code: AuthErrorCode): never {
  redirect(`/login?error=${code}`);
}

/**
 * Resolves the authenticated user and their family identity from Supabase.
 * Never trusts family_id or member_id from the browser.
 */
export async function requireFamilyContext(): Promise<FamilyContext> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    throw new AuthIdentityError(
      "config",
      "Supabase public environment variables are missing.",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectWithAuthError(userError?.message?.toLowerCase().includes("expired") ? "expired" : "unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,display_name,created_at")
    .eq("id", user!.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirectWithAuthError("no_profile");
  }

  const { data: member, error: memberError } = await supabase
    .from("family_members")
    .select("id,family_id,user_id,display_name,role,sort_order,created_at")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (memberError || !member) {
    redirectWithAuthError("no_membership");
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id,name,created_at,updated_at")
    .eq("id", member!.family_id)
    .maybeSingle();

  if (familyError || !family) {
    redirectWithAuthError("no_family");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("family_settings")
    .select(
      "family_id,hide_partner_answers_until_both_saved,dark_mode,babymoon_target_date,babymoon_daily_questions,include_perspective_history_in_playbook,updated_at",
    )
    .eq("family_id", family!.id)
    .maybeSingle();

  if (settingsError || !settings) {
    redirectWithAuthError("no_settings");
  }

  return {
    user: user!,
    profile: profile as ProfileRecord,
    member: member as FamilyMemberRecord,
    family: family as FamilyRecord,
    settings: settings as FamilySettingsRecord,
  };
}

/** Soft check for pages that need to know auth without redirecting. */
export async function getOptionalUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
