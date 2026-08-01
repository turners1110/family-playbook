import { cookies } from "next/headers";
import {
  EMERGENCY_ACTOR_COOKIE,
  EMERGENCY_SESSION_COOKIE,
  buildEmergencyActorCookieValue,
  buildEmergencySessionCookieValue,
  emergencyCookieOptions,
  getEmergencyCookieSecret,
  isEmergencyAccessModeEnabled,
  parseEmergencyActorKey,
  verifySignedCookieValue,
  type EmergencyActorKey,
  type EmergencyActorPayload,
  type EmergencySessionPayload,
} from "@/lib/auth/emergency";

export async function readEmergencySession(): Promise<
  | { ok: true; payload: EmergencySessionPayload }
  | { ok: false; reason: "disabled" | "missing" | "tampered" | "expired" | "config" }
> {
  if (!isEmergencyAccessModeEnabled()) {
    return { ok: false, reason: "disabled" };
  }
  const secret = getEmergencyCookieSecret();
  if (!secret) return { ok: false, reason: "config" };

  const jar = await cookies();
  return verifySignedCookieValue<EmergencySessionPayload>(
    jar.get(EMERGENCY_SESSION_COOKIE)?.value,
    secret,
  );
}

export async function readEmergencyActor(): Promise<EmergencyActorKey | null> {
  if (!isEmergencyAccessModeEnabled()) return null;
  const secret = getEmergencyCookieSecret();
  if (!secret) return null;
  const jar = await cookies();
  const result = verifySignedCookieValue<EmergencyActorPayload>(
    jar.get(EMERGENCY_ACTOR_COOKIE)?.value,
    secret,
  );
  if (!result.ok) return null;
  return parseEmergencyActorKey(result.payload.actor);
}

export async function setEmergencySessionCookie() {
  const secret = getEmergencyCookieSecret();
  if (!secret) {
    throw new Error("EMERGENCY_COOKIE_SECRET is not configured.");
  }
  const jar = await cookies();
  jar.set(
    EMERGENCY_SESSION_COOKIE,
    buildEmergencySessionCookieValue(secret),
    emergencyCookieOptions(),
  );
}

export async function setEmergencyActorCookie(actor: EmergencyActorKey) {
  const secret = getEmergencyCookieSecret();
  if (!secret) {
    throw new Error("EMERGENCY_COOKIE_SECRET is not configured.");
  }
  const jar = await cookies();
  jar.set(
    EMERGENCY_ACTOR_COOKIE,
    buildEmergencyActorCookieValue(actor, secret),
    emergencyCookieOptions(),
  );
}

export async function clearEmergencyCookies() {
  const jar = await cookies();
  jar.delete(EMERGENCY_SESSION_COOKIE);
  jar.delete(EMERGENCY_ACTOR_COOKIE);
}

/** Edge/proxy-safe check using request cookies (no next/headers). */
export function hasValidEmergencySessionFromRequest(
  cookieHeaderValue: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isEmergencyAccessModeEnabled(env)) return false;
  const secret = getEmergencyCookieSecret(env);
  if (!secret || !cookieHeaderValue) return false;

  const match = cookieHeaderValue
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EMERGENCY_SESSION_COOKIE}=`));
  if (!match) return false;
  const raw = match.slice(EMERGENCY_SESSION_COOKIE.length + 1);
  const result = verifySignedCookieValue<EmergencySessionPayload>(raw, secret);
  return result.ok;
}
