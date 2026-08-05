/**
 * Shared-first discussion mode — classification + canonical resolution.
 * Curated rules — not AI.
 *
 * Product rule: default to one joint family answer.
 * Never default to separate_first because metadata is absent.
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

export type DiscussionResolutionSource =
  | "stored"
  | "seed_classifier"
  | "explicit_override"
  | "existing_separate_answers"
  | "fallback";

export type ClassifiableQuestion = {
  id: string;
  slug: string;
  short_title: string;
  text: string;
  categories: string[];
  why_it_matters?: string;
  separate_answers_recommended?: boolean;
  discussion_mode?: DiscussionMode | null;
  discussion_reason?: string | null;
};

/** Personal-reflection categories only — not couple planning. */
const REFLECTIVE_CATEGORIES = new Set([
  "core_values",
  "desired_adult_outcomes",
  "attachment",
  "emotional_development",
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
  "parent_partnership",
  "conflict_between_parents",
]);

const EITHER_PATTERNS: RegExp[] = [
  /\bsuccess as parents\b/i,
  /\bnon-negotiable\b/i,
  /\bwhen values conflict\b/i,
  /\bwhat traits\b/i,
  /\bkind of relationship do we hope\b/i,
];

/** Logistics / planning phrasing → shared even in reflective categories. */
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
  /\bcheck[- ]?in\b/i,
  /\bovernight\b/i,
  /\bfeeding\b/i,
  /\bleave\b/i,
  /\binsurance\b/i,
  /\bchildcare\b/i,
  /\bworkload\b/i,
  /\bfairness\b/i,
  /\bresentment\b/i,
  /\brelief\b/i,
  /\bdisagreement(s)? in front\b/i,
  /\boverloaded\b/i,
];

/** Strong personal-reflection signals → separate_first. */
const SEPARATE_STRONG: RegExp[] = [
  /\bchildhoods?\b/i,
  /\bupbringing\b/i,
  /\bfamily of origin\b/i,
  /\battachment style\b/i,
  /\blove language/i,
  /\bbirth fear/i,
  /\bwhat scares (me|you)\b/i,
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
  /\bprivate hopes?\b/i,
  /\bemotional needs?\b/i,
];

/**
 * Manual overrides for known Essentials / before-birth planning IDs.
 * Applied after classification so product philosophy wins over category heuristics.
 */
const FORCE_SHARED_IDS = new Set([
  "q_how_should_we_talk_about_resentment_before_it_grows",
  "q_how_will_we_check_in_weekly_about_parenting_stress",
  "q_how_should_we_handle_parenting_disagreements_in_front_of",
  "q_how_should_we_respond_when_one_parent_feels_overloaded",
  "q_what_topics_deserve_private_discussion_before_either_pare",
]);

const FORCE_SEPARATE_IDS = new Set([
  "q_what_parts_of_our_own_childhoods_do_we_hope_to_repeat",
  "q_what_parts_of_our_childhoods_do_we_hope_to_change",
]);

