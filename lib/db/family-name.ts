/**
 * Server-only Turner Family name resolution for remote JSON store.
 * Uses a static process.env.TURNER_FAMILY_NAME read (no dynamic access).
 */

export const DEFAULT_TURNER_FAMILY_NAME = "Turner Family";

/**
 * Resolve the family name used for exact families.name lookup.
 * Missing/blank env → "Turner Family".
 */
export function resolveTurnerFamilyName(): string {
  const configured = process.env.TURNER_FAMILY_NAME;
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed || DEFAULT_TURNER_FAMILY_NAME;
}

export function getTurnerFamilyNameDiagnostics() {
  const raw = process.env.TURNER_FAMILY_NAME;
  const hasTurnerFamilyName = Boolean(
    typeof raw === "string" && raw.trim().length > 0,
  );
  return {
    hasTurnerFamilyName,
    resolvedFamilyName: resolveTurnerFamilyName(),
  };
}
