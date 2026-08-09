"use client";

import { clsx } from "clsx";
import type { AnswerPayload } from "@/lib/types/models";
import {
  parseResponseSchema,
  type V2ResponseSchema,
} from "@/lib/questions/response-schema";

export type StructuredAnswerValue = {
  text: string;
  choice: string | string[];
  ranking: string[];
  scale: number | null;
  matrix: Record<string, string>;
};

export function structuredValueFromPayload(
  payload: AnswerPayload | undefined,
  schema: V2ResponseSchema,
): StructuredAnswerValue {
  const choice = payload?.choice;
  return {
    text: payload?.text ?? "",
    choice: choice ?? (schema.mode === "multi_select" || schema.mode === "priority_pick" ? [] : ""),
    ranking: payload?.ranking ?? (Array.isArray(choice) ? choice : []),
    scale: payload?.scale ?? null,
    matrix: payload?.matrix ?? {},
  };
}

export function StructuredAnswerFields({
  schemaRaw,
  value,
  onChange,
  disabled,
}: {
  schemaRaw: Record<string, unknown> | null | undefined;
  value: StructuredAnswerValue;
  onChange: (next: StructuredAnswerValue) => void;
  disabled?: boolean;
}) {
  const schema = parseResponseSchema(schemaRaw);
  const options = schema.options ?? schema.scenario_options ?? [];

  if (schema.mode === "open_or_policy" || schema.mode === "open_discussion") {
    return (
      <textarea
        className="input min-h-32 w-full"
        value={value.text}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="Shared family response"
      />
    );
  }

  if (schema.mode === "short_text" || schema.mode === "threshold") {
    return (
      <textarea
        className="input min-h-20 w-full"
        value={value.text}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder={
          schema.mode === "threshold"
            ? "At what point would we change course?"
            : "Short shared response"
        }
      />
    );
  }

  if (schema.mode === "scale") {
    const min = schema.scale_min ?? 1;
    const max = schema.scale_max ?? 5;
    const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-ink-muted">
          <span>{schema.scale_low_label}</span>
          <span>{schema.scale_high_label}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {points.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              className={clsx(
                "min-h-11 min-w-11 rounded-xl border text-sm font-medium",
                value.scale === n
                  ? "border-accent bg-accent/10"
                  : "border-border",
              )}
              onClick={() => onChange({ ...value, scale: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (
    schema.mode === "single_choice" ||
    schema.mode === "scenario" ||
    schema.mode === "tradeoff"
  ) {
    const opts =
      schema.mode === "tradeoff"
        ? [schema.tradeoff_a_label!, schema.tradeoff_b_label!, "Depends / both with conditions"]
        : options;
    const selected = typeof value.choice === "string" ? value.choice : "";
    return (
      <div className="space-y-2">
        {opts.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            className={clsx(
              "min-h-12 w-full rounded-xl border px-3 py-3 text-left text-sm",
              selected === option
                ? "border-accent bg-accent/10"
                : "border-border",
            )}
            onClick={() => onChange({ ...value, choice: option })}
          >
            {option}
          </button>
        ))}
        {schema.mode !== "tradeoff" ? (
          <textarea
            className="input mt-2 min-h-20 w-full"
            value={value.text}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder="Optional detail"
          />
        ) : (
          <textarea
            className="input mt-2 min-h-20 w-full"
            value={value.text}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder="What conditions or exceptions apply?"
          />
        )}
      </div>
    );
  }

  if (schema.mode === "multi_select" || schema.mode === "priority_pick") {
    const selected = Array.isArray(value.choice) ? value.choice : [];
    const max =
      schema.max_selections ??
      (schema.mode === "priority_pick" ? 3 : 99);
    return (
      <div className="space-y-2">
        <p className="text-xs text-ink-muted">
          {max < 99 ? `Select up to ${max}` : "Select all that apply"}
        </p>
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              className={clsx(
                "min-h-12 w-full rounded-xl border px-3 py-3 text-left text-sm",
                on ? "border-accent bg-accent/10" : "border-border",
              )}
              onClick={() => {
                if (on) {
                  onChange({
                    ...value,
                    choice: selected.filter((x) => x !== option),
                  });
                  return;
                }
                if (selected.length >= max) return;
                onChange({ ...value, choice: [...selected, option] });
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (schema.mode === "ranking") {
    const ranking =
      value.ranking.length > 0
        ? value.ranking
        : options;
    return (
      <div className="space-y-2">
        <p className="text-xs text-ink-muted">
          Tap to move an item up. Order = priority (1 = highest).
        </p>
        {ranking.map((item, index) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <span className="w-6 text-sm font-medium text-ink-muted">
              {index + 1}.
            </span>
            <span className="flex-1 text-sm">{item}</span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={disabled || index === 0}
              onClick={() => {
                const next = [...ranking];
                const tmp = next[index - 1]!;
                next[index - 1] = next[index]!;
                next[index] = tmp;
                onChange({ ...value, ranking: next, choice: next });
              }}
            >
              Up
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (schema.mode === "matrix") {
    const rows = schema.matrix_rows ?? [];
    const owners = schema.matrix_owners ?? ["Sam", "Michelle", "Both", "Depends"];
    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <label key={row} className="block text-sm">
            <span className="font-medium">{row}</span>
            <select
              className="input mt-1"
              disabled={disabled}
              value={value.matrix[row] ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  matrix: { ...value.matrix, [row]: e.target.value },
                })
              }
            >
              <option value="">Choose…</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }

  if (schema.mode === "policy_builder") {
    const fields = schema.policy_fields ?? options;
    return (
      <div className="space-y-3">
        {fields.map((field) => {
          const lines = value.text.split("\n");
          const hit = lines.find((l) => l.startsWith(`${field}:`));
          const fieldValue = hit ? hit.slice(field.length + 1).trim() : "";
          return (
            <label key={field} className="block text-sm">
              <span className="font-medium">{field}</span>
              <input
                className="input mt-1"
                disabled={disabled}
                value={fieldValue}
                onChange={(e) => {
                  const map = new Map<string, string>();
                  for (const f of fields) {
                    const line = value.text
                      .split("\n")
                      .find((l) => l.startsWith(`${f}:`));
                    map.set(f, line ? line.slice(f.length + 1).trim() : "");
                  }
                  map.set(field, e.target.value);
                  onChange({
                    ...value,
                    text: fields
                      .map((f) => `${f}: ${map.get(f) ?? ""}`)
                      .join("\n"),
                  });
                }}
              />
            </label>
          );
        })}
      </div>
    );
  }

  // separate_then_shared falls back to open text in shared editor
  return (
    <textarea
      className="input min-h-32 w-full"
      value={value.text}
      disabled={disabled}
      onChange={(e) => onChange({ ...value, text: e.target.value })}
    />
  );
}

export function structuredValueToPayload(
  value: StructuredAnswerValue,
  schemaRaw: Record<string, unknown> | null | undefined,
  notes: string,
): AnswerPayload {
  const schema = parseResponseSchema(schemaRaw);
  const payload: AnswerPayload = { notes: notes || undefined };
  switch (schema.mode) {
    case "scale":
      payload.scale = value.scale ?? undefined;
      payload.text = value.text || undefined;
      break;
    case "ranking":
    case "priority_pick":
      payload.ranking = value.ranking.length ? value.ranking : undefined;
      payload.choice = Array.isArray(value.choice) ? value.choice : value.ranking;
      break;
    case "multi_select":
      payload.choice = Array.isArray(value.choice) ? value.choice : [];
      break;
    case "single_choice":
    case "scenario":
    case "tradeoff":
      payload.choice = typeof value.choice === "string" ? value.choice : "";
      payload.text = value.text || undefined;
      break;
    case "matrix":
      payload.matrix = value.matrix;
      payload.text = Object.entries(value.matrix)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      break;
    case "policy_builder":
      payload.text = value.text;
      break;
    default:
      payload.text = value.text;
  }
  return payload;
}
