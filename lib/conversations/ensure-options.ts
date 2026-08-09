import type { AppStore, QuestionOption } from "@/lib/types/models";

const TRAIT_CHILD_OPTIONS = [
  "Kindness",
  "Curiosity",
  "Resilience",
  "Honesty",
  "Independence",
  "Empathy",
  "Confidence",
  "Self-control",
  "Creativity",
  "Gratitude",
  "Integrity",
  "Responsibility",
  "Adaptability",
  "Courage",
];

const TRAIT_ADULT_OPTIONS = [
  "Integrity",
  "Self-sufficiency",
  "Emotional intelligence",
  "Work ethic",
  "Financial responsibility",
  "Compassion",
  "Adaptability",
  "Critical thinking",
  "Faith or spirituality",
  "Community-mindedness",
  "Judgment",
  "Resilience",
];

const ALLOWANCE_OPTIONS = [
  "Fully tied to chores",
  "Separate from expected chores",
  "Base allowance plus paid optional jobs",
  "No allowance",
  "Undecided, revisit later",
];

function slugValue(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function ensureOptionsForQuestion(
  store: AppStore,
  questionId: string,
  labels: string[],
): number {
  const existing = store.question_options.filter((o) => o.question_id === questionId);
  if (existing.length > 0) return 0;

  const nowOpts: QuestionOption[] = labels.map((label, i) => ({
    id: `opt_${questionId}_${slugValue(label)}`,
    question_id: questionId,
    value: slugValue(label),
    label,
    sort_order: i + 1,
  }));
  store.question_options.push(...nowOpts);
  return nowOpts.length;
}

/**
 * Idempotent: populate known empty choice sets without deleting prior answers.
 */
export function ensureConversationQuestionOptions(store: AppStore): {
  added: number;
} {
  if (!Array.isArray(store.question_options)) store.question_options = [];

  let added = 0;
  added += ensureOptionsForQuestion(
    store,
    "q_what_traits_do_we_most_hope_our_child_develops",
    TRAIT_CHILD_OPTIONS,
  );
  added += ensureOptionsForQuestion(
    store,
    "q_which_five_adult_traits_matter_most_to_us",
    TRAIT_ADULT_OPTIONS,
  );
  added += ensureOptionsForQuestion(
    store,
    "q_should_allowance_be_tied_to_chores",
    ALLOWANCE_OPTIONS,
  );

  // Soft-update legacy schemas only. Never overwrite Question Experience V2 (version >= 2).
  const childTraits = store.questions.find(
    (q) => q.id === "q_what_traits_do_we_most_hope_our_child_develops",
  );
  if (childTraits && Number(childTraits.response_schema?.version) < 2) {
    childTraits.question_type = "multiple_choice";
    childTraits.response_schema = {
      ...childTraits.response_schema,
      mode: "ranking",
      version: 2,
      max_selections: 5,
      options: TRAIT_CHILD_OPTIONS,
      allow_custom: true,
    };
  }

  const adultTraits = store.questions.find(
    (q) => q.id === "q_which_five_adult_traits_matter_most_to_us",
  );
  if (adultTraits && Number(adultTraits.response_schema?.version) < 2) {
    adultTraits.question_type = "ranking";
    adultTraits.response_schema = {
      ...adultTraits.response_schema,
      mode: "ranking",
      version: 2,
      max_rank: 5,
      options: TRAIT_ADULT_OPTIONS,
      allow_custom: true,
    };
  }

  const allowance = store.questions.find(
    (q) => q.id === "q_should_allowance_be_tied_to_chores",
  );
  if (allowance && Number(allowance.response_schema?.version) < 2) {
    allowance.question_type = "single_choice";
    allowance.response_schema = {
      ...allowance.response_schema,
      mode: "single_choice",
      version: 2,
      options: ALLOWANCE_OPTIONS,
      allow_explanation: true,
    };
  }

  return { added };
}

export const FIXED_OPTION_QUESTION_IDS = [
  "q_what_traits_do_we_most_hope_our_child_develops",
  "q_which_five_adult_traits_matter_most_to_us",
  "q_should_allowance_be_tied_to_chores",
] as const;
