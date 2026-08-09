import type { ConversationPromptDef } from "./response-types";
import { getQuickPrompt } from "./quick-prompts";
import { getQaQuestion } from "@/lib/qa/question-pack";

export const BABYMOON_SET_TAG = "babymoon_set_v1";
export const BABYMOON_SET_VERSION = "babymoon_set_v1";

export type BabymoonRoundDef = {
  id: string;
  round: 1 | 2 | 3;
  title: string;
  estimated_minutes: number;
  /** Prompt ids in stable order. */
  prompt_ids: string[];
};

/** Inline open_time_boxed / round-specific items not in the general bank. */
export const BABYMOON_INLINE_PROMPTS: ConversationPromptDef[] = [
  {
    id: "qp_bm_success_deep",
    version: BABYMOON_SET_VERSION,
    prompt: "What does success as parents mean to us?",
    response_type: "open_time_boxed",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 240,
    suggested_discussion_minutes: 4,
    short_text_max_length: null,
    follow_up_open_question_id: "q_what_does_success_as_parents_mean_to_us",
    conversation_energy: "coffee",
    conversation_tags: ["identity", "values"],
    session_tags: [BABYMOON_SET_TAG],
    category: "foundation",
    topic: "identity",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: true,
    is_conversation_companion: true,
    active: true,
  },
  {
    id: "qp_bm_rose_thorn",
    version: BABYMOON_SET_VERSION,
    prompt: "Rose or thorn from today?",
    response_type: "either_or",
    answer_options: [
      { value: "rose", label: "Rose" },
      { value: "thorn", label: "Thorn" },
    ],
    allow_multiple_selections: false,
    allow_custom_answer: false,
    estimated_time_seconds: 30,
    suggested_discussion_minutes: null,
    short_text_max_length: 120,
    follow_up_open_question_id: null,
    conversation_energy: "lightning",
    conversation_tags: ["warm_up", "reflection"],
    session_tags: [BABYMOON_SET_TAG],
    category: "foundation",
    topic: "reflection",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: false,
    show_difference_prompt: false,
    is_conversation_companion: false,
    active: true,
  },
  {
    id: "qp_bm_birth_prefs",
    version: BABYMOON_SET_VERSION,
    prompt: "Which birth preferences matter most to us? Pick up to three.",
    response_type: "quick_pick",
    answer_options: [
      { value: "pain", label: "Pain management approach" },
      { value: "who_in_room", label: "Who is in the room" },
      { value: "skin_to_skin", label: "Immediate skin-to-skin" },
      { value: "cord", label: "Delayed cord clamping" },
      { value: "feeding_hour", label: "Feeding plan in first hour" },
      { value: "partner_role", label: "Partner's role during labor" },
    ],
    allow_multiple_selections: true,
    allow_custom_answer: true,
    estimated_time_seconds: 180,
    suggested_discussion_minutes: 3,
    short_text_max_length: null,
    follow_up_open_question_id: "q_which_birth_preferences_matter_most_to_us",
    conversation_energy: "coffee",
    conversation_tags: ["birth"],
    session_tags: [BABYMOON_SET_TAG],
    category: "birth",
    topic: "birth",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: true,
    is_conversation_companion: true,
    active: true,
  },
  {
    id: "qp_bm_overnight_plan",
    version: BABYMOON_SET_VERSION,
    prompt: "How should we divide overnight care during the first weeks?",
    response_type: "either_or",
    answer_options: [
      { value: "blocks", label: "Split the night into blocks" },
      { value: "by_task", label: "Split by task (feed vs soothe)" },
      { value: "primary_support", label: "One primary + one support" },
      { value: "alternate_nights", label: "Alternate nights" },
      { value: "flexible", label: "Stay flexible night-to-night" },
    ],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 240,
    suggested_discussion_minutes: 4,
    short_text_max_length: null,
    follow_up_open_question_id:
      "q_how_should_we_divide_overnight_care_in_the_first_weeks",
    conversation_energy: "coffee",
    conversation_tags: ["sleep", "partnership"],
    session_tags: [BABYMOON_SET_TAG],
    category: "birth",
    topic: "sleep",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: true,
    is_conversation_companion: true,
    active: true,
  },
  {
    id: "qp_bm_faith",
    version: BABYMOON_SET_VERSION,
    prompt: "What role should faith or spirituality play in our home, if any?",
    response_type: "open_time_boxed",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 240,
    suggested_discussion_minutes: 4,
    short_text_max_length: null,
    follow_up_open_question_id: null,
    conversation_energy: "coffee",
    conversation_tags: ["values"],
    session_tags: [BABYMOON_SET_TAG],
    category: "values",
    topic: "values",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: true,
    is_conversation_companion: false,
    active: true,
  },
  {
    id: "qp_bm_cause",
    version: BABYMOON_SET_VERSION,
    prompt:
      "One cause or organization we would want to introduce our child to someday.",
    response_type: "short_text",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 30,
    suggested_discussion_minutes: null,
    short_text_max_length: 100,
    follow_up_open_question_id: null,
    conversation_energy: "lightning",
    conversation_tags: ["values"],
    session_tags: [BABYMOON_SET_TAG],
    category: "values",
    topic: "values",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: false,
    show_difference_prompt: false,
    is_conversation_companion: false,
    active: true,
  },
  {
    id: "qp_bm_fair_labor",
    version: BABYMOON_SET_VERSION,
    prompt: "What does a fair division of labor mean when work schedules differ?",
    response_type: "open_time_boxed",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 300,
    suggested_discussion_minutes: 5,
    short_text_max_length: null,
    follow_up_open_question_id:
      "q_what_does_a_good_day_look_like_when_both_parents_are_exhausted",
    conversation_energy: "coffee",
    conversation_tags: ["partnership"],
    session_tags: [BABYMOON_SET_TAG],
    category: "partnership",
    topic: "partnership",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: true,
    is_conversation_companion: true,
    active: true,
  },
  {
    id: "qp_bm_kindness",
    version: BABYMOON_SET_VERSION,
    prompt: "Best example of kindness you noticed this week.",
    response_type: "short_text",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 30,
    suggested_discussion_minutes: null,
    short_text_max_length: 160,
    follow_up_open_question_id: null,
    conversation_energy: "lightning",
    conversation_tags: ["reflection", "fun"],
    session_tags: [BABYMOON_SET_TAG],
    category: "values",
    topic: "reflection",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: false,
    show_difference_prompt: false,
    is_conversation_companion: false,
    active: true,
  },
  {
    id: "qp_bm_trip_memory",
    version: BABYMOON_SET_VERSION,
    prompt: "One thing from this trip we want to remember we said.",
    response_type: "short_text",
    answer_options: [],
    allow_multiple_selections: false,
    allow_custom_answer: true,
    estimated_time_seconds: 45,
    suggested_discussion_minutes: null,
    short_text_max_length: 300,
    follow_up_open_question_id: null,
    conversation_energy: "lightning",
    conversation_tags: ["wrap_up", "reflection"],
    session_tags: [BABYMOON_SET_TAG],
    category: "wrap_up",
    topic: "wrap_up",
    life_stage: "before_birth",
    supports_separate_answers: true,
    supports_shared_answer: true,
    show_difference_prompt: false,
    is_conversation_companion: false,
    is_trip_memory: true,
    active: true,
  },
];

