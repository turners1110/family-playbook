import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseConfigError,
  hasSupabaseBrowserConfig,
  requireSupabasePublicConfig,
  resolveSupabasePublicKey,
  resolveSupabasePublicKeySource,
} from "@/lib/supabase/env";
import { getAppOrigin, getMagicLinkRedirectTo } from "@/lib/auth/app-url";

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

describe("resolveSupabasePublicKey", () => {
  it("uses publishable key when only that is set", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk-test",
    });

    expect(resolveSupabasePublicKey(testEnv)).toBe("pk-test");
    expect(resolveSupabasePublicKeySource(testEnv)).toBe("publishable");
    expect(hasSupabaseBrowserConfig(testEnv)).toBe(true);
    expect(requireSupabasePublicConfig(testEnv)).toEqual({
      url: "https://example.supabase.co",
      key: "pk-test",
      keySource: "publishable",
    });
  });

  it("uses anon key when only that is set", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
    });

    expect(resolveSupabasePublicKey(testEnv)).toBe("anon-test");
    expect(resolveSupabasePublicKeySource(testEnv)).toBe("anon");
    expect(hasSupabaseBrowserConfig(testEnv)).toBe(true);
    expect(requireSupabasePublicConfig(testEnv)).toEqual({
      url: "https://example.supabase.co",
      key: "anon-test",
      keySource: "anon",
    });
  });

  it("prefers publishable key when both exist", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk-preferred",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-fallback",
    });

    expect(resolveSupabasePublicKey(testEnv)).toBe("pk-preferred");
    expect(resolveSupabasePublicKeySource(testEnv)).toBe("publishable");
    expect(requireSupabasePublicConfig(testEnv).key).toBe("pk-preferred");
  });

  it("returns null / throws when neither key is present", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(resolveSupabasePublicKey(testEnv)).toBeNull();
    expect(resolveSupabasePublicKeySource(testEnv)).toBeNull();
    expect(hasSupabaseBrowserConfig(testEnv)).toBe(false);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let thrown: unknown;
      try {
        requireSupabasePublicConfig(testEnv);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SupabaseConfigError);
      expect((thrown as SupabaseConfigError).reason).toBe("missing_public_key");
      expect(spy).toHaveBeenCalledWith(
        "[supabase] config error",
        expect.objectContaining({ reason: "missing_public_key" }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("throws missing_url when URL is absent", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk-test",
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let thrown: unknown;
      try {
        requireSupabasePublicConfig(testEnv);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SupabaseConfigError);
      expect((thrown as SupabaseConfigError).reason).toBe("missing_url");
      expect(spy).toHaveBeenCalledWith(
        "[supabase] config error",
        expect.objectContaining({ reason: "missing_url" }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe("invalid NEXT_PUBLIC_APP_URL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws invalid_app_url for malformed URLs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testEnv = env({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "not a url",
    });

    try {
      let thrown: unknown;
      try {
        getAppOrigin(testEnv);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SupabaseConfigError);
      expect((thrown as SupabaseConfigError).reason).toBe("invalid_app_url");
      expect(spy).toHaveBeenCalledWith(
        "[supabase] config error",
        expect.objectContaining({ reason: "invalid_app_url" }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("throws invalid_app_url for localhost outside development", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testEnv = env({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    try {
      let thrown: unknown;
      try {
        getMagicLinkRedirectTo(testEnv);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SupabaseConfigError);
      expect((thrown as SupabaseConfigError).reason).toBe("invalid_app_url");
      expect(spy).toHaveBeenCalledWith(
        "[supabase] config error",
        expect.objectContaining({ reason: "invalid_app_url" }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
