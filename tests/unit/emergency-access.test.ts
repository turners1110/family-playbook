import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEmergencyActorCookieValue,
  buildEmergencySessionCookieValue,
  createSignedCookieValue,
  EMERGENCY_SESSION_COOKIE,
  isEmergencyAccessModeEnabled,
  parseEmergencyActorKey,
  timingSafeEqualString,
  verifySignedCookieValue,
} from "@/lib/auth/emergency";
import { hasValidEmergencySessionFromRequest } from "@/lib/auth/emergency-session";
import { isProtectedPath, isPublicPath } from "@/lib/supabase/proxy";

describe("emergency access mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off by default", () => {
    vi.stubEnv("EMERGENCY_ACCESS_MODE", undefined);
    expect(isEmergencyAccessModeEnabled()).toBe(false);
  });

  it("requires exact true string", () => {
    vi.stubEnv("EMERGENCY_ACCESS_MODE", "TRUE");
    expect(isEmergencyAccessModeEnabled()).toBe(false);
    vi.stubEnv("EMERGENCY_ACCESS_MODE", "true");
    expect(isEmergencyAccessModeEnabled()).toBe(true);
  });

  it("rejects wrong codes with timing-safe compare", () => {
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("short", "longer-value")).toBe(false);
  });

  it("creates and verifies a signed session cookie", () => {
    const secret = "test-cookie-secret-value-32chars!!";
    const value = buildEmergencySessionCookieValue(secret, Date.now());
    const result = verifySignedCookieValue(value, secret);
    expect(result.ok).toBe(true);
  });

  it("rejects tampered cookies", () => {
    const secret = "test-cookie-secret-value-32chars!!";
    const value = buildEmergencySessionCookieValue(secret);
    const [payload] = value.split(".");
    const tampered = `${payload}.deadbeefdead`;
    const result = verifySignedCookieValue(tampered, secret);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("tampered");
  });

  it("rejects expired cookies", () => {
    const secret = "test-cookie-secret-value-32chars!!";
    const value = createSignedCookieValue(
      { v: 1, exp: Math.floor(Date.now() / 1000) - 10 },
      secret,
    );
    const result = verifySignedCookieValue(value, secret);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("accepts only sam/michelle actors", () => {
    expect(parseEmergencyActorKey("sam")).toBe("sam");
    expect(parseEmergencyActorKey("michelle")).toBe("michelle");
    expect(parseEmergencyActorKey("other")).toBeNull();
    expect(parseEmergencyActorKey("user_sam")).toBeNull();
  });

  it("grants protected-route access signal for valid emergency cookie", () => {
    vi.stubEnv("EMERGENCY_ACCESS_MODE", "true");
    vi.stubEnv("EMERGENCY_COOKIE_SECRET", "test-cookie-secret-value-32chars!!");
    const value = buildEmergencySessionCookieValue(
      "test-cookie-secret-value-32chars!!",
    );
    const header = `${EMERGENCY_SESSION_COOKIE}=${value}; other=1`;
    expect(hasValidEmergencySessionFromRequest(header)).toBe(true);
    expect(isProtectedPath("/home")).toBe(true);
    expect(isPublicPath("/access")).toBe(true);
    expect(isPublicPath("/access/actor")).toBe(true);
  });

  it("does not grant access when emergency mode is off", () => {
    vi.stubEnv("EMERGENCY_ACCESS_MODE", "false");
    vi.stubEnv("EMERGENCY_COOKIE_SECRET", "test-cookie-secret-value-32chars!!");
    const value = buildEmergencySessionCookieValue(
      "test-cookie-secret-value-32chars!!",
    );
    const header = `${EMERGENCY_SESSION_COOKIE}=${value}`;
    expect(hasValidEmergencySessionFromRequest(header)).toBe(false);
  });

  it("builds actor cookies", () => {
    const secret = "test-cookie-secret-value-32chars!!";
    const value = buildEmergencyActorCookieValue("michelle", secret);
    const verified = verifySignedCookieValue<{ actor: string; exp: number }>(
      value,
      secret,
    );
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.payload.actor).toBe("michelle");
  });
});
