"use client";

import { useState } from "react";
import {
  formatScoreChip,
  hasRenderableContext,
  primaryWhySeeingThis,
  specificOrNull,
  type SharedQuestionContext,
} from "@/lib/content/question-context";

export function QuestionContextPanel({
  context,
  defaultOpen = true,
  heading = "Before you answer",
}: {
  context: SharedQuestionContext;
  defaultOpen?: boolean;
  heading?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!hasRenderableContext(context)) return null;

  const why = primaryWhySeeingThis(context);
  const purpose = specificOrNull(context.purpose);
  const explanation = specificOrNull(context.explanation);
  const howTo = specificOrNull(context.howTo);
  const research = specificOrNull(context.relatedResearch);
  const examples = context.examples?.filter((e) => e.text.trim()) ?? [];
  const prompts = context.prompts?.filter((p) => p.trim()) ?? [];
  const importance = formatScoreChip(context.importance);
  const relevance = formatScoreChip(context.relevanceNow);
  const difficulty = formatScoreChip(context.difficulty);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-medium text-ink">{heading}</p>
          <p className="text-xs text-ink-muted">
            {[
              context.previouslyAnswered?.label,
              context.estimatedMinutes != null
                ? `~${context.estimatedMinutes} min`
                : null,
              context.recommendations?.[0]?.label,
            ]
              .filter(Boolean)
              .join(" · ") || "Context and priority signals"}
          </p>
        </div>
        <span className="text-xs text-ink-subtle">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {context.previouslyAnswered ? (
              <MetaChip
                label="Status"
                value={context.previouslyAnswered.label}
              />
            ) : null}
            {importance ? (
              <MetaChip label="Importance" value={importance} />
            ) : null}
            {relevance ? (
              <MetaChip label="Relevance" value={relevance} />
            ) : null}
            {difficulty ? (
              <MetaChip label="Difficulty" value={difficulty} />
            ) : null}
            {context.estimatedMinutes != null ? (
              <MetaChip
                label="Discuss"
                value={`~${context.estimatedMinutes} min`}
              />
            ) : null}
          </div>

          {(context.recommendations?.length || why) && (
            <div className="rounded-xl border border-accent/25 bg-accent-soft/30 px-3 py-2.5">
              <h3 className="text-sm font-medium text-ink">
                Why am I seeing this?
              </h3>
              {why ? (
                <p className="mt-1 text-sm text-ink-muted">{why}</p>
              ) : null}
              {context.recommendations && context.recommendations.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {context.recommendations.map((r) => (
                    <li
                      key={`${r.kind}:${r.label}`}
                      className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs font-medium text-ink"
                      title={r.reason}
                    >
                      {r.label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {context.previouslyAnswered?.previewText ? (
            <div>
              <h3 className="text-sm font-medium text-ink">Your existing answer</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {context.previouslyAnswered.previewText}
              </p>
            </div>
          ) : null}

          {purpose ? <ContextBlock title="Purpose" body={purpose} /> : null}
          {explanation ? (
            <ContextBlock title="Why this matters later" body={explanation} />
          ) : null}
          {howTo ? (
            <ContextBlock title="How to approach it" body={howTo} />
          ) : null}

          {examples.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-ink">Example answers</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Different styles—use them as springboards, not templates.
              </p>
              <ul className="mt-2 space-y-2">
                {examples.map((ex) => (
                  <li
                    key={`${ex.style}:${ex.text.slice(0, 24)}`}
                    className="rounded-xl border border-border/80 bg-bg px-3 py-2.5"
                  >
                    <p className="text-xs font-medium text-accent-strong">
                      {ex.style}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">{ex.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {prompts.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-ink">Discussion prompts</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {research ? (
            <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
              <h3 className="text-sm font-medium text-ink">Related guidance</h3>
              <p className="mt-1 text-sm text-ink-muted">{research}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ContextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-ink-muted">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}
