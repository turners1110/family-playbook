import type { FamilyContext } from "@/lib/auth/family-context";
import { resolveTurnerFamilyId } from "@/lib/db/remote-json-store";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string) {
  return UUID_RE.test(value);
}

/**
 * Resolve the Supabase families.id for research rows.
 * Never trusts browser-supplied family IDs — uses auth context or Turner Family lookup.
 */
export async function resolveResearchFamilyId(
  ctx: FamilyContext,
): Promise<string> {
  if (ctx.mode === "supabase" && looksLikeUuid(ctx.family.id)) {
    return ctx.family.id;
  }
  return resolveTurnerFamilyId();
}

export function canWriteResearch(ctx: FamilyContext) {
  const name = ctx.member.display_name.toLowerCase();
  return name.includes("sam") || name.includes("michelle");
}

export function assertCanWriteResearch(ctx: FamilyContext) {
  if (!canWriteResearch(ctx)) {
    throw new Error("Only Sam or Michelle can add or edit research sources.");
  }
}