export function classifyDiscussionMode(
  question: ClassifiableQuestion,
): {
  discussion_mode: DiscussionMode;
  discussion_reason: DiscussionReason;
  separate_answers_recommended: boolean;
} {
  if (FORCE_SHARED_IDS.has(question.id)) {
    return {
      discussion_mode: "shared_first",
      discussion_reason: "Shared planning",
      separate_answers_recommended: false,
    };
  }
  if (FORCE_SEPARATE_IDS.has(question.id)) {
    return {
      discussion_mode: "separate_first",
      discussion_reason: "Personal reflection",
      separate_answers_recommended: true,
    };
  }

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

  if (reflectiveCat && !looksLikeLogistics) {
    return {
      discussion_mode: "separate_first",
      discussion_reason: "Individual values",
      separate_answers_recommended: true,
    };
  }

  for (const re of SEPARATE_STRONG) {
    if (re.test(blob) && !looksLikeLogistics) {
      return {
        discussion_mode: "separate_first",
        discussion_reason: "Personal reflection",
        separate_answers_recommended: true,
      };
    }
  }

  if (planningCat || looksLikeLogistics) {
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

export type ResolveDiscussionModeInput = {
  question?: ClassifiableQuestion | null;
  /** Explicit UI / session override (Capture separate, either choice, etc.). */
  preferenceOverride?: DiscussionMode | null;
  /** Existing Sam/Michelle answers that need review. */
  hasSeparateAnswers?: boolean;
  /**
   * When true, existing separate answers force separate UI even if metadata is shared_first.
   * Default true for editors; false for list badges / classification stats.
   */
  preferExistingSeparate?: boolean;
};

export type ResolvedDiscussionMode = {
  mode: DiscussionMode;
  reason: string | null;
  source: DiscussionResolutionSource;
  separate_answers_recommended: boolean;
};

/**
 * Canonical discussion-mode resolver for every surface.
 * Missing metadata → shared_first (never separate_first).
 */
export function resolveDiscussionMode(
  input: ResolveDiscussionModeInput = {},
): ResolvedDiscussionMode {
  const preferExisting = input.preferExistingSeparate !== false;

  if (input.preferenceOverride) {
    return {
      mode: input.preferenceOverride,
      reason: "Explicit choice",
      source: "explicit_override",
      separate_answers_recommended: input.preferenceOverride === "separate_first",
    };
  }

  if (preferExisting && input.hasSeparateAnswers) {
    return {
      mode: "separate_first",
      reason: "Existing separate perspectives",
      source: "existing_separate_answers",
      separate_answers_recommended: true,
    };
  }

  const q = input.question;
  if (q?.discussion_mode) {
    return {
      mode: q.discussion_mode,
      reason: q.discussion_reason ?? null,
      source: "stored",
      separate_answers_recommended: Boolean(
        q.separate_answers_recommended ?? q.discussion_mode === "separate_first",
      ),
    };
  }

  if (q && (q.id || q.slug || q.text || q.short_title)) {
    const classified = classifyDiscussionMode(q);
    return {
      mode: classified.discussion_mode,
      reason: classified.discussion_reason,
      source: "seed_classifier",
      separate_answers_recommended: classified.separate_answers_recommended,
    };
  }

  return {
    mode: "shared_first",
    reason: "Default shared family decision",
    source: "fallback",
    separate_answers_recommended: false,
  };
}

/** @deprecated Use resolveDiscussionMode — kept for gradual migration. */
export function resolveEffectiveDiscussionMode(input: {
  discussion_mode?: DiscussionMode | null;
  separate_answers_recommended?: boolean;
  hasSeparateAnswers?: boolean;
  preferenceOverride?: DiscussionMode | null;
  question?: ClassifiableQuestion | null;
}): DiscussionMode {
  return resolveDiscussionMode({
    question: input.question
      ? {
          ...input.question,
          discussion_mode:
            input.discussion_mode ?? input.question.discussion_mode,
        }
      : input.discussion_mode
        ? {
            id: "unknown",
            slug: "unknown",
            short_title: "",
            text: "",
            categories: [],
            discussion_mode: input.discussion_mode,
            separate_answers_recommended: input.separate_answers_recommended,
          }
        : null,
    preferenceOverride: input.preferenceOverride,
    hasSeparateAnswers: input.hasSeparateAnswers,
    preferExistingSeparate: Boolean(input.hasSeparateAnswers),
  }).mode;
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

/** Whether editors should show Sam/Michelle blocks. */
export function shouldShowSeparateEditors(input: {
  resolvedMode: DiscussionMode;
  hasSeparateAnswers?: boolean;
  userChoseSeparate?: boolean;
}): boolean {
  if (input.userChoseSeparate) return true;
  if (input.hasSeparateAnswers) return true;
  return input.resolvedMode === "separate_first";
}

/** Essentials: separate editors only for separate_first (or paired personal text). */
export function essentialsShowSeparateEditors(
  screen: {
    separate_answers?: boolean;
    response_type: string;
  },
  question: ClassifiableQuestion,
): boolean {
  if (screen.response_type === "paired_text") {
    const resolved = resolveDiscussionMode({
      question,
      preferExistingSeparate: false,
    });
    return resolved.mode === "separate_first" || resolved.mode === "either";
  }
  const resolved = resolveDiscussionMode({
    question,
    preferExistingSeparate: false,
  });
  return resolved.mode === "separate_first";
}

/** Diagnostics payload — never includes answer text. */
export function discussionModeDiagnostics(
  question: ClassifiableQuestion | null | undefined,
  context: {
    surface: string;
    hasSeparateAnswers?: boolean;
    preferenceOverride?: DiscussionMode | null;
  },
) {
  const resolved = resolveDiscussionMode({
    question,
    hasSeparateAnswers: context.hasSeparateAnswers,
    preferenceOverride: context.preferenceOverride,
  });
  return {
    questionId: question?.id ?? null,
    stored_discussion_mode: question?.discussion_mode ?? null,
    resolved_discussion_mode: resolved.mode,
    resolution_source: resolved.source,
    rendering_surface: context.surface,
    discussion_reason: resolved.reason,
  };
}
