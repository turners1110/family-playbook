/**
 * One-time / idempotent Turner Family setup.
 *
 * Requires service role. Does not hard-code private emails.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TURNER_SAM_EMAIL
 *   TURNER_MICHELLE_EMAIL
 *   TURNER_FAMILY_NAME (optional, default "Turner Family")
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();

  // Paginate through auth users (families are tiny; still written safely).
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureProfile(userId: string, email: string, displayName: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (findError) throw new Error(`Could not read profile: ${findError.message}`);
  if (existing) return;

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    email,
    display_name: displayName,
  });
  if (error) throw new Error(`Could not create profile: ${error.message}`);
}

async function main() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const samEmail = process.env.TURNER_SAM_EMAIL?.trim();
  const michelleEmail = process.env.TURNER_MICHELLE_EMAIL?.trim();
  const familyName = process.env.TURNER_FAMILY_NAME?.trim() || "Turner Family";

  if (!samEmail || !michelleEmail) {
    throw new Error("Set TURNER_SAM_EMAIL and TURNER_MICHELLE_EMAIL.");
  }

  const sam = await findAuthUserByEmail(samEmail);
  const michelle = await findAuthUserByEmail(michelleEmail);

  if (!sam) throw new Error(`No Auth user found for TURNER_SAM_EMAIL.`);
  if (!michelle) throw new Error(`No Auth user found for TURNER_MICHELLE_EMAIL.`);

  await ensureProfile(sam.id, sam.email ?? samEmail, "Sam");
  await ensureProfile(michelle.id, michelle.email ?? michelleEmail, "Michelle");

  const supabase = createSupabaseAdminClient();

  let familyId: string;
  const { data: existingFamily, error: familyFindError } = await supabase
    .from("families")
    .select("id,name")
    .eq("name", familyName)
    .maybeSingle();
  if (familyFindError) throw new Error(familyFindError.message);

  if (existingFamily) {
    familyId = existingFamily.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("families")
      .insert({ name: familyName })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Family create failed");
    familyId = created.id;
  }

  async function ensureMember(
    userId: string,
    displayName: string,
    sortOrder: number,
  ) {
    const { data: existing, error } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", familyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) return existing.id;

    const { data: created, error: createError } = await supabase
      .from("family_members")
      .insert({
        family_id: familyId,
        user_id: userId,
        display_name: displayName,
        role: "parent",
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (createError || !created) {
      throw new Error(createError?.message ?? "Member create failed");
    }
    return created.id;
  }

  await ensureMember(sam.id, "Sam", 1);
  await ensureMember(michelle.id, "Michelle", 2);

  const { data: settings, error: settingsError } = await supabase
    .from("family_settings")
    .select("family_id")
    .eq("family_id", familyId)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

  if (!settings) {
    const { error } = await supabase.from("family_settings").insert({
      family_id: familyId,
      hide_partner_answers_until_both_saved: true,
      dark_mode: "system",
      babymoon_daily_questions: 10,
      include_perspective_history_in_playbook: false,
    });
    if (error) throw new Error(error.message);
  }

  console.log(`Family ready: ${familyName} (${familyId})`);
  console.log(`Linked Sam (${sam.email}) and Michelle (${michelle.email})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
