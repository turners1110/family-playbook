/**
 * Research storage mode resolution.
 * Local filesystem is opt-in for development only — never on Vercel.
 */

import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

export type ResearchStorageMode = "supabase" | "local" | "unavailable";

export function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

export function isLocalResearchStoreEnabled() {
  return (
    process.env.USE_LOCAL_RESEARCH_STORE === "true" && !isVercelRuntime()
  );
}

export function getResearchStorageMode(): ResearchStorageMode {
  // Explicit local-dev flag wins only off Vercel.
  if (isLocalResearchStoreEnabled()) return "local";
  if (hasSupabaseAdminConfig()) return "supabase";
  return "unavailable";
}

export function researchStorageLabel(mode: ResearchStorageMode): string {
  if (mode === "supabase") return "Research storage: Supabase";
  if (mode === "local") return "Research storage: Local (development)";
  return "Research storage unavailable. New research entries are disabled.";
}

export function researchWritesAllowed(mode: ResearchStorageMode): boolean {
  return mode === "supabase" || mode === "local";
}
