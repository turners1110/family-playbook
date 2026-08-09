/**
 * Shared “Before you answer” context across Essentials, Conversations, and library.
 * Prefer leaving fields blank over showing generic filler.
 */
import type { Score1to5 } from "@/lib/essentials/screen-context";
import { scoreLabel } from "@/lib/essentials/screen-context";

export type SampleAnswer = {
  style: string;
  text: string;
};

export type SoftRecommendationKind =
  | "recommended_first"
  | "related"
  | "best_after"
  | "high_impact"
  | "stage_relevant"
  | "from_earlier_answer"
  | "previously_answered";

export type SoftRecommendation = {
  kind: SoftRecommendationKind;
  label: string;
  reason: string;
};

export type PreviouslyAnsweredMeta = {
  label: string;
  previewText?: string | null;
  fullyAnswered: boolean;
};

export type SharedQuestionContext = {
  purpose?: string | null;
  explanation?: string | null;
  howTo?: string | null;
  examples?: SampleAnswer[];
  prompts?: string[];
  relatedResearch?: string | null;
  importance?: Score1to5 | null;
  relevanceNow?: Score1to5 | null;
  difficulty?: Score1to5 | null;
  estimatedMinutes?: number | null;
  previouslyAnswered?: PreviouslyAnsweredMeta | null;
  recommendations?: SoftRecommendation[];
  /** Primary “Why am I seeing this?” copy (also derived from recommendations). */
  whySeeingThis?: string | null;
};

/** Seed / template strings that must never appear as “specific” context. */
export const GENERIC_CONTEXT_MARKERS = [
  "This choice shapes daily family life and the adult your child becomes",
  "This shapes daily choices and long-term outcomes",
  "Talk through values, tradeoffs, and what you would revisit later",
  "Listen first, then look for the shared principle underneath the preference",
  "Clarify preferences, name tradeoffs, and note what would make you revisit",
  "Answer separately if needed, then look for a shared principle",
  "No specific research loaded",
  "This shapes nearby decisions in",
];

export function isSpecificContextText(
  value: string | null | undefined,
): value is string {
  const text = value?.trim();
  if (!text || text.length < 12) return false;
  return !GENERIC_CONTEXT_MARKERS.some((m) => text.includes(m));
}

export function specificOrNull(
  value: string | null | undefined,
): string | null {
  return isSpecificContextText(value) ? value.trim() : null;
}

export function hasRenderableContext(ctx: SharedQuestionContext): boolean {
  return Boolean(
    specificOrNull(ctx.purpose) ||
      specificOrNull(ctx.explanation) ||
      specificOrNull(ctx.howTo) ||
      (ctx.examples && ctx.examples.length > 0) ||
      (ctx.prompts && ctx.prompts.length > 0) ||
      specificOrNull(ctx.relatedResearch) ||
      ctx.importance != null ||
      ctx.relevanceNow != null ||
      ctx.difficulty != null ||
      ctx.estimatedMinutes != null ||
      ctx.previouslyAnswered ||
      (ctx.recommendations && ctx.recommendations.length > 0) ||
      specificOrNull(ctx.whySeeingThis),
  );
}

export function formatScoreChip(
  score: Score1to5 | null | undefined,
): string | null {
  if (score == null) return null;
  return `${scoreLabel(score)} · ${score}/5`;
}

export const SOFT_REC_LABELS: Record<SoftRecommendationKind, string> = {
  recommended_first: "Recommended first",
  related: "Related question",
  best_after: "Best answered after…",
  high_impact: "High impact",
  stage_relevant: "Relevant for your stage",
  from_earlier_answer: "Suggested by an earlier answer",
  previously_answered: "Previously answered",
};

export function softRec(
  kind: SoftRecommendationKind,
  reason: string,
  label?: string,
): SoftRecommendation {
  return {
    kind,
    label: label ?? SOFT_REC_LABELS[kind],
    reason,
  };
}

export function primaryWhySeeingThis(
  ctx: SharedQuestionContext,
): string | null {
  if (specificOrNull(ctx.whySeeingThis)) return ctx.whySeeingThis!.trim();
  const first = ctx.recommendations?.[0];
  return first?.reason ?? null;
}
