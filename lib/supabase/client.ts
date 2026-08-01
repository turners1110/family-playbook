import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "@/lib/supabase/env";

export { hasSupabaseBrowserConfig, hasSupabasePublicConfig } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = requireSupabasePublicConfig();
  return createBrowserClient(url, key);
}
