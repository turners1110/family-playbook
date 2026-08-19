import type { V2ResponseSchema } from "@/lib/questions/response-schema";

type StructuredValue = {
  text: string;
  choice: string | string[];
  ranking: string[];
  scale: number | null;
  matrix: Record<string, string>;
};

const SHORT_TEXT_MAX = 500;

/** Lightweight UX checks. Server Zod remains authoritative. */
export function clientValidateStructuredAnswer(
  schema: V2ResponseSchema,
  value: StructuredValue,
): string | null {
  if (schema.mode === "ranking") {
    const ranking = value.ranking.length > 0 ? value.ranking : (schema.options ?? []);
    if (new Set(ranking).size !== ranking.length) {
      return "Cannot rank the same option twice.";
    }
  }

  if (schema.mode === "priority_pick") {
    const selected = Array.isArray(value.choice) ? value.choice : [];
    const need = schema.max_selections ?? 3;
    if (selected.length !== need) {
      return `Select ${need} before saving.`;
    }
  }

  if (schema.mode === "matrix") {
    const rows = schema.matrix_rows ?? [];
    if (rows.some((row) => !value.matrix[row]?.trim())) {
      return "Every row needs an assignment.";
    }
  }

  if (schema.mode === "policy_builder") {
    const fields = schema.policy_fields ?? schema.options ?? [];
    for (const field of fields) {
      const line = value.text.split("\n").find((l) => l.startsWith(`${field}:`));
      if (!line || !line.slice(field.length + 1).trim()) {
        return "Required policy field missing.";
      }
    }
  }

  if (schema.mode === "short_text" && value.text.length > SHORT_TEXT_MAX) {
    return `Keep this response under ${SHORT_TEXT_MAX} characters.`;
  }

  return null;
}
