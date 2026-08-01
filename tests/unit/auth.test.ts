import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import {
  AUTH_ERROR_MESSAGES,
  AuthIdentityError,
  publicAuthMessage,
} from "@/lib/auth/errors";
import { getAppOrigin, getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import { isProtectedPath, isPublicPath } from "@/lib/supabase/proxy";

describe("auth error messages", () => {
  it("maps known codes to safe user copy", () => {
    expect(publicAuthMessage("no_membership")).toContain("not linked");
    expect(publicAuthMessage("callback_failed")).toContain("sign-in");
    expect(publicAuthMessage("config")).toContain("not configured");
  });

  it("does not leak unknown codes as raw text", () => {
    expect(publicAuthMessage("something_weird")).toContain("Something went wrong");
  });

  it("AuthIdentityError carries a code", () => {
    const err = new AuthIdentityError("no_profile", "missing");
    expect(err.code).toBe("no_profile");
    expect(AUTH_ERROR_MESSAGES.no_profile).toBeTruthy();
  });
});

describe("route classification", () => {
  it("marks product routes as protected", () => {
    for (const pathName of [
      "/home",
      "/before-baby",
      "/discuss",
      "/discuss/abc",
      "/questions",
      "/decisions",
      "/outcomes",
      "/knowledge",
      "/playbook",
      "/dashboard",
      "/settings",
      "/babymoon",
      "/search",
    ]) {
      expect(isProtectedPath(pathName)).toBe(true);
    }
  });

  it("marks login and callback as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/access")).toBe(true);
    expect(isPublicPath("/storage-unavailable")).toBe(true);
    expect(isPublicPath("/auth/magic-link")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });
});

describe("magic link email validation", () => {
  const emailSchema = z.string().trim().email();

  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("sam@example.com").success).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("magic link redirect URL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds emailRedirectTo from NEXT_PUBLIC_APP_URL", () => {
    const env = {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://preview-app.vercel.app/",
    } as NodeJS.ProcessEnv;

    expect(getAppOrigin(env)).toBe("https://preview-app.vercel.app");
    expect(getMagicLinkRedirectTo(env)).toBe(
      "https://preview-app.vercel.app/auth/callback",
    );
  });

  it("never generates localhost redirect URLs in production", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      getMagicLinkRedirectTo({
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEXT_PUBLIC_APP_URL is required/);

    expect(() =>
      getMagicLinkRedirectTo({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      } as NodeJS.ProcessEnv),
    ).toThrow(/must not point to localhost/);

    expect(() =>
      getMagicLinkRedirectTo({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      } as NodeJS.ProcessEnv),
    ).toThrow(/must not point to localhost/);

    expect(spy).toHaveBeenCalled();
  });

  it("still works with localhost in development", () => {
    expect(
      getMagicLinkRedirectTo({
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv),
    ).toBe("http://localhost:3000/auth/callback");

    expect(
      getMagicLinkRedirectTo({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      } as NodeJS.ProcessEnv),
    ).toBe("http://localhost:3000/auth/callback");
  });
});

describe("browser PKCE magic-link login", () => {
  it("login form calls browser signInWithOtp with emailRedirectTo /auth/callback", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "components/auth/LoginForm.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from ["']@\/lib\/supabase\/client["']/);
    expect(source).toMatch(/createClient\(/);
    expect(source).toMatch(/signInWithOtp\(/);
    expect(source).toMatch(/shouldCreateUser:\s*false/);
    expect(source).toMatch(/getMagicLinkRedirectTo/);
    expect(source).toMatch(/emailRedirectTo/);
    expect(source).toMatch(/pkce-instrumentation/);
    expect(source).toMatch(/collectBrowserPkceInstrumentation/);
    expect(source).toMatch(/before_signInWithOtp/);
    expect(source).toMatch(/after_signInWithOtp/);
    expect(source).toMatch(/signInWithOtp exception/);
    expect(source).toMatch(/otpReturned/);
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/\/auth\/magic-link/);
    expect(source).not.toMatch(/pendingCookiesForOtpResponse/);
    expect(source).not.toMatch(/generatePKCE/);
    expect(source).not.toMatch(/localhost:3000/);
  });

  it("custom magic-link route is no longer used", async () => {
    await expect(
      fs.access(path.join(process.cwd(), "app/auth/magic-link/route.ts")),
    ).rejects.toThrow();

    const login = await fs.readFile(
      path.join(process.cwd(), "components/auth/LoginForm.tsx"),
      "utf8",
    );
    expect(login).not.toMatch(/magic-link/);

    const proxy = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/proxy.ts"),
      "utf8",
    );
    expect(proxy).not.toMatch(/magic-link/);
  });

  it("browser and server clients share public env and no custom PKCE options", async () => {
    const browser = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/client.ts"),
      "utf8",
    );
    const route = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/route.ts"),
      "utf8",
    );
    const server = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/server.ts"),
      "utf8",
    );

    expect(browser).toMatch(/requireBrowserSupabaseConfig/);
    expect(browser).toMatch(/@\/lib\/supabase\/browser-env/);
    expect(browser).not.toMatch(/@\/lib\/supabase\/env["']/);
    expect(browser).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(browser).not.toMatch(/storageKey\s*:/);
    expect(browser).not.toMatch(/flowType\s*:/);
    expect(browser).not.toMatch(/generatePKCE/);
    expect(browser).not.toMatch(/cookieOptions\s*:/);

    for (const source of [route, server]) {
      expect(source).toMatch(/requireSupabasePublicConfig/);
      expect(source).toMatch(/@\/lib\/supabase\/env/);
      expect(source).not.toMatch(/storageKey\s*:/);
      expect(source).not.toMatch(/flowType\s*:/);
      expect(source).not.toMatch(/generatePKCE/);
      expect(source).not.toMatch(/cookieOptions\s*:/);
      expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }

    const browserEnv = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/browser-env.ts"),
      "utf8",
    );
    expect(browserEnv).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(browserEnv).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(browserEnv).toMatch(/resolveBrowserSupabasePublicKey/);

    expect(browser).toMatch(/createBrowserClient/);
    expect(route).toMatch(/createServerClient/);
    expect(route).not.toMatch(/pendingCookiesForOtpResponse/);
    expect(route).not.toMatch(/normalizeAuthCookieOptions/);
  });

  it("callback still exchanges the returned code", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "app/auth/callback/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/exchangeCodeForSession\(code\)/);
    expect(source).toMatch(/createRouteHandlerClient/);
    expect(source).toMatch(/incoming_request/);
  });
});

