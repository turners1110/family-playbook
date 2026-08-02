import type { FamilyContext } from "@/lib/auth/family-context";

/**
 * Test Lab access: Sam only by default.
 * Michelle can be enabled via ENABLE_QA_TEST_LAB_MICHELLE=true.
 */
export function canAccessTestLab(ctx: FamilyContext): boolean {
  const name = ctx.member.display_name.toLowerCase();
  const isSam = name.includes("sam");
  const isMichelle = name.includes("michelle");
  if (isSam) return true;
  if (isMichelle && process.env.ENABLE_QA_TEST_LAB_MICHELLE === "true") {
    return true;
  }
  return false;
}

export function assertCanAccessTestLab(ctx: FamilyContext) {
  if (!canAccessTestLab(ctx)) {
    throw new Error(
      "Test Lab is restricted to Sam (family administrator). Michelle access is disabled unless ENABLE_QA_TEST_LAB_MICHELLE=true.",
    );
  }
}

export function isSamActor(ctx: FamilyContext): boolean {
  return ctx.member.display_name.toLowerCase().includes("sam");
}