export const BABYMOON_ROUNDS: BabymoonRoundDef[] = [
  {
    id: "babymoon_round_1",
    round: 1,
    title: "Warm-up and Family Identity",
    estimated_minutes: 15,
    prompt_ids: [
      "qp_parent_word",
      "qp_holiday_size",
      "qp_family_food",
      "qp_bm_success_deep",
      "qp_bm_rose_thorn",
      "qp_baby_face_online",
    ],
  },
  {
    id: "babymoon_round_2",
    round: 2,
    title: "Birth and First Weeks",
    estimated_minutes: 15,
    prompt_ids: [
      "qp_birth_room_word",
      "qp_bm_birth_prefs",
      "qp_first_week_home",
      "qp_advice_default",
      "qp_bm_overnight_plan",
      "qp_night_person",
      "qp_morning_person",
    ],
  },
  {
    id: "babymoon_round_3",
    round: 3,
    title: "Values and Wrap-Up",
    estimated_minutes: 15,
    prompt_ids: [
      "qp_family_motto",
      "qp_bm_faith",
      "qp_bm_cause",
      "qp_bm_fair_labor",
      "qp_bm_kindness",
      "qp_bm_trip_memory",
    ],
  },
];

const ALL_PROMPTS_BY_ID = new Map<string, ConversationPromptDef>();

function rebuildIndex() {
  ALL_PROMPTS_BY_ID.clear();
  for (const p of BABYMOON_INLINE_PROMPTS) ALL_PROMPTS_BY_ID.set(p.id, p);
}

rebuildIndex();

export function resolveConversationPrompt(
  id: string,
): ConversationPromptDef | undefined {
  return getQaQuestion(id) ?? getQuickPrompt(id) ?? ALL_PROMPTS_BY_ID.get(id);
}

export function getBabymoonRound(round: 1 | 2 | 3): BabymoonRoundDef {
  const def = BABYMOON_ROUNDS.find((r) => r.round === round);
  if (!def) throw new Error(`Missing babymoon round ${round}`);
  return def;
}

export function getBabymoonRoundPrompts(
  round: 1 | 2 | 3,
): ConversationPromptDef[] {
  const def = getBabymoonRound(round);
  return def.prompt_ids.map((id) => {
    const p = resolveConversationPrompt(id);
    if (!p) throw new Error(`Missing babymoon prompt ${id}`);
    return p;
  });
}

export function estimateRoundSeconds(round: 1 | 2 | 3): number {
  return getBabymoonRoundPrompts(round).reduce(
    (sum, p) => sum + p.estimated_time_seconds,
    0,
  );
}
