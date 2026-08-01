import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
  SupabaseConfigError,
  hasSupabasePublicConfig,
  requireSupabasePublicConfig,
  resolveSupabasePublicKey,
  resolveSupabasePublicKeySource,
} from "@/lib/supabase/env";
import { getAppOrigin, getMagicLinkRedirectTo } from "@/lib/auth/app-url";

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

describe("server resolveSupabasePublicKey", () => {
  it("uses publishable key when only that is set", () => {
    const testEnv = env({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk-test",
    });

    expect(resolveSupabasePublicKey(testEnv)).toBe("pk-test");
    expect(resolveSupabasePublicKeySource(testEnv)).toBe("publishable");
    expect(hasSupabasePublicConfig(testEnv)).toBe(true);
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
    expect(hasSupabasePublicConfig(testEnv)).toBe(true);
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
    expect(hasSupabasePublicConfig(testEnv)).toBe(false);

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

describe("browser-compatible static env path", () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const;

  const original: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function stashEnv() {
    for (const key of keys) {
      original[key] = process.env[key];
    }
  }

  function clearPublicEnv() {
    for (const key of keys) {
      delete process.env[key];
    }
  }

  it("source uses static process.env property access (Next.js inlining)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/browser-env.ts"),
      "utf8",
    );

    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_APP_URL/);
    expect(source).not.toMatch(/process\.env\[/);
    expect(source).not.toMatch(/Object\.keys\(process\.env\)/);
    expect(source).not.toMatch(/env:\s*NodeJS\.ProcessEnv/);
    expect(source).not.toMatch(/SERVICE_ROLE/);
    expect(source).not.toMatch(/next\/headers/);
  });

  it("client module imports browser-env only (not server env helper)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/supabase/client.ts"),
      "utf8",
    );
    expect(source).toMatch(/@\/lib\/supabase\/browser-env/);
    expect(source).toMatch(/requireBrowserSupabaseConfig/);
    expect(source).not.toMatch(/@\/lib\/supabase\/env["']/);
    expect(source).not.toMatch(/SERVICE_ROLE/);
    expect(source).not.toMatch(/next\/headers/);
  });

  it("uses publishable key only via static process.env", async () => {
    stashEnv();
    clearPublicEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk-test";
    vi.resetModules();

    const mod = await import("@/lib/supabase/browser-env");
    expect(mod.resolveBrowserSupabasePublicKey()).toBe("pk-test");
    expect(mod.resolveBrowserSupabasePublicKeySource()).toBe("publishable");
    expect(mod.hasSupabaseBrowserConfig()).toBe(true);
    expect(mod.requireBrowserSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      key: "pk-test",
      keySource: "publishable",
    });
    expect(mod.getBrowserSupabasePublicEnvDiagnostics()).toEqual({
      hasUrl: true,
      hasPublishableKey: true,
      hasAnonKey: false,
      hasAppUrl: false,
    });
  });

  it("uses anon key only via static process.env", async () => {
    stashEnv();
    clearPublicEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    vi.resetModules();

    const mod = await import("@/lib/supabase/browser-env");
    expect(mod.resolveBrowserSupabasePublicKey()).toBe("anon-test");
    expect(mod.resolveBrowserSupabasePublicKeySource()).toBe("anon");
    expect(mod.hasSupabaseBrowserConfig()).toBe(true);
    expect(mod.getBrowserSupabasePublicEnvDiagnostics()).toEqual({
      hasUrl: true,
      hasPublishableKey: false,
      hasAnonKey: true,
      hasAppUrl: false,
    });
  });

  it("prefers publishable key when both exist", async () => {
    stashEnv();
    clearPublicEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk-preferred";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-fallback";
    vi.resetModules();

    const mod = await import("@/lib/supabase/browser-env");
    expect(mod.resolveBrowserSupabasePublicKey()).toBe("pk-preferred");
    expect(mod.resolveBrowserSupabasePublicKeySource()).toBe("publishable");
  });

  it("reports neither key present", async () => {
    stashEnv();
    clearPublicEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    vi.resetModules();

    const mod = await import("@/lib/supabase/browser-env");
    expect(mod.resolveBrowserSupabasePublicKey()).toBeNull();
    expect(mod.hasSupabaseBrowserConfig()).toBe(false);
    expect(mod.getBrowserSupabasePublicEnvDiagnostics()).toEqual({
      hasUrl: true,
      hasPublishableKey: false,
      hasAnonKey: false,
      hasAppUrl: false,
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let thrown: unknown;
      try {
        mod.requireBrowserSupabaseConfig();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).name).toBe("SupabaseConfigError");
      expect((thrown as { reason?: string }).reason).toBe("missing_public_key");
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

  it("app-url uses static process.env when called without override", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/auth/app-url.ts"),
      "utf8",
    );
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_APP_URL/);
    expect(source).toMatch(/process\.env\.NODE_ENV/);
  });
});
