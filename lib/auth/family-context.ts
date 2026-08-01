import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthIdentityError, type AuthErrorCode } from "@/lib/auth/errors";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import {
  readEmergencyActor,
  readEmergencySession,
} from "@/lib/auth/emergency-session";
import { syncEmergencyActorToStore } from "@/lib/auth/emergency-identity";
import { readStore } from "@/lib/db/store";

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
  mode: "supabase" | "emergency";
  user: User | null;
  profile: ProfileRecord;
  member: FamilyMemberRecord;
  family: FamilyRecord;
  settings: FamilySettingsRecord;
};

function redirectWithAuthError(code: AuthErrorCode): never {
  redirect(`/login?error=${code}`);
}

/**
 * Resolves family identity from Supabase Auth, or Trip Online emergency session.
 * Never trusts family_id or member_id from the browser.
 * Supabase Auth always wins over emergency actor selection.
 */
export async function requireFamilyContext(): Promise<FamilyContext> {
  const supabaseUser = await getOptionalUser();
  if (supabaseUser) {
    return resolveSupabaseFamilyContext(supabaseUser);
  }

  if (isEmergencyAccessModeEnabled()) {
    return resolveEmergencyFamilyContext();
  }

  redirectWithAuthError("unauthenticated");
}

async function resolveSupabaseFamilyContext(user: User): Promise<FamilyContext> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    throw new AuthIdentityError(
      "config",
      "Supabase public environment variables are missing.",
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,display_name,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirectWithAuthError("no_profile");
  }

  const { data: member, error: memberError } = await supabase
    .from("family_members")
    .select("id,family_id,user_id,display_name,role,sort_order,created_at")
    .eq("user_id", user.id)
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
    mode: "supabase",
    user,
    profile: profile as ProfileRecord,
    member: member as FamilyMemberRecord,
    family: family as FamilyRecord,
    settings: settings as FamilySettingsRecord,
  };
}

async function resolveEmergencyFamilyContext(): Promise<FamilyContext> {
  const session = await readEmergencySession();
  if (!session.ok) {
    if (session.reason === "expired") redirect("/access?error=expired");
    if (session.reason === "tampered") redirect("/access?error=tampered");
    redirect("/access");
  }

  const actor = await readEmergencyActor();
  if (!actor) {
    redirect("/access/actor");
  }

  await syncEmergencyActorToStore(actor);

  let store;
  try {
    store = await readStore();
  } catch (error) {
    console.error("[emergency] store unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    redirect("/storage-unavailable");
  }

  const needle = actor === "sam" ? "sam" : "michelle";
  const user =
    store.users.find((u) => u.display_name.toLowerCase().includes(needle)) ??
    store.users[0];
  const member =
    store.members.find((m) => m.user_id === user?.id) ?? store.members[0];

  if (!user || !member) {
    redirect("/access?error=setup");
  }

  return {
    mode: "emergency",
    user: null,
    profile: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      created_at: user.created_at,
    },
    member: {
      id: member.id,
      family_id: store.family.id,
      user_id: member.user_id,
      display_name: member.display_name,
      role: member.role,
      sort_order: member.sort_order,
      created_at: member.created_at,
    },
    family: {
      id: store.family.id,
      name: store.family.name,
      created_at: store.family.created_at,
      updated_at: store.family.updated_at,
    },
    settings: {
      family_id: store.family.id,
      hide_partner_answers_until_both_saved:
        store.settings.hide_partner_answers_until_both_saved,
      dark_mode: store.settings.dark_mode,
      babymoon_target_date: store.settings.babymoon_target_date,
      babymoon_daily_questions: store.settings.babymoon_daily_questions,
      include_perspective_history_in_playbook:
        store.settings.include_perspective_history_in_playbook,
      updated_at: store.settings.updated_at,
    },
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

export async function hasAppAccess(): Promise<boolean> {
  if (await getOptionalUser()) return true;
  if (!isEmergencyAccessModeEnabled()) return false;
  const session = await readEmergencySession();
  return session.ok;
}
