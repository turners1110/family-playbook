import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;

  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    process.env[key] ??= value.replace(/^['"]|['"]$/g, "");
  }
}

describe("temporary Supabase client connection check", () => {
  test("connects through the Supabase JavaScript client", async () => {
    loadLocalEnv();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(
      supabaseUrl,
      "Set NEXT_PUBLIC_SUPABASE_URL in .env.local.",
    ).toBeTruthy();
    expect(
      supabaseKey,
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    ).toBeTruthy();

    const supabase = createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error, count, status, statusText } = await supabase
      .from("families")
      .select("id", { count: "exact", head: true });

    expect(
      error,
      `Supabase client request failed (${status} ${statusText}).`,
    ).toBeNull();

    console.log(`Supabase JS client connected. families count: ${count ?? "not visible"}`);
  });
});
