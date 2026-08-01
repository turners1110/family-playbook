import { createHmac, timingSafeEqual } from "crypto";

export const EMERGENCY_SESSION_COOKIE = "tfp_emergency_session";
export const EMERGENCY_ACTOR_COOKIE = "tfp_emergency_actor";

export const EMERGENCY_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type EmergencyActorKey = "sam" | "michelle";

export type EmergencySessionPayload = {
  v: 1;
  exp: number;
};

export type EmergencyActorPayload = {
  v: 1;
  actor: EmergencyActorKey;
  exp: number;
};

export function isEmergencyAccessModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.EMERGENCY_ACCESS_MODE === "true";
}

export function getEmergencyAccessCode(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const code = env.EMERGENCY_ACCESS_CODE?.trim();
  return code || null;
}

export function getEmergencyCookieSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = env.EMERGENCY_COOKIE_SECRET?.trim();
  return secret || null;
}

export function emergencyCookieSecure(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (/localhost|127\.0\.0\.1/i.test(appUrl)) return false;
  return env.NODE_ENV === "production";
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Compare against self to keep constant-ish work, then fail.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function base64urlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function signPayload(payloadB64: string, secret: string): string {
  return base64urlEncode(
    createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

export function createSignedCookieValue(
  payload: object,
  secret: string,
): string {
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = signPayload(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function verifySignedCookieValue<T extends { exp: number }>(
  raw: string | undefined | null,
  secret: string,
  nowMs: number = Date.now(),
): { ok: true; payload: T } | { ok: false; reason: "missing" | "tampered" | "expired" } {
  if (!raw || !raw.includes(".")) {
    return { ok: false, reason: "missing" };
  }
  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) {
    return { ok: false, reason: "tampered" };
  }

  const expected = signPayload(payloadB64, secret);
  if (!timingSafeEqualString(sig, expected)) {
    return { ok: false, reason: "tampered" };
  }

  try {
    const json = base64urlDecode(payloadB64).toString("utf8");
    const payload = JSON.parse(json) as T;
    if (!payload || typeof payload.exp !== "number") {
      return { ok: false, reason: "tampered" };
    }
    if (payload.exp * 1000 <= nowMs) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "tampered" };
  }
}

export function buildEmergencySessionCookieValue(
  secret: string,
  nowMs: number = Date.now(),
): string {
  const payload: EmergencySessionPayload = {
    v: 1,
    exp: Math.floor(nowMs / 1000) + EMERGENCY_SESSION_MAX_AGE_SEC,
  };
  return createSignedCookieValue(payload, secret);
}

export function buildEmergencyActorCookieValue(
  actor: EmergencyActorKey,
  secret: string,
  nowMs: number = Date.now(),
): string {
  const payload: EmergencyActorPayload = {
    v: 1,
    actor,
    exp: Math.floor(nowMs / 1000) + EMERGENCY_SESSION_MAX_AGE_SEC,
  };
  return createSignedCookieValue(payload, secret);
}

export function parseEmergencyActorKey(
  value: unknown,
): EmergencyActorKey | null {
  if (value === "sam" || value === "michelle") return value;
  return null;
}

export const EMERGENCY_ACCESS_USER_MESSAGES = {
  invalid_code: "That access code is not valid.",
  unavailable: "Trip access is not available right now.",
  expired: "Your trip session expired. Enter the access code again.",
  tampered: "Your trip session is no longer valid. Enter the access code again.",
} as const;

export function emergencyCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true as const,
    secure: emergencyCookieSecure(env),
    sameSite: "lax" as const,
    path: "/",
    maxAge: EMERGENCY_SESSION_MAX_AGE_SEC,
  };
}
