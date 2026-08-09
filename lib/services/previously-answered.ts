/**
 * Library-answer awareness for conversation prompts / Essentials.
 */
import type { Answer, AppStore, Question } from "@/lib/types/models";
import {
  questionIdsRelated,
  resolveLibraryQuestionId,
} from "@/lib/conversations/deep-link";
import {
  buildQuestionStatusIndex,
  type QuestionAnswerStatus,
} from "@/lib/services/question-status";

export function resolveLinkedLibraryQuestion(
  store: AppStore,
  candidateId: string | null | undefined,
): Question | null {
  const id = resolveLibraryQuestionId(candidateId, store.questions);
  if (!id) return null;
  return store.questions.find((q) => q.id === id) ?? null;
}

export function libraryAnswersForQuestion(
  store: AppStore,
  questionId: string,
): Answer[] {
  return (store.answers ?? []).filter(
    (a) =>
      a.question_id === questionId ||
      questionIdsRelated(a.question_id, questionId),
  );
}

export function answeredLibraryDeepIds(store: AppStore): Set<string> {
  const index = buildQuestionStatusIndex(store);
  const ids = new Set<string>();
  for (const [qid, status] of index) {
    if (status.skipByDefault || status.fullyAnswered) {
      ids.add(qid);
    }
  }
  return ids;
}

export function promptLinksAnsweredLibrary(
  answeredDeepIds: Set<string>,
  followUpQuestionId: string | null | undefined,
): boolean {
  if (!followUpQuestionId) return false;
  for (const id of answeredDeepIds) {
    if (questionIdsRelated(id, followUpQuestionId)) return true;
  }
  return false;
}

export function previouslyAnsweredLabel(
  status: QuestionAnswerStatus | null | undefined,
): string | null {
  if (!status) return null;
  if (status.fullyAnswered || status.primary === "shared_answer_saved") {
    return "Previously answered";
  }
  if (status.partiallyAnswered) return "Partially answered before";
  return null;
}

/** Best-effort text to preview a prior shared/individual answer. */
export function previewLibraryAnswerText(answers: Answer[]): string | null {
  const shared = answers.find((a) => a.is_shared);
  const text =
    shared?.payload.text ||
    shared?.payload.quick ||
    (Array.isArray(shared?.payload.choice)
      ? shared?.payload.choice.join(", ")
      : typeof shared?.payload.choice === "string"
        ? shared.payload.choice
        : null) ||
    answers.find((a) => a.payload.text)?.payload.text ||
    null;
  if (!text?.trim()) return null;
  return text.trim().length > 280 ? `${text.trim().slice(0, 277)}…` : text.trim();
}
