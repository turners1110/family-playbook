/**
 * Question Experience V2 response taxonomy.
 * Structured formats are independent of discussion_mode (shared-first default).
 */
export const V2_RESPONSE_MODES = [
  "open_discussion",
  "short_text",
  "single_choice",
  "multi_select",
  "ranking",
  "scale",
  "tradeoff",
  "policy_builder",
  "matrix",
  "scenario",
  "priority_pick",
  "threshold",
  "separate_then_shared",
  /** Legacy seed default — treat as open discussion in UI. */
  "open_or_policy",
] as const;

export type V2ResponseMode = (typeof V2_RESPONSE_MODES)[number];

export type V2ResponseSchema = {
  mode: V2ResponseMode;
  version?: number;
  options?: string[];
  max_selections?: number;
  scale_min?: number;
  scale_max?: number;
  scale_low_label?: string;
  scale_high_label?: string;
  matrix_rows?: string[];
  matrix_owners?: string[];
  policy_fields?: string[];
  tradeoff_a_label?: string;
  tradeoff_b_label?: string;
  scenario_options?: string[];
};

export function parseResponseSchema(
  raw: Record<string, unknown> | null | undefined,
): V2ResponseSchema {
  if (!raw || typeof raw !== "object") {
    return { mode: "open_or_policy", version: 1 };
  }
  const rawMode = String(raw.mode ?? "open_or_policy");
  const normalizedMode =
    rawMode === "multi_select_top_n"
      ? "priority_pick"
      : rawMode === "ranking_top_n"
        ? "ranking"
        : rawMode;
  const mode = normalizedMode as V2ResponseMode;
  return {
    mode: V2_RESPONSE_MODES.includes(mode) ? mode : "open_or_policy",
    version: typeof raw.version === "number" ? raw.version : 1,
    options: Array.isArray(raw.options)
      ? raw.options.map(String)
      : undefined,
    max_selections:
      typeof raw.max_selections === "number" ? raw.max_selections : undefined,
    scale_min: typeof raw.scale_min === "number" ? raw.scale_min : 1,
    scale_max: typeof raw.scale_max === "number" ? raw.scale_max : 5,
    scale_low_label:
      typeof raw.scale_low_label === "string" ? raw.scale_low_label : "Low",
    scale_high_label:
      typeof raw.scale_high_label === "string" ? raw.scale_high_label : "High",
    matrix_rows: Array.isArray(raw.matrix_rows)
      ? raw.matrix_rows.map(String)
      : undefined,
    matrix_owners: Array.isArray(raw.matrix_owners)
      ? raw.matrix_owners.map(String)
      : ["Sam", "Michelle", "Both", "Depends"],
    policy_fields: Array.isArray(raw.policy_fields)
      ? raw.policy_fields.map(String)
      : undefined,
    tradeoff_a_label:
      typeof raw.tradeoff_a_label === "string"
        ? raw.tradeoff_a_label
        : "Option A",
    tradeoff_b_label:
      typeof raw.tradeoff_b_label === "string"
        ? raw.tradeoff_b_label
        : "Option B",
    scenario_options: Array.isArray(raw.scenario_options)
      ? raw.scenario_options.map(String)
      : undefined,
  };
}

export function isStructuredMode(mode: V2ResponseMode): boolean {
  return mode !== "open_discussion" && mode !== "open_or_policy" && mode !== "short_text" && mode !== "separate_then_shared";
}

export function modeNeedsOptions(mode: V2ResponseMode): boolean {
  return (
    mode === "single_choice" ||
    mode === "multi_select" ||
    mode === "ranking" ||
    mode === "priority_pick" ||
    mode === "scenario"
  );
}
