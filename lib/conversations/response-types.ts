/**
 * Shared conversation response-type definitions.
 * Used by cards, session builder, Essentials companions, and Content Review.
 */

export const CONVERSATION_RESPONSE_TYPES = [
  "quick_pick",
  "either_or",
  "short_text",
  "open_time_boxed",
  "reaction_scale",
] as const;

export type ConversationResponseType =
  (typeof CONVERSATION_RESPONSE_TYPES)[number];

export const CONVERSATION_ENERGY_LEVELS = [
  "lightning",
  "coffee",
  "big_conversation",
  "planning",
] as const;

export type ConversationEnergyLevel =
  (typeof CONVERSATION_ENERGY_LEVELS)[number];

/** Maps UI energy labels to stored ConversationEnergy. */
export function energyLevelToStore(
  level: ConversationEnergyLevel,
): "light" | "medium" | "deep" | "planning" {
  switch (level) {
    case "lightning":
      return "light";
    case "coffee":
      return "medium";
    case "big_conversation":
      return "deep";
    case "planning":
      return "planning";
  }
}

export function storeEnergyToLevel(
  energy: "light" | "medium" | "deep" | "planning",
): ConversationEnergyLevel {
  switch (energy) {
    case "light":
      return "lightning";
    case "medium":
      return "coffee";
    case "deep":
      return "big_conversation";
    case "planning":
      return "planning";
  }
}

export const ENERGY_LABELS: Record<ConversationEnergyLevel, string> = {
  lightning: "Lightning",
  coffee: "Coffee Discussion",
  big_conversation: "Big Conversation",
  planning: "Planning",
};

export const ENERGY_SECONDS: Record<ConversationEnergyLevel, [number, number]> =
  {
    lightning: [10, 30],
    coffee: [120, 300],
    big_conversation: [600, 1800],
    planning: [60, 600],
  };

export const CONVERSATION_TAGS = [
  "warm_up",
  "identity",
  "birth",
  "visitors",
  "feeding",
  "sleep",
  "partnership",
  "family",
  "traditions",
  "money",
  "values",
  "lulu",
  "fun",
  "reflection",
  "wrap_up",
  "privacy",
  "advice",
  "holidays",
] as const;

export type ConversationTag = (typeof CONVERSATION_TAGS)[number];

export type QuickPromptOption = {
  value: string;
  label: string;
};

export type ConversationPromptDef = {
  id: string;
  /** Stable source version for curated content. */
  version: string;
  prompt: string;
  response_type: ConversationResponseType;
  answer_options: QuickPromptOption[];
  allow_multiple_selections: boolean;
  allow_custom_answer: boolean;
  estimated_time_seconds: number;
  suggested_discussion_minutes: number | null;
  short_text_max_length: number | null;
  follow_up_open_question_id: string | null;
  conversation_energy: ConversationEnergyLevel;
  conversation_tags: ConversationTag[];
  session_tags: string[];
  category: string;
  topic: string;
  life_stage: string;
  supports_separate_answers: boolean;
  supports_shared_answer: boolean;
  show_difference_prompt: boolean;
  is_conversation_companion: boolean;
  is_trip_memory?: boolean;
  active: boolean;
  scale_min?: number;
  scale_max?: number;
  scale_low_label?: string;
  scale_high_label?: string;
};

export function defaultEstimatedSeconds(
  type: ConversationResponseType,
  energy: ConversationEnergyLevel,
): number {
  if (type === "open_time_boxed") {
    return energy === "big_conversation" ? 600 : 240;
  }
  if (type === "short_text") return 30;
  if (type === "either_or") return 15;
  if (type === "reaction_scale") return 20;
  return 20;
}

export function validateEitherOrOptions(options: QuickPromptOption[]): boolean {
  // Exactly two primary choices, with an optional third soft choice.
  return options.length === 2 || options.length === 3;
}

export function validateQuickPickOptions(options: QuickPromptOption[]): boolean {
  return options.length >= 2 && options.length <= 6;
}
