/**
 * Human-readable formatting for structured answer payloads.
 * Keeps raw structured data intact; this is the display/export layer.
 */
import type { AnswerPayload } from "@/lib/types/models";
import {
  parseResponseSchema,
  type V2ResponseSchema,
} from "@/lib/questions/response-schema";

function uniquePush(parts: string[], value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return;
  if (parts[parts.length - 1] === v) return;
  parts.push(v);
}

export function formatAnswerPayload(
  payload: AnswerPayload | null | undefined,
  schemaRaw?: Record<string, unknown> | null,
): string {
  if (!payload) return "";
  const schema = parseResponseSchema(schemaRaw ?? undefined);
  const parts: string[] = [];

  const ranking = payload.ranking?.length
    ? payload.ranking
    : schema.mode === "ranking" || schema.mode === "priority_pick"
      ? Array.isArray(payload.choice)
        ? payload.choice
        : []
      : [];

  if (ranking.length) {
    uniquePush(
      parts,
      ranking.map((item, i) => `${i + 1}. ${item}`).join("\n"),
    );
  }

  if (payload.matrix && Object.keys(payload.matrix).length) {
    uniquePush(
      parts,
      Object.entries(payload.matrix)
        .filter(([, v]) => v)
        .map(([row, owner]) => `${row}: ${owner}`)
        .join("\n"),
    );
  }

  if (payload.scale != null) {
    uniquePush(
      parts,
      `Scale: ${payload.scale} (${schema.scale_low_label}–${schema.scale_high_label})`,
    );
  }

  if (!ranking.length) {
    if (Array.isArray(payload.choice) && payload.choice.length) {
      uniquePush(parts, payload.choice.join(", "));
    } else if (typeof payload.choice === "string" && payload.choice) {
      uniquePush(
        parts,
        schema.mode === "tradeoff" ? `Chose: ${payload.choice}` : payload.choice,
      );
    }
  }

  const text = payload.text?.trim() || "";
  if (text) {
    // Skip when text is only a serialization of matrix/ranking already shown
    const alreadyShown = parts.some((p) => p === text);
    if (!alreadyShown) uniquePush(parts, text);
  } else if (!parts.length && payload.quick?.trim()) {
    uniquePush(parts, payload.quick.trim());
  }

  if (payload.notes?.trim()) {
    uniquePush(parts, `Notes: ${payload.notes.trim()}`);
  }

  return parts.join("\n\n");
}

export function formatAnswerPayloadHtml(
  payload: AnswerPayload | null | undefined,
  schemaRaw?: Record<string, unknown> | null,
): string {
  return formatAnswerPayload(payload, schemaRaw);
}

/** Prefer structured summary text for Decision/current position. */
export function answerToReadableSummary(
  payload: AnswerPayload,
  schema?: V2ResponseSchema | Record<string, unknown> | null,
): string {
  const raw =
    schema && "mode" in schema
      ? (schema as Record<string, unknown>)
      : (schema as Record<string, unknown> | null | undefined);
  const formatted = formatAnswerPayload(payload, raw);
  if (formatted.trim()) return formatted.trim();
  return payload.text?.trim() || payload.quick?.trim() || "";
}
