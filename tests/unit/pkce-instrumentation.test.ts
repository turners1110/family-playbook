import { afterEach, describe, expect, it } from "vitest";
import {
  collectCallbackPkceInstrumentation,
  hashPkceVerifierCookies,
  hashSupabaseUrlPrefix,
  incrementSignInWithOtpCallCount,
  resetSignInWithOtpCallCountForTests,
  sha256HexPrefix,
} from "@/lib/auth/pkce-instrumentation";

describe("pkce instrumentation", () => {
  afterEach(() => {
    resetSignInWithOtpCallCountForTests();
  });

  it("returns a stable SHA-256 hex prefix without exposing the input", async () => {
    const prefix = await sha256HexPrefix("SECRET_VERIFIER_VALUE");
    expect(prefix).toMatch(/^[0-9a-f]{12}$/);
    expect(prefix).not.toContain("SECRET");
    expect(await sha256HexPrefix("SECRET_VERIFIER_VALUE")).toBe(prefix);
    expect(await sha256HexPrefix("OTHER")).not.toBe(prefix);
  });

  it("increments signInWithOtp call count monotonically", () => {
    expect(incrementSignInWithOtpCallCount()).toBe(1);
    expect(incrementSignInWithOtpCallCount()).toBe(2);
    expect(incrementSignInWithOtpCallCount()).toBe(3);
  });

  it("hashes verifier cookie values and counts them without leaking secrets", async () => {
    const summary = await hashPkceVerifierCookies([
      {
        name: "sb-abc-auth-token-code-verifier",
        value: "SECRET_VERIFIER_A",
      },
      {
        name: "sb-abc-auth-token.0",
        value: "SECRET_SESSION_CHUNK",
      },
      {
        name: "sb-xyz-auth-token-code-verifier",
        value: "SECRET_VERIFIER_B",
      },
    ]);

    expect(summary.verifierCookieCount).toBe(2);
    expect(summary.verifierValueHashPrefixes).toHaveLength(2);
    expect(summary.verifierValueHashPrefixes[0]).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(summary)).not.toContain("SECRET");
  });

  it("hashes supabase URL for client/server comparison", async () => {
    const prefix = await hashSupabaseUrlPrefix("https://abc.supabase.co");
    expect(prefix).toMatch(/^[0-9a-f]{12}$/);
    expect(prefix).not.toContain("supabase");
    expect(await hashSupabaseUrlPrefix(null)).toBeNull();
  });

  it("callback collector returns count, verifier prefixes, and url prefix", async () => {
    const payload = await collectCallbackPkceInstrumentation({
      cookies: [
        {
          name: "sb-abc-auth-token-code-verifier",
          value: "SECRET_VERIFIER",
        },
      ],
      supabaseUrl: "https://abc.supabase.co",
    });

    expect(payload.verifierCookieCount).toBe(1);
    expect(payload.verifierValueHashPrefixes).toHaveLength(1);
    expect(payload.supabaseUrlHashPrefix).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(payload)).not.toContain("SECRET");
    expect(JSON.stringify(payload)).not.toContain("https://");
  });
});
