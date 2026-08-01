export const CONTENT_REVIEW_SCHEMA_VERSION = "content-review-v1" as const;

export type ContentReviewScope =
  | "questions_only"
  | "before_baby_only"
  | "full";

export type AnswerExportMode =
  | "excluded"
  | "statuses_only"
  | "full";

export type ContentReviewOptions = {
  scope: ContentReviewScope;
  /** When false, answers are omitted entirely (default). */
  includeAnswers: boolean;
  /** Only used when includeAnswers is true. Default statuses_only. */
  answerDetail: AnswerExportMode;
  includeFreeTextAnswers: boolean;
  includeArchivedQuestions: boolean;
  includeTestData: boolean;
  includeCustomTasks: boolean;
  includeResearchMetadata: boolean;
  includeResearchSummaries: boolean;
  includeTechnicalHealthData: boolean;
};

export const DEFAULT_CONTENT_REVIEW_OPTIONS: ContentReviewOptions = {
  scope: "full",
  includeAnswers: false,
  answerDetail: "statuses_only",
  includeFreeTextAnswers: false,
  includeArchivedQuestions: false,
  includeTestData: false,
  includeCustomTasks: true,
  includeResearchMetadata: false,
  includeResearchSummaries: false,
  includeTechnicalHealthData: false,
};

export function normalizeContentReviewOptions(
  partial?: Partial<ContentReviewOptions>,
): ContentReviewOptions {
  return {
    ...DEFAULT_CONTENT_REVIEW_OPTIONS,
    ...partial,
    answerDetail: partial?.includeAnswers
      ? (partial.answerDetail ?? "statuses_only")
      : "excluded",
  };
}
