import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function hasSupabasePublicConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch (error) {
          // Server Components cannot write cookies; the proxy refreshes sessions.
          // In Server Actions / Route Handlers this should not fail — log names only.
          console.error("[auth] supabase cookie setAll failed", {
            cookieNames: cookiesToSet.map(({ name }) => name),
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  });
}
