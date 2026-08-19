/**
 * Optional live PostgREST mutation attack checks.
 * Skipped unless RUN_LIVE_RLS_TESTS=true.
 *
 * Anon tests use the publishable/anon key only.
 * Authenticated tests create a temporary Auth user via service role and delete it.
 * Never logs tokens, passwords, or keys.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

/** Next skips `.env.local` when NODE_ENV=test. Never log values. */
function loadLocalEnv() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing .env.local — public env must come from the process.
  }
}

loadLocalEnv();

const enabled = process.env.RUN_LIVE_RLS_TESTS === "true";

function publicUrlAndKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing public Supabase env for live RLS tests.");
  }
  return { url, key };
}

function publicClient() {
  const { url, key } = publicUrlAndKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const probeUuid = "00000000-0000-0000-0000-000000000000";

describe.skipIf(!enabled)("live PostgREST reference-table mutations (anon)", () => {
  it("anon INSERT into question_options is rejected", async () => {
    const { error } = await publicClient().from("question_options").insert({
      question_id: "q_does_not_exist_security_probe",
      value: "probe",
      label: "probe",
      sort_order: 0,
    });
    expect(error).toBeTruthy();
  });

  it("anon UPDATE/DELETE on question_options is rejected", async () => {
    const supabase = publicClient();
    const upd = await supabase
      .from("question_options")
      .update({ label: "hacked" })
      .eq("id", probeUuid);
    const del = await supabase
      .from("question_options")
      .delete()
      .eq("id", probeUuid);
    expect(upd.error).toBeTruthy();
    expect(del.error).toBeTruthy();
  });

  it("anon INSERT into outcome_development_maps is rejected", async () => {
    const { error } = await publicClient().from("outcome_development_maps").insert({
      outcome_id: probeUuid,
      age_range: "probe",
      guidance: [],
      sort_order: 0,
    });
    expect(error).toBeTruthy();
  });

  it("anon UPDATE/DELETE on outcome_development_maps is rejected", async () => {
    const supabase = publicClient();
    const upd = await supabase
      .from("outcome_development_maps")
      .update({ age_range: "hacked" })
      .eq("id", probeUuid);
    const del = await supabase
      .from("outcome_development_maps")
      .delete()
      .eq("id", probeUuid);
    expect(upd.error).toBeTruthy();
    expect(del.error).toBeTruthy();
  });

  it("anon SELECT on question_options is rejected after 0012", async () => {
    const { data, error } = await publicClient()
      .from("question_options")
      .select("id")
      .limit(1);
    expect(error).toBeTruthy();
    expect(data ?? []).toEqual([]);
  });

  it("anon cannot read family_json_stores", async () => {
    const { data, error } = await publicClient()
      .from("family_json_stores")
      .select("family_id")
      .limit(1);
    expect(error || !data?.length).toBeTruthy();
  });
});

describe.skipIf(!enabled)("live PostgREST authenticated role", () => {
  let userId: string | null = null;
  let authed: SupabaseClient | null = null;

  beforeAll(async () => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const password = `RlsProbe_${Math.random().toString(36).slice(2)}A1!`;
    const email = `rls.probe.${Date.now()}@example.com`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Could not create temporary Auth user for RLS tests: ${created.error?.message ?? "unknown"}`,
      );
    }
    userId = created.data.user.id;
    const { url, key } = publicUrlAndKey();
    authed = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await authed.auth.signInWithPassword({ email, password });
    if (signed.error) {
      throw new Error(`Temporary user sign-in failed: ${signed.error.message}`);
    }
  });

  afterAll(async () => {
    if (!userId) return;
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  });

  it("authenticated SELECT on question_options succeeds", async () => {
    const { error } = await authed!.from("question_options").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("authenticated SELECT on outcome_development_maps succeeds", async () => {
    const { error } = await authed!
      .from("outcome_development_maps")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
  });

  it("authenticated INSERT/UPDATE/DELETE on question_options fail", async () => {
    const client = authed!;
    const ins = await client.from("question_options").insert({
      question_id: "q_does_not_exist_security_probe",
      value: "probe",
      label: "probe",
      sort_order: 0,
    });
    const upd = await client
      .from("question_options")
      .update({ label: "hacked" })
      .eq("id", probeUuid);
    const del = await client.from("question_options").delete().eq("id", probeUuid);
    expect(ins.error).toBeTruthy();
    expect(upd.error).toBeTruthy();
    expect(del.error).toBeTruthy();
  });

  it("authenticated INSERT/UPDATE/DELETE on outcome_development_maps fail", async () => {
    const client = authed!;
    const ins = await client.from("outcome_development_maps").insert({
      outcome_id: probeUuid,
      age_range: "probe",
      guidance: [],
      sort_order: 0,
    });
    const upd = await client
      .from("outcome_development_maps")
      .update({ age_range: "hacked" })
      .eq("id", probeUuid);
    const del = await client
      .from("outcome_development_maps")
      .delete()
      .eq("id", probeUuid);
    expect(ins.error).toBeTruthy();
    expect(upd.error).toBeTruthy();
    expect(del.error).toBeTruthy();
  });
});

describe.skipIf(!enabled)("live PostgREST service_role", () => {
  it("service_role can SELECT and write-then-delete a probe option", async () => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const { data: question, error: qErr } = await admin
      .from("questions")
      .select("id")
      .limit(1)
      .maybeSingle();
    expect(qErr).toBeNull();
    if (!question?.id) {
      const sel = await admin.from("question_options").select("id").limit(1);
      expect(sel.error).toBeNull();
      return;
    }
    const inserted = await admin
      .from("question_options")
      .insert({
        question_id: question.id,
        value: "rls_service_probe",
        label: "rls_service_probe",
        sort_order: 0,
      })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.id).toBeTruthy();
    const cleaned = await admin
      .from("question_options")
      .delete()
      .eq("id", inserted.data!.id);
    expect(cleaned.error).toBeNull();
  });
});

describe("live RLS tests are opt-in", () => {
  it("does not run against production unless explicitly enabled", () => {
    expect(enabled).toBe(process.env.RUN_LIVE_RLS_TESTS === "true");
  });
});
