import { z } from "zod";
import { CONTENT_REVIEW_SCHEMA_VERSION } from "@/lib/content-review/options";

export const contentReviewPackageSchema = z.object({
  schema_version: z.literal(CONTENT_REVIEW_SCHEMA_VERSION),
  generated_at: z.string(),
  family_name: z.string(),
  purpose: z.literal("ai_content_review"),
  focus: z.literal("content_design_not_answer_scoring"),
  options: z.object({
    scope: z.enum(["questions_only", "before_baby_only", "full"]),
    includeAnswers: z.boolean(),
    answerDetail: z.enum(["excluded", "statuses_only", "full"]),
    includeFreeTextAnswers: z.boolean(),
    includeArchivedQuestions: z.boolean(),
    includeTestData: z.boolean(),
    includeCustomTasks: z.boolean(),
    includeResearchMetadata: z.boolean(),
    includeResearchSummaries: z.boolean(),
    includeTechnicalHealthData: z.boolean(),
  }),
  question_bank: z
    .object({
      questions: z.array(z.record(z.string(), z.unknown())),
      metrics: z.record(z.string(), z.unknown()),
      topic_map: z.array(z.record(z.string(), z.unknown())),
    })
    .nullable(),
  before_baby: z
    .object({
      tasks: z.array(z.record(z.string(), z.unknown())),
      timeline_review: z.record(z.string(), z.unknown()),
      pre_birth_coverage: z.array(z.record(z.string(), z.unknown())),
    })
    .nullable(),
  conversation_metrics: z.record(z.string(), z.unknown()).optional(),
  family_answers: z
    .object({
      mode: z.enum(["excluded", "statuses_only", "full"]),
      items: z.array(z.record(z.string(), z.unknown())),
      signals: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  recommendations_seed: z.object({
    top_content_improvements: z.array(z.string()),
    top_additions_before_birth: z.array(z.string()),
    suggested_question_categories: z.array(z.string()),
    suggested_new_questions: z.array(z.string()),
    suggested_new_checklist_items: z.array(z.string()),
    suggested_timeline_changes: z.array(z.string()),
  }),
  privacy: z.object({
    secrets_excluded: z.literal(true),
    book_text_excluded: z.literal(true),
    answers_included: z.boolean(),
    free_text_answers_included: z.boolean(),
  }),
});

export type ContentReviewPackage = z.infer<typeof contentReviewPackageSchema>;

export function validateContentReviewPackage(value: unknown): ContentReviewPackage {
  return contentReviewPackageSchema.parse(value);
}
