/**
 * Shared-first discussion mode classification.
 * Curated rules — not AI. Applied to the full question seed set.
 */

export const DISCUSSION_MODES = [
  "shared_first",
  "separate_first",
  "either",
] as const;

export type DiscussionMode = (typeof DISCUSSION_MODES)[number];

export type DiscussionReason =
  | "Shared planning"
  | "Personal reflection"
  | "Individual values"
  | "Couple discussion"
  | "Decision requiring agreement"
  | "Either works";

export type ClassifiableQuestion = {
  id: string;
  slug: string;
  short_title: string;
  text: string;
  categories: string[];
  why_it_matters?: string;
  separate_answers_recommended?: boolean;
  discussion_mode?: DiscussionMode | null;
};

const EITHER_PATTERNS: RegExp[] = [
  /\bsuccess as parents\b/i,
  /\bnon-negotiable\b/i,
  /\bwhen values conflict\b/i,
  /\bwhat traits\b/i,
  /\bkind of relationship do we hope\b/i,
];

const REFLECTIVE_CATEGORIES = new Set([
  "core_values",
  "desired_adult_outcomes",
  "parent_partnership",
  "attachment",
  "emotional_development",
  "conflict_between_parents",
]);

const PLANNING_CATEGORIES = new Set([
  "newborn_care",
  "postpartum_recovery",
  "pregnancy",
  "sleep",
  "nutrition",
  "discipline",
  "boundaries",
  "tantrums",
  "childcare",
  "daycare",
  "preschool",
  "family_finances",
  "extended_family",
  "health",
  "learning",
  "play",
  "reading",
  "creativity",
  "family_boundaries",
]);

/** Logistics phrasing should stay shared even in reflective categories. */
const SHARED_LOGISTICS: RegExp[] = [
  /\bdivid(e|ing)\b/i,
  /\bschedule\b/i,
  /\bdut(y|ies)\b/i,
  /\blabor\b/i,
  /\bchore/i,
  /\bvisitor/i,
  /\bguest/i,
  /\bbudget\b/i,
  /\bcost\b/i,
  /\bdaycare\b/i,
  /\bpreschool\b/i,
  /\bhospital bag\b/i,
  /\bprotect time for our marriage\b/i,
];

/** Strong personal-reflection signals → separate_first. */
const SEPARATE_STRONG: RegExp[] = [
  /\bchildhoods?\b/i,
  /\bupbringing\b/i,
  /\bfamily of origin\b/i,
  /\battachment style\b/i,
  /\blove language/i,
  /\bbirth fear/i,
  /\bwhat scares (me|you|us)\b/i,
  /\bpersonal (strength|weakness|goal|hope|value)/i,
  /\b(my|your) (own )?parents\b/i,
  /\brelationship with (our |my |your )?(own )?parents\b/i,
  /\bparts of our (own )?childhood/i,
  /\bhope to repeat\b/i,
  /\bhope to change\b/i,
  /\bwithout (the other|your partner|discussing)\b/i,
  /\bbefore (we |you )?discuss/i,
  /\bindividual reflection\b/i,
  /\beach of us\b.{0,40}\b(feel|hope|fear|want|need|bring)\b/i,
  /\beach parent\b.{0,40}\b(feel|hope|fear|want|need|believe)\b/i,
];

export function classifyDiscussionMode(
  question: ClassifiableQuestion,
): {
  discussion_mode: DiscussionMode;
  discussion_reason: DiscussionReason;
  separate_answers_recommended: boolean;
} {
  const blob = `${question.short_title}\n${question.text}\n${question.why_it_matters ?? ""}`;
  const cats = question.categories ?? [];
  const reflectiveCat = cats.some((c) => REFLECTIVE_CATEGORIES.has(c));
  const planningCat = cats.some((c) => PLANNING_CATEGORIES.has(c));

  for (const re of EITHER_PATTERNS) {
    if (re.test(blob)) {
      return {
        discussion_mode: "either",
        discussion_reason: "Either works",
        separate_answers_recommended: false,
      };
    }
  }

  const looksLikeLogistics = SHARED_LOGISTICS.some((re) => re.test(blob));

  // Reflective topic families default to separate reflection unless clearly logistics.
  if (reflectiveCat && !looksLikeLogistics) {
    return {
      discussion_mode: "separate_first",
      discussion_reason: reflectiveCat
        ? "Individual values"
        : "Personal reflection",
      separate_answers_recommended: true,
    };
  }

  // Strong personal patterns outside reflective categories.
  for (const re of SEPARATE_STRONG) {
    if (re.test(blob) && !looksLikeLogistics) {
      return {
        discussion_mode: "separate_first",
        discussion_reason: "Personal reflection",
        separate_answers_recommended: true,
      };
    }
  }

  if (planningCat) {
    return {
      discussion_mode: "shared_first",
      discussion_reason: "Shared planning",
      separate_answers_recommended: false,
    };
  }

  return {
    discussion_mode: "shared_first",
    discussion_reason: "Decision requiring agreement",
    separate_answers_recommended: false,
  };
}

export function resolveEffectiveDiscussionMode(input: {
  discussion_mode?: DiscussionMode | null;
  separate_answers_recommended?: boolean;
  hasSeparateAnswers?: boolean;
  preferenceOverride?: DiscussionMode | null;
  /** When mode metadata is absent, classify from question text/categories. */
  question?: ClassifiableQuestion | null;
}): DiscussionMode {
  if (input.preferenceOverride) return input.preferenceOverride;
  if (input.discussion_mode) return input.discussion_mode;
  if (input.question) {
    return classifyDiscussionMode(input.question).discussion_mode;
  }
  if (input.hasSeparateAnswers) return "separate_first";
  return input.separate_answers_recommended ? "separate_first" : "shared_first";
}

export function discussionModeIcon(mode: DiscussionMode): {
  symbol: string;
  label: string;
} {
  switch (mode) {
    case "shared_first":
      return { symbol: "◎", label: "Shared discussion" };
    case "separate_first":
      return { symbol: "◇", label: "Separate reflection" };
    case "either":
      return { symbol: "○", label: "Either works" };
  }
}

export type ClassificationStats = {
  total: number;
  shared_first: number;
  separate_first: number;
  either: number;
  shared_first_pct: number;
  separate_first_pct: number;
  either_pct: number;
};

export function summarizeClassification(
  modes: DiscussionMode[],
): ClassificationStats {
  const total = modes.length;
  const shared_first = modes.filter((m) => m === "shared_first").length;
  const separate_first = modes.filter((m) => m === "separate_first").length;
  const either = modes.filter((m) => m === "either").length;
  return {
    total,
    shared_first,
    separate_first,
    either,
    shared_first_pct: total ? Math.round((shared_first / total) * 1000) / 10 : 0,
    separate_first_pct:
      total ? Math.round((separate_first / total) * 1000) / 10 : 0,
    either_pct: total ? Math.round((either / total) * 1000) / 10 : 0,
  };
}

/** Essentials: show separate editors only when metadata says separate-first. */
export function essentialsShowSeparateEditors(
  screen: {
    separate_answers?: boolean;
    response_type: string;
  },
  question: ClassifiableQuestion,
): boolean {
  if (screen.response_type === "paired_text") return true;
  const mode = resolveEffectiveDiscussionMode({
    discussion_mode: question.discussion_mode ?? null,
    separate_answers_recommended: question.separate_answers_recommended,
    question,
  });
  if (mode === "shared_first") return false;
  if (mode === "separate_first") return true;
  return Boolean(
    screen.separate_answers || screen.response_type === "separate_then_shared",
  );
}
