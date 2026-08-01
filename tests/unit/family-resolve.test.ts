import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TURNER_FAMILY_NAME,
  getTurnerFamilyNameDiagnostics,
  resolveTurnerFamilyName,
} from "@/lib/db/family-name";
import {
  RemoteStoreError,
  serializeStoreError,
} from "@/lib/db/store-errors";
import { resolveTurnerFamilyId } from "@/lib/db/remote-json-store";

function createFakeAdmin(handlers: {
  byName?: { data: Array<{ id: string; name: string }> | null; error: unknown };
  count?: { count: number | null; error: unknown };
}) {
  return {
    from(table: string) {
      if (table !== "families") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.head && opts.count === "exact") {
            return Promise.resolve({
              count: handlers.count?.count ?? 0,
              error: handlers.count?.error ?? null,
              data: null,
            });
          }
          return {
            eq() {
              return {
                limit() {
                  return Promise.resolve({
                    data: handlers.byName?.data ?? null,
                    error: handlers.byName?.error ?? null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("resolveTurnerFamilyName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses env value when present", () => {
    vi.stubEnv("TURNER_FAMILY_NAME", "  Turner Family  ");
    expect(resolveTurnerFamilyName()).toBe("Turner Family");
    expect(getTurnerFamilyNameDiagnostics()).toEqual({
      hasTurnerFamilyName: true,
      resolvedFamilyName: "Turner Family",
    });
  });

  it("falls back to Turner Family when env is missing", () => {
    vi.stubEnv("TURNER_FAMILY_NAME", undefined);
    expect(resolveTurnerFamilyName()).toBe(DEFAULT_TURNER_FAMILY_NAME);
    expect(getTurnerFamilyNameDiagnostics()).toEqual({
      hasTurnerFamilyName: false,
      resolvedFamilyName: "Turner Family",
    });
  });

  it("falls back when env is blank", () => {
    vi.stubEnv("TURNER_FAMILY_NAME", "   ");
    expect(resolveTurnerFamilyName()).toBe("Turner Family");
    expect(getTurnerFamilyNameDiagnostics().hasTurnerFamilyName).toBe(false);
  });
});

describe("serializeStoreError", () => {
  it("extracts Postgrest-like fields instead of [object Object]", () => {
    const serialized = serializeStoreError({
      message: "permission denied",
      code: "42501",
      details: "policy",
      hint: "use service role",
      status: 401,
    });
    expect(serialized).toEqual({
      name: "PostgrestError",
      message: "permission denied",
      code: "42501",
      details: "policy",
      hint: "use service role",
      status: 401,
    });
    expect(JSON.stringify(serialized)).not.toContain("[object Object]");
  });
});

describe("resolveTurnerFamilyId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns family id when found", async () => {
    vi.stubEnv("TURNER_FAMILY_NAME", "Turner Family");
    const admin = createFakeAdmin({
      byName: {
        data: [{ id: "fam-1", name: "Turner Family" }],
        error: null,
      },
    });

    await expect(
      resolveTurnerFamilyId(admin as never),
    ).resolves.toBe("fam-1");
  });

  it("throws setup error when family is not found and logs count only", async () => {
    vi.stubEnv("TURNER_FAMILY_NAME", "Turner Family");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = createFakeAdmin({
      byName: { data: [], error: null },
      count: { count: 2, error: null },
    });

    try {
      await resolveTurnerFamilyId(admin as never);
      expect.fail("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteStoreError);
      expect((error as RemoteStoreError).code).toBe("setup");
    }

    expect(spy).toHaveBeenCalledWith(
      "[store] family_not_found",
      expect.objectContaining({
        hasTurnerFamilyName: true,
        resolvedFamilyName: "Turner Family",
        familyRowCount: 2,
      }),
    );
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("secret");
    spy.mockRestore();
  });

  it("throws unavailable on Supabase query error with structured log", async () => {
    vi.stubEnv("TURNER_FAMILY_NAME", "Turner Family");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = createFakeAdmin({
      byName: {
        data: null,
        error: {
          message: "JWT expired",
          code: "PGRST301",
          details: "token",
          hint: "refresh",
          status: 401,
        },
      },
    });

    try {
      await resolveTurnerFamilyId(admin as never);
      expect.fail("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteStoreError);
      expect((error as RemoteStoreError).code).toBe("unavailable");
      expect((error as RemoteStoreError).message).toBe("Could not resolve family.");
    }

    expect(spy).toHaveBeenCalledWith(
      "[store] resolve_family",
      expect.objectContaining({
        message: "JWT expired",
        code: "PGRST301",
        details: "token",
        hint: "refresh",
        status: 401,
        hasTurnerFamilyName: true,
        resolvedFamilyName: "Turner Family",
      }),
    );
    spy.mockRestore();
  });
});