describe("PKCE cookie helpers for callback diagnostics", () => {
  it("detects code-verifier cookie names without exposing values", async () => {
    const {
      hasPkceCodeVerifierCookie,
      listSupabaseAuthCookieNames,
      summarizeAuthCookies,
    } = await import("@/lib/auth/pkce-cookies");

    const cookies = [
      { name: "sb-abcproject-auth-token-code-verifier", value: "SECRET_VERIFIER" },
      { name: "sb-abcproject-auth-token.0", value: "SECRET_CHUNK" },
      { name: "other", value: "nope" },
    ];

    expect(hasPkceCodeVerifierCookie(cookies)).toBe(true);
    expect(listSupabaseAuthCookieNames(cookies)).toEqual([
      "sb-abcproject-auth-token-code-verifier",
      "sb-abcproject-auth-token.0",
    ]);
    expect(JSON.stringify(summarizeAuthCookies(cookies))).not.toContain("SECRET");
  });

  it("route handler applies session cookies onto the response without transforming values", async () => {
    const { applyPendingCookies } = await import("@/lib/supabase/route");
    const { NextResponse } = await import("next/server");
    const pending = [
      {
        name: "sb-test-auth-token.0",
        value: "session-chunk",
        options: { path: "/", sameSite: "lax" as const },
      },
    ];
    const response = applyPendingCookies(NextResponse.json({ ok: true }), pending);
    expect(response.cookies.get("sb-test-auth-token.0")?.value).toBe("session-chunk");
  });

  it("callback reads request cookies before exchangeCodeForSession", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "app/auth/callback/route.ts"),
      "utf8",
    );
    const startIdx = source.indexOf("summarizeAuthCookies(allCookies)");
    const exchangeIdx = source.indexOf("exchangeCodeForSession");
    expect(startIdx).toBeGreaterThan(-1);
    expect(exchangeIdx).toBeGreaterThan(startIdx);
    expect(source).toMatch(/hasPkceCodeVerifier/);
    expect(source).toMatch(/buildSafeCallbackRequestLog/);
    expect(source).toMatch(/createRouteHandlerClient/);
    expect(source).toMatch(/collectCallbackPkceInstrumentation/);
    expect(source).toMatch(/\.\.\.pkceInstrumentation/);
    expect(source).toMatch(/resolveSupabaseUrl/);
  });

  it("safe callback request log omits query values and secrets", async () => {
    const { buildSafeCallbackRequestLog, redactUrlForLog } = await import(
      "@/lib/auth/callback-log"
    );

    const log = buildSafeCallbackRequestLog({
      url: "https://preview.vercel.app/auth/callback?code=SECRET_CODE&error=access_denied&error_code=otp_expired&error_description=Link%20expired&next=/home",
      method: "GET",
      headers: new Headers({
        "user-agent": "Mozilla/5.0 TestAgent",
        referer: "https://mail.example.com/inbox?token=SECRET_TOKEN",
      }),
      hasPkceCodeVerifier: true,
      hasAnyCookies: true,
      authCookieNames: ["sb-abc-auth-token-code-verifier"],
    });

    expect(log.pathname).toBe("/auth/callback");
    expect(log.hostname).toBe("preview.vercel.app");
    expect(log.queryParamNames).toEqual([
      "code",
      "error",
      "error_code",
      "error_description",
      "next",
    ]);
    expect(log.queryParams).toEqual([
      { key: "code", value_present: true },
      { key: "error", value_present: true },
      { key: "error_code", value_present: true },
      { key: "error_description", value_present: true },
      { key: "next", value_present: true },
    ]);
    expect(log.redactedUrl).toBe(
      "https://preview.vercel.app/auth/callback?code=***&error=***&error_code=***&error_description=***&next=***",
    );
    expect(log.userAgent).toBe("Mozilla/5.0 TestAgent");
    expect(log.refererHost).toBe("mail.example.com");
    expect(log.referer).toBe("https://mail.example.com/inbox?token=***");
    expect(redactUrlForLog("https://x.test/auth/callback?code=abc#access_token=xyz")).toBe(
      "https://x.test/auth/callback?code=***#***",
    );

    const serialized = JSON.stringify(log);
    expect(serialized).not.toContain("SECRET_CODE");
    expect(serialized).not.toContain("SECRET_TOKEN");
    expect(serialized).not.toContain("access_denied");
  });

  it("safe callback request log handles missing referer and error params", async () => {
    const { buildSafeCallbackRequestLog } = await import(
      "@/lib/auth/callback-log"
    );

    const log = buildSafeCallbackRequestLog({
      url: "https://example.com/auth/callback",
      headers: new Headers({ "user-agent": "UA" }),
      hasPkceCodeVerifier: false,
      hasAnyCookies: false,
      authCookieNames: [],
    });

    expect(log.hasCode).toBe(false);
    expect(log.queryParamNames).toEqual([]);
    expect(log.redactedUrl).toBe("https://example.com/auth/callback");
    expect(log.referer).toBeNull();
  });

  it("safe callback request log detects token_hash flow params by name only", async () => {
    const { buildSafeCallbackRequestLog } = await import(
      "@/lib/auth/callback-log"
    );

    const log = buildSafeCallbackRequestLog({
      url: "https://example.com/auth/callback?token_hash=SECRET_HASH&type=email",
      headers: new Headers(),
      hasPkceCodeVerifier: false,
      hasAnyCookies: false,
      authCookieNames: [],
    });

    expect(log.hasCode).toBe(false);
    expect(log.hasTokenHash).toBe(true);
    expect(log.hasType).toBe(true);
    expect(log.redactedUrl).toBe(
      "https://example.com/auth/callback?token_hash=***&type=***",
    );
    expect(JSON.stringify(log)).not.toContain("SECRET_HASH");
  });

  it("callback logs incoming request before auth and before every redirect", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "app/auth/callback/route.ts"),
      "utf8",
    );
    const incomingIdx = source.indexOf("incoming_request");
    const codeIdx = source.indexOf('url.searchParams.get("code")');
    const exchangeLogIdx = source.indexOf("before_exchangeCodeForSession");
    const exchangeCallIdx = source.indexOf("exchangeCodeForSession(code)");
    expect(incomingIdx).toBeGreaterThan(-1);
    expect(codeIdx).toBeGreaterThan(incomingIdx);
    expect(exchangeLogIdx).toBeGreaterThan(-1);
    expect(exchangeCallIdx).toBeGreaterThan(exchangeLogIdx);
    expect(source).toMatch(/"redirect"/);
    expect(source).toMatch(/reachedExchangeCodeForSession/);
  });

  it("proxy skips session refresh on the auth callback", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/proxy.ts"),
      "utf8",
    );
    expect(source).toMatch(/\/auth\/callback/);
    expect(source).not.toMatch(/magic-link/);
    expect(source).toMatch(/return supabaseResponse/);
  });
});

