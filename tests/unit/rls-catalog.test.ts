import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import {
  PUBLIC_TABLE_SECURITY,
  RLS_CATEGORIES,
  SECURE_REFERENCE_TABLES,
  publicTableNames,
} from "@/lib/security/rls-catalog";
import { assertDeployedRemoteStore, usesRemoteJsonStore } from "@/lib/db/store";
import { RemoteStoreError } from "@/lib/db/store-errors";

const migrationsDir = path.join(process.cwd(), "supabase/migrations");

function allMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n\n");
}

function createdTables(sql: string): string[] {
  const names: string[] = [];
  const re = /create table if not exists public\.([a-z0-9_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql))) {
    names.push(match[1]!);
  }
  return [...new Set(names)];
}

describe("public table RLS catalog", () => {
  const sql = allMigrationSql();
  const created = createdTables(sql);
  const catalog = publicTableNames();

  it("registers every public table created by migrations", () => {
    const missing = created.filter((t) => !catalog.includes(t));
    expect(missing).toEqual([]);
  });

  it("does not catalog tables that were never created", () => {
    const extra = catalog.filter((t) => !created.includes(t));
    expect(extra).toEqual([]);
  });

  it("assigns every table an explicit security category", () => {
    for (const row of PUBLIC_TABLE_SECURITY) {
      expect(RLS_CATEGORIES).toContain(row.category);
    }
  });

  it("has no intentionally public tables (product is private)", () => {
    expect(
      PUBLIC_TABLE_SECURITY.filter((t) => t.category === "intentionally_public"),
    ).toEqual([]);
  });

  it("enables RLS on every catalogued table after 0012", () => {
    for (const row of PUBLIC_TABLE_SECURITY) {
      expect(row.rls_enabled_after, row.table).toBe(true);
    }
  });

  it("contains 46 public tables", () => {
    expect(created).toHaveLength(46);
    expect(catalog).toHaveLength(46);
  });
});

describe("question_options and outcome_development_maps", () => {
  it("were missing RLS in 0001_init.sql", () => {
    const init = readFileSync(
      path.join(migrationsDir, "0001_init.sql"),
      "utf8",
    );
    expect(init).toMatch(/create table if not exists public\.question_options/);
    expect(init).toMatch(
      /create table if not exists public\.outcome_development_maps/,
    );
    expect(init).not.toMatch(
      /alter table public\.question_options enable row level security/,
    );
    expect(init).not.toMatch(
      /alter table public\.outcome_development_maps enable row level security/,
    );
    expect(init).toMatch(
      /alter table public\.questions enable row level security/,
    );
    expect(init).toMatch(
      /create policy questions_read on public\.questions for select to authenticated/,
    );
  });

  it("are secured in 0012 with authenticated SELECT and no write policies", () => {
    const migration = readFileSync(
      path.join(migrationsDir, "0012_secure_reference_tables.sql"),
      "utf8",
    );
    for (const table of SECURE_REFERENCE_TABLES) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(`${table}_read`);
      expect(migration).toMatch(
        new RegExp(`create policy ${table}_read[\\s\\S]*for select[\\s\\S]*to authenticated`),
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from anon`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from authenticated`,
      );
      expect(migration).toContain(
        `grant select on table public.${table} to authenticated`,
      );
      expect(migration).toContain(
        `grant all on table public.${table} to service_role`,
      );
    }
    expect(migration).not.toMatch(
      /create policy question_options_\w+\s+on public\.question_options\s+for (insert|update|delete|all)/i,
    );
    expect(migration).not.toMatch(
      /create policy outcome_development_maps_\w+\s+on public\.outcome_development_maps\s+for (insert|update|delete|all)/i,
    );
  });

  it("does not rewrite or delete rows", () => {
    const migration = readFileSync(
      path.join(migrationsDir, "0012_secure_reference_tables.sql"),
      "utf8",
    );
    expect(migration.toLowerCase()).not.toMatch(/\bdelete from\b/);
    expect(migration.toLowerCase()).not.toMatch(/\bupdate public\./);
    expect(migration.toLowerCase()).not.toMatch(/\btruncate\b/);
  });
});

describe("family and service-only invariants in SQL", () => {
  const sql = allMigrationSql();

  it("keeps JSON store tables revoked from anon and authenticated", () => {
    expect(sql).toMatch(
      /revoke all on table public\.family_json_stores from anon, authenticated/,
    );
    expect(sql).toMatch(
      /revoke all on table public\.family_json_store_mutations from anon, authenticated/,
    );
  });

  it("scopes family members through user_family_ids", () => {
    expect(sql).toMatch(/create or replace function public\.user_family_ids/);
    expect(sql).toMatch(/family_id in \(select public\.user_family_ids\(\)\)/);
  });
});

describe("deployed remote store requirement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local filesystem when not on Vercel", () => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    vi.stubEnv("VERCEL", "");
    expect(usesRemoteJsonStore()).toBe(false);
    expect(() => assertDeployedRemoteStore()).not.toThrow();
  });

  it("rejects Vercel without USE_REMOTE_JSON_STORE", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    expect(() => assertDeployedRemoteStore()).toThrow(RemoteStoreError);
  });

  it("allows Vercel when remote store is enabled", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("USE_REMOTE_JSON_STORE", "true");
    expect(() => assertDeployedRemoteStore()).not.toThrow();
  });
});
