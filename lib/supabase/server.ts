import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "@/lib/supabase/env";

export { hasSupabasePublicConfig } from "@/lib/supabase/env";

export async function createClient() {
  const { url, key } = requireSupabasePublicConfig();
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
