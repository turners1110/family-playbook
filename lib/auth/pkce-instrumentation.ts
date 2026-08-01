/**
 * Temporary PKCE / project diagnostics.
 * Hashes only — never log raw verifiers, tokens, codes, keys, or cookie values.
 */

const HASH_PREFIX_LEN = 12;

export type NamedCookieWithValue = {
  name: string;
  value: string;
};

/** Monotonic counter for browser signInWithOtp invocations (page session). */
let signInWithOtpCallCount = 0;

export function incrementSignInWithOtpCallCount(): number {
  signInWithOtpCallCount += 1;
  return signInWithOtpCallCount;
}

/** Test helper — do not use in product auth paths. */
export function resetSignInWithOtpCallCountForTests(): void {
  signInWithOtpCallCount = 0;
}

export function getSignInWithOtpCallCount(): number {
  return signInWithOtpCallCount;
}

export function isPkceVerifierCookieName(name: string): boolean {
  return name.includes("-code-verifier");
}

export async function sha256HexPrefix(
  value: string,
  prefixLen: number = HASH_PREFIX_LEN,
): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return hex.slice(0, prefixLen);
}

export async function hashSupabaseUrlPrefix(
  url: string | null | undefined,
): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return sha256HexPrefix(trimmed);
}

export function listPkceVerifierCookies(
  cookies: readonly NamedCookieWithValue[],
): NamedCookieWithValue[] {
  return cookies.filter((cookie) => isPkceVerifierCookieName(cookie.name));
}

export async function hashPkceVerifierCookies(
  cookies: readonly NamedCookieWithValue[],
): Promise<{
  verifierCookieCount: number;
  verifierValueHashPrefixes: string[];
}> {
  const verifiers = listPkceVerifierCookies(cookies);
  const verifierValueHashPrefixes = await Promise.all(
    verifiers.map((cookie) => sha256HexPrefix(cookie.value)),
  );
  return {
    verifierCookieCount: verifiers.length,
    verifierValueHashPrefixes,
  };
}

/** Read PKCE verifier cookies from document.cookie (browser only). */
export function readBrowserPkceVerifierCookies(): NamedCookieWithValue[] {
  if (typeof document === "undefined") return [];

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return { name: part, value: "" };
      return {
        name: part.slice(0, eq),
        value: decodeURIComponent(part.slice(eq + 1)),
      };
    })
    .filter((cookie) => isPkceVerifierCookieName(cookie.name));
}

export async function collectBrowserPkceInstrumentation(supabaseUrl: string | null) {
  const callCount = incrementSignInWithOtpCallCount();
  const verifierCookies = readBrowserPkceVerifierCookies();
  const { verifierCookieCount, verifierValueHashPrefixes } =
    await hashPkceVerifierCookies(verifierCookies);

  return {
    signInWithOtpCallCount: callCount,
    verifierCookieCount,
    verifierValueHashPrefixes,
    supabaseUrlHashPrefix: await hashSupabaseUrlPrefix(supabaseUrl),
  };
}

export async function collectCallbackPkceInstrumentation(input: {
  cookies: readonly NamedCookieWithValue[];
  supabaseUrl: string | null;
}) {
  const { verifierCookieCount, verifierValueHashPrefixes } =
    await hashPkceVerifierCookies(input.cookies);

  return {
    verifierCookieCount,
    verifierValueHashPrefixes,
    supabaseUrlHashPrefix: await hashSupabaseUrlPrefix(input.supabaseUrl),
  };
}
