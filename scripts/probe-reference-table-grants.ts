/**
 * Probe whether anon can mutate reference tables (no secrets logged).
 * Deletes any probe row immediately via service role.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { createSupabaseAdminClient } = await import("../lib/supabase/admin");
  if (!url || !anon) {
    console.log(JSON.stringify({ skipped: true, reason: "no public key" }));
    return;
  }
  const publicClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createSupabaseAdminClient();

  const { data: question } = await admin.from("questions").select("id").limit(1).maybeSingle();
  const questionId = question?.id as string | undefined;

  const optionsSelect = await publicClient
    .from("question_options")
    .select("id")
    .limit(1);
  const mapsSelect = await publicClient
    .from("outcome_development_maps")
    .select("id")
    .limit(1);

  const optionsInsert = questionId
    ? await publicClient.from("question_options").insert({
        question_id: questionId,
        value: "security_probe",
        label: "security_probe",
        sort_order: 0,
      })
    : { error: { message: "no question row to probe against", code: "skip" } };

  const mapsInsert = await publicClient.from("outcome_development_maps").insert({
    outcome_id: "00000000-0000-0000-0000-000000000000",
    age_range: "security_probe",
    guidance: [],
    sort_order: 0,
  });

  const cleanupOptions = await admin
    .from("question_options")
    .delete()
    .eq("value", "security_probe");
  const cleanupMaps = await admin
    .from("outcome_development_maps")
    .delete()
    .eq("age_range", "security_probe");

  console.log(
    JSON.stringify(
      {
        question_options_anon_select_ok: !optionsSelect.error,
        question_options_anon_select_error: optionsSelect.error?.message ?? null,
        outcome_maps_anon_select_ok: !mapsSelect.error,
        outcome_maps_anon_select_error: mapsSelect.error?.message ?? null,
        question_options_anon_insert_blocked: Boolean(optionsInsert.error),
        question_options_anon_error: optionsInsert.error?.code ?? optionsInsert.error?.message ?? null,
        outcome_maps_anon_insert_blocked: Boolean(mapsInsert.error),
        outcome_maps_anon_error: mapsInsert.error?.code ?? mapsInsert.error?.message ?? null,
        probe_rows_cleaned: {
          options: cleanupOptions.error?.message ?? "ok",
          maps: cleanupMaps.error?.message ?? "ok",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
