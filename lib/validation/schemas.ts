import { z } from "zod";
import {
  CONFIDENCE_LEVELS,
  DECISION_STATUSES,
  DECISION_TYPES,
  EVIDENCE_QUALITY,
  LIFE_STAGES,
  QUESTION_PRIORITIES,
  QUESTION_TYPES,
  QUICK_DECISION_OPTIONS,
  RESEARCH_MODES,
  SESSION_LENGTHS,
} from "@/lib/constants/enums";

export const confidenceSchema = z
  .union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.null(),
  ])
  .or(z.number().min(1).max(5).transform((n) => Math.round(n) as 1 | 2 | 3 | 4 | 5));

export const answerPayloadSchema = z.object({
  text: z.string().optional(),
  choice: z.union([z.string(), z.array(z.string())]).optional(),
  ranking: z.array(z.string()).optional(),
  scale: z.number().min(1).max(10).optional(),
  quick: z.enum(QUICK_DECISION_OPTIONS).optional(),
  notes: z.string().optional(),
  agreement_notes: z.string().optional(),
  disagreement_notes: z.string().optional(),
  matrix: z.record(z.string(), z.string()).optional(),
  named_people: z.array(z.string()).optional(),
});

export const saveAnswerSchema = z.object({
  question_id: z.string().min(1),
  member_id: z.string().nullable().optional(),
  is_shared: z.boolean(),
  payload: answerPayloadSchema,
  status: z.enum(DECISION_STATUSES),
  confidence: confidenceSchema,
  change_reason: z.string().optional(),
  needs_research: z.boolean().optional(),
  review_date: z.string().nullable().optional(),
  bookmarked: z.boolean().optional(),
  mutation_id: z.string().min(8).max(128).optional(),
});

export const createSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  length: z.enum(["quick", "standard", "deep"] as const),
  filters: z
    .object({
      life_stage: z.enum(LIFE_STAGES).optional(),
      category: z.string().optional(),
      outcome: z.string().optional(),
      only_unanswered: z.boolean().optional(),
      include_answered: z.boolean().optional(),
      review_changed: z.boolean().optional(),
      review_undecided: z.boolean().optional(),
      review_due: z.boolean().optional(),
      include_unresolved: z.boolean().optional(),
      include_research: z.boolean().optional(),
      include_separate: z.boolean().optional(),
      include_high_priority: z.boolean().optional(),
      include_practical: z.boolean().optional(),
      include_philosophical: z.boolean().optional(),
      include_evidence: z.boolean().optional(),
      preset: z.string().optional(),
    })
    .default({}),
  babymoon_mode: z.boolean().optional(),
  question_ids: z.array(z.string()).optional(),
});

export const saveDecisionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  statement: z.string().min(1),
  problem: z.string().nullable().optional(),
  reasoning: z.string().nullable().optional(),
  sam_perspective: z.string().nullable().optional(),
  michelle_perspective: z.string().nullable().optional(),
  shared_conclusion: z.string().nullable().optional(),
  agreement_notes: z.string().nullable().optional(),
  disagreement_notes: z.string().nullable().optional(),
  status: z.enum(DECISION_STATUSES),
  confidence: confidenceSchema,
  decision_type: z.enum(DECISION_TYPES),
  evidence_strength: z.enum(EVIDENCE_QUALITY).optional(),
  emotional_weight: z.number().min(1).max(5).optional(),
  reversibility: z
    .enum(["easy", "moderate", "hard", "permanent"])
    .nullable()
    .optional(),
  child_dependent: z.boolean().optional(),
  life_stages: z.array(z.enum(LIFE_STAGES)).optional(),
  categories: z.array(z.string()).optional(),
  research_notes: z.string().nullable().optional(),
  implementation_notes: z.string().nullable().optional(),
  exceptions: z.string().nullable().optional(),
  risks: z.string().nullable().optional(),
  warning_signs: z.string().nullable().optional(),
  reconsideration_conditions: z.string().nullable().optional(),
  review_date: z.string().nullable().optional(),
  has_disagreement: z.boolean().optional(),
  source_question_ids: z.array(z.string()).optional(),
  outcome_ids: z.array(z.string()).optional(),
  principle_ids: z.array(z.string()).optional(),
  change_reason: z.string().optional(),
  started_mode: z
    .enum(["shared_first", "separate_first", "either"])
    .nullable()
    .optional(),
  merged_at: z.string().nullable().optional(),
  merge_initiated_by: z.string().nullable().optional(),
});

export const coolingOffSchema = z.object({
  question_id: z.string().nullable().optional(),
  decision_id: z.string().nullable().optional(),
  wait_days: z.number().min(1).max(90),
  reason: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export const settingsSchema = z.object({
  hide_partner_answers_until_both_saved: z.boolean().optional(),
  dark_mode: z.enum(["system", "light", "dark"]).optional(),
  babymoon_target_date: z.string().nullable().optional(),
  babymoon_daily_questions: z.number().min(1).max(50).optional(),
  include_perspective_history_in_playbook: z.boolean().optional(),
  expected_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  before_baby_scheduling_mode: z
    .enum(["recommended", "earlier", "compact", "manual_only"])
    .optional(),
  before_baby_preferred_task_days: z.array(z.number().int().min(0).max(6)).optional(),
  before_baby_max_tasks_per_week: z.number().int().min(1).max(40).nullable().optional(),
  before_baby_weekend_heavy: z.boolean().optional(),
  before_baby_include_post_birth: z.boolean().optional(),
  before_baby_hide_completed: z.boolean().optional(),
  before_baby_avoid_travel_dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
});

export const questionSeedSchema = z.object({
  id: z.string(),
  slug: z.string(),
  text: z.string().min(10),
  short_title: z.string(),
  why_it_matters: z.string(),
  discussion_guidance: z.string(),
  question_type: z.enum(QUESTION_TYPES),
  response_schema: z.record(z.string(), z.unknown()).default({}),
  life_stages: z.array(z.enum(LIFE_STAGES)).min(1),
  categories: z.array(z.string()).min(1),
  subcategories: z.array(z.string()).default([]),
  outcomes: z.array(z.string()).default([]),
  related_principles: z.array(z.string()).default([]),
  related_questions: z.array(z.string()).default([]),
  parent_decision_dependency: z.string().nullable().default(null),
  logical_order: z.number(),
  priority: z.enum(QUESTION_PRIORITIES),
  estimated_minutes: z.number().min(1).max(60),
  emotional_weight: z.number().min(1).max(5).default(3),
  evidence_needed: z.boolean().default(false),
  evidence_available: z.boolean().default(false),
  evidence_summary: z.string().nullable().default(null),
  practical_tip: z.string().nullable().default(null),
  separate_answers_recommended: z.boolean().default(false),
  discussion_mode: z
    .enum(["shared_first", "separate_first", "either"])
    .optional()
    .nullable(),
  discussion_reason: z.string().optional().nullable(),
  cooling_off_recommended: z.boolean().default(false),
  follow_up_prompts: z.array(z.string()).default([]),
  review_recommendation: z.string().nullable().default(null),
  child_dependent: z.boolean().default(false),
  required_before_birth: z.boolean().default(false),
  babymoon_priority: z.boolean().default(false),
  research_mode: z.enum(RESEARCH_MODES).default("optional_background"),
  active: z.boolean().default(true),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SaveDecisionInput = z.infer<typeof saveDecisionSchema>;
export type QuestionSeed = z.infer<typeof questionSeedSchema>;

export function sessionQuestionCount(length: keyof typeof SESSION_LENGTHS): number {
  const range = SESSION_LENGTHS[length];
  return Math.round((range.min + range.max) / 2);
}
