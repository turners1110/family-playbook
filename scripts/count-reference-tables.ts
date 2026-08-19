/**
 * Safe metadata counts for reference tables (no family answers).
 *   pnpm exec tsx scripts/count-reference-tables.ts
 */
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseAdminClient, hasSupabaseAdminConfig } = await import(
    "../lib/supabase/admin"
  );
  if (!hasSupabaseAdminConfig()) {
    console.log(JSON.stringify({ skipped: true, reason: "no admin config" }));
    return;
  }
  const admin = createSupabaseAdminClient();
  const tables = [
    "questions",
    "question_options",
    "outcome_development_maps",
    "outcomes",
    "life_stages",
    "categories",
  ] as const;
  const counts: Record<string, number | string> = {};
  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    counts[table] = error ? `error: ${error.message}` : (count ?? 0);
  }
  const report = {
    generated_at: new Date().toISOString(),
    note: "Service-role counts. Does not prove RLS. No family answers exported.",
    counts,
  };
  writeFileSync(
    path.join(process.cwd(), "docs/supabase-rls-row-counts.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
