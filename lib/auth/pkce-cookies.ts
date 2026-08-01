/**
 * Safe helpers for inspecting Supabase Auth / PKCE cookies.
 * Never log or return cookie values — names only.
 */

export type NamedCookie = { name: string };

export function isSupabaseAuthCookieName(name: string): boolean {
  // Default storage key: sb-<project-ref>-auth-token (+ chunks / code-verifier)
  return (
    name.startsWith("sb-") &&
    (name.includes("-auth-token") || name.includes("-code-verifier"))
  );
}

export function listSupabaseAuthCookieNames(
  cookies: readonly NamedCookie[],
): string[] {
  return cookies.map((c) => c.name).filter(isSupabaseAuthCookieName).sort();
}

export function hasPkceCodeVerifierCookie(
  cookies: readonly NamedCookie[],
): boolean {
  return cookies.some((c) => c.name.includes("-code-verifier"));
}

export function summarizeAuthCookies(cookies: readonly NamedCookie[]) {
  return {
    hasPkceCodeVerifier: hasPkceCodeVerifierCookie(cookies),
    authCookieNames: listSupabaseAuthCookieNames(cookies),
  };
}