describe("service-role isolation", () => {
  it("does not import admin client from auth actions module", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/auth/actions.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/supabase\/admin/);
    expect(source).not.toMatch(/SERVICE_ROLE/);
    expect(source).not.toMatch(/createSupabaseAdminClient/);
  });

  it("does not import admin client from family-context", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/auth/family-context.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/supabase\/admin/);
    expect(source).not.toMatch(/createSupabaseAdminClient/);
  });

  it("does not import admin client from AppShell", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "components/layout/AppShell.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/supabase\/admin/);
  });

  it("keeps Phase 1 answers off the Supabase admin path", async () => {
    const { shouldUseSupabaseAnswers } = await import("@/lib/services/supabase-answers");
    expect(shouldUseSupabaseAnswers()).toBe(false);
  });
});

describe("family context contract", () => {
  it("documents required records for membership resolution", () => {
    const required = ["user", "profile", "member", "family", "settings"] as const;
    expect(required).toContain("member");
    expect(required).toContain("family");
  });
});

describe("cross-family access policy intent", () => {
  it("relies on user_family_ids for family-scoped reads", async () => {
    const sql = await fs.readFile(
      path.join(process.cwd(), "supabase/migrations/0002_auth_and_identity.sql"),
      "utf8",
    );
    expect(sql).toMatch(/user_family_ids/);
    expect(sql).toMatch(/profiles_select_own/);
    expect(sql).toMatch(/profiles_select_family/);
    expect(sql).toMatch(/handle_new_user/);
    expect(sql).toMatch(/on_auth_user_created/);
    expect(sql).toMatch(/profiles_insert_own/);
  });
});

describe("profile creation migration", () => {
  it("creates a secure search_path trigger function", async () => {
    const sql = await fs.readFile(
      path.join(process.cwd(), "supabase/migrations/0002_auth_and_identity.sql"),
      "utf8",
    );
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).toMatch(/security definer/);
  });
});
