import { createBrowserClient } from "@supabase/ssr";
import { requireBrowserSupabaseConfig } from "@/lib/supabase/browser-env";

export {
  getBrowserSupabasePublicEnvDiagnostics,
  hasSupabaseBrowserConfig,
  requireBrowserSupabaseConfig,
} from "@/lib/supabase/browser-env";

export function createClient() {
  const { url, key } = requireBrowserSupabaseConfig();
  return createBrowserClient(url, key);
}
