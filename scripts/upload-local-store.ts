/**
 * Upload data/local-store.json into family_json_stores for Trip Online Mode.
 *
 * Env (via .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TURNER_FAMILY_NAME (optional)
 *
 * Never prints secrets or store contents.
 */

import { promises as fs } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { assertValidAppStore } from "@/lib/db/store-errors";

async function main() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const familyName = process.env.TURNER_FAMILY_NAME?.trim() || "Turner Family";
  const storePath = path.join(process.cwd(), "data", "local-store.json");
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  assertValidAppStore(parsed);

  const admin = createSupabaseAdminClient();
  const { data: family, error: familyError } = await admin
    .from("families")
    .select("id,name")
    .eq("name", familyName)
    .maybeSingle();

  if (familyError) {
    throw new Error(`Family lookup failed: ${familyError.message}`);
  }
  if (!family) {
    throw new Error(`Family not found: ${familyName}. Run pnpm setup:family first.`);
  }

  console.log("family found:", family.name);

  const { data: existing, error: existingError } = await admin
    .from("family_json_stores")
    .select("id,version")
    .eq("family_id", family.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Store lookup failed: ${existingError.message}`);
  }

  let version = 1;
  if (existing) {
    const { data, error } = await admin
      .from("family_json_stores")
      .update({
        store_data: parsed,
        version: Number(existing.version) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("family_id", family.id)
      .select("version,updated_at")
      .single();
    if (error) throw new Error(`Upload update failed: ${error.message}`);
    version = Number(data.version);

    await admin.from("family_json_store_versions").upsert(
      {
        family_id: family.id,
        version,
        store_data: parsed,
        created_by: "upload-local-store",
      },
      { onConflict: "family_id,version" },
    );
  } else {
    const { data, error } = await admin
      .from("family_json_stores")
      .insert({
        family_id: family.id,
        store_data: parsed,
        version: 1,
      })
      .select("version,updated_at")
      .single();
    if (error) throw new Error(`Upload insert failed: ${error.message}`);
    version = Number(data.version);

    await admin.from("family_json_store_versions").insert({
      family_id: family.id,
      version: 1,
      store_data: parsed,
      created_by: "upload-local-store",
    });
  }

  const answerCount = parsed.answers.length;
  const decisionCount = parsed.decisions.length;
  const sessionCount = parsed.sessions.length;

  console.log("upload success");
  console.log("current version:", version);
  console.log(
    "record count:",
    `answers=${answerCount} decisions=${decisionCount} sessions=${sessionCount}`,
  );
  console.log("timestamp:", new Date().toISOString());
}

main().catch((error) => {
  console.error("upload failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
