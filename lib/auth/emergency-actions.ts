"use server";

import { redirect } from "next/navigation";
import {
  EMERGENCY_ACCESS_USER_MESSAGES,
  getEmergencyAccessCode,
  getEmergencyCookieSecret,
  isEmergencyAccessModeEnabled,
  parseEmergencyActorKey,
  timingSafeEqualString,
} from "@/lib/auth/emergency";
import { syncEmergencyActorToStore } from "@/lib/auth/emergency-identity";
import {
  clearEmergencyCookies,
  setEmergencyActorCookie,
  setEmergencySessionCookie,
} from "@/lib/auth/emergency-session";
import { readStore } from "@/lib/db/store";

export type EmergencyAccessResult =
  | { ok: true }
  | { ok: false; message: string };

export async function submitEmergencyAccessCode(
  formData: FormData,
): Promise<EmergencyAccessResult> {
  if (!isEmergencyAccessModeEnabled()) {
    return { ok: false, message: EMERGENCY_ACCESS_USER_MESSAGES.unavailable };
  }

  const expected = getEmergencyAccessCode();
  const secret = getEmergencyCookieSecret();
  if (!expected || !secret) {
    console.error("[emergency] access misconfigured", {
      hasCode: Boolean(expected),
      hasSecret: Boolean(secret),
    });
    return { ok: false, message: EMERGENCY_ACCESS_USER_MESSAGES.unavailable };
  }

  const submitted = String(formData.get("code") ?? "").trim();
  if (!submitted) {
    return { ok: false, message: EMERGENCY_ACCESS_USER_MESSAGES.invalid_code };
  }

  if (!timingSafeEqualString(submitted, expected)) {
    return { ok: false, message: EMERGENCY_ACCESS_USER_MESSAGES.invalid_code };
  }

  await setEmergencySessionCookie();
  redirect("/access/actor");
}

export async function selectEmergencyActor(
  formData: FormData,
): Promise<EmergencyAccessResult> {
  if (!isEmergencyAccessModeEnabled()) {
    return { ok: false, message: EMERGENCY_ACCESS_USER_MESSAGES.unavailable };
  }

  const actor = parseEmergencyActorKey(String(formData.get("actor") ?? ""));
  if (!actor) {
    return { ok: false, message: "Choose Sam or Michelle to continue." };
  }

  await setEmergencyActorCookie(actor);
  await syncEmergencyActorToStore(actor);
  redirect("/home");
}

export async function emergencyLogoutAction() {
  await clearEmergencyCookies();
  redirect("/access");
}

export async function getEmergencyActorChoices() {
  const store = await readStore();
  const sam = store.members.find((m) =>
    m.display_name.toLowerCase().includes("sam"),
  );
  const michelle = store.members.find((m) =>
    m.display_name.toLowerCase().includes("michelle"),
  );
  return {
    sam: sam?.display_name ?? "Sam",
    michelle: michelle?.display_name ?? "Michelle",
  };
}
