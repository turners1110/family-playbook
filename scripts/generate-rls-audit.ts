/**
 * Generate docs/supabase-rls-audit.{json,md} from the RLS catalog.
 *   pnpm exec tsx scripts/generate-rls-audit.ts
 */
import { writeFileSync } from "fs";
import path from "path";
import { PUBLIC_TABLE_SECURITY } from "../lib/security/rls-catalog";

function main() {
  const byCategory: Record<string, number> = {};
  const missingBefore = PUBLIC_TABLE_SECURITY.filter((t) => !t.rls_enabled_before);
  const missingAfter = PUBLIC_TABLE_SECURITY.filter((t) => !t.rls_enabled_after);
  for (const row of PUBLIC_TABLE_SECURITY) {
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  }

  const json = {
    generated_at: new Date().toISOString(),
    git_head_at_authoring: "4c7086c",
    migration_count: 12,
    public_table_count: PUBLIC_TABLE_SECURITY.length,
    rls_enabled_before: PUBLIC_TABLE_SECURITY.length - missingBefore.length,
    rls_enabled_after: PUBLIC_TABLE_SECURITY.length - missingAfter.length,
    tables_without_rls_before: missingBefore.map((t) => t.table),
    live_database_migration_applied: true,
    tables_without_rls_after: missingAfter.map((t) => t.table),
    category_counts: byCategory,
    reference_model:
      "Authenticated SELECT; INSERT/UPDATE/DELETE denied; service_role retains seed writes.",
    family_model:
      "RLS using user_family_ids() / parent-row family_id. Cross-family PostgREST access denied.",
    service_only_model:
      "RLS enabled + REVOKE ALL from anon/authenticated. App uses service role for family_json_stores.",
    tables: PUBLIC_TABLE_SECURITY,
  };

  writeFileSync(
    path.join(process.cwd(), "docs/supabase-rls-audit.json"),
    `${JSON.stringify(json, null, 2)}\n`,
  );

  const rows = PUBLIC_TABLE_SECURITY.map(
    (t) =>
      `| \`${t.table}\` | ${t.created_in} | ${t.rls_enabled_before ? "yes" : "**no**"} | ${t.rls_enabled_after ? "yes" : "**no**"} | ${t.category} | ${t.mismatch_before ? "yes" : "no"} | ${t.mismatch_after ? "yes" : "no"} |`,
  ).join("\n");

  const md = `# Supabase RLS audit

Generated from \`lib/security/rls-catalog.ts\`. Working migrations are authoritative.

## Totals

| Metric | Count |
|---|---|
| Public tables | ${PUBLIC_TABLE_SECURITY.length} |
| Migrations | 12 (\`0001\`–\`0012\`) |
| RLS enabled before 0012 | ${json.rls_enabled_before} |
| RLS enabled after 0012 | ${json.rls_enabled_after} |
| Missing RLS before | ${missingBefore.map((t) => t.table).join(", ") || "none"} |
| Missing RLS after | ${missingAfter.map((t) => t.table).join(", ") || "none"} |

## Categories

| Category | Count | Meaning |
|---|---|---|
| family_scoped | ${byCategory.family_scoped ?? 0} | \`user_family_ids()\` / parent family_id |
| global_reference_readonly | ${byCategory.global_reference_readonly ?? 0} | Authenticated read; no user mutations |
| service_role_only | ${byCategory.service_role_only ?? 0} | Grants revoked from anon/authenticated |
| intentionally_public | ${byCategory.intentionally_public ?? 0} | None — product is private |

## Target findings

**\`question_options\` and \`outcome_development_maps\`:** the audit finding is **valid**.

They are created in \`0001_init.sql\` next to \`questions\` / \`outcomes\`, which received \`ENABLE ROW LEVEL SECURITY\` and \`FOR SELECT TO authenticated\`. These two tables did not. With default PostgREST grants, an authenticated (or possibly anon) client could mutate global reference rows.

Fix: \`supabase/migrations/0012_secure_reference_tables.sql\`.

Desired access after 0012:

- authenticated: SELECT
- authenticated: INSERT/UPDATE/DELETE denied (no policy + REVOKE)
- anon: deny
- service_role: full (seed/admin)

## All tables

| table | created | RLS before | RLS after | category | mismatch before | mismatch after |
|---|---|---|---|---|---|---|
${rows}

## Reference content mutability

Canonical global content (\`questions\`, \`question_options\`, \`categories\`, \`outcomes\`, \`outcome_development_maps\`, \`life_stages\`, \`outcome_domains\`, recommended catalog) is **not** writable by family users.

Family customizations belong in family-scoped rows or the remote JSON AppStore (\`family_json_stores\`, service-role only).

## Applying 0012

**DATABASE MIGRATION APPLIED: yes** (live Supabase, 2026-08-19).

Sam verified in SQL Editor: both tables have RLS on; authenticated SELECT only; anon none; service_role full.

Live PostgREST tests (\`RUN_LIVE_RLS_TESTS=true\`): anon mutations and SELECT denied; authenticated SELECT allowed and mutations denied; service_role write-then-delete probe succeeded and cleaned up.

The prior unauthenticated INSERT gap is closed.
`;

  writeFileSync(path.join(process.cwd(), "docs/supabase-rls-audit.md"), md);
  console.log(
    JSON.stringify(
      {
        tables: PUBLIC_TABLE_SECURITY.length,
        missing_before: missingBefore.map((t) => t.table),
        missing_after: missingAfter.map((t) => t.table),
      },
      null,
      2,
    ),
  );
}

main();
