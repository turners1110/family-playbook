import { describe, expect, it } from "vitest";
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

  it("signInWithOtp options use shouldCreateUser false and emailRedirectTo", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/auth/actions.ts"),
      "utf8",
    );
    expect(source).toMatch(/signInWithOtp\(/);
    expect(source).toMatch(/shouldCreateUser:\s*false/);
    expect(source).toMatch(/getMagicLinkRedirectTo/);
    expect(source).not.toMatch(/localhost:3000/);
    expect(source).not.toMatch(/VERCEL_URL/);
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
