import type { AppStore, Question } from "@/lib/types/models";
import {
  resolveDiscussionMode,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { isProgressEligibleQuestion } from "@/lib/services/question-status";

export type DiscussionModeHomeStats = {
  sharedFirstCompleted: number;
  separateReflectionRemaining: number;
  sharedDecisionsCompleted: number;
  completedTogetherPct: number;
};

function modeFor(q: Question): DiscussionMode {
  return resolveDiscussionMode({
    question: q,
    preferExistingSeparate: false,
  }).mode;
}

function questionHasAnswer(store: AppStore, questionId: string): boolean {
  return (store.answers ?? []).some((a) => a.question_id === questionId);
}

/**
 * Home-facing discussion-mode metrics. Metadata-only classification —
 * does not migrate answers.
 */
export function buildDiscussionModeHomeStats(
  store: AppStore,
): DiscussionModeHomeStats {
  const eligible = store.questions.filter(isProgressEligibleQuestion);
  let sharedFirstCompleted = 0;
  let separateReflectionRemaining = 0;
  let sharedDecisionsCompleted = 0;
  let completedTogether = 0;
  let completedTotal = 0;

  for (const q of eligible) {
    const mode = modeFor(q);
    const answered = questionHasAnswer(store, q.id);
    const hasShared = (store.answers ?? []).some(
      (a) =>
        a.question_id === q.id &&
        a.is_shared &&
        Boolean(a.payload.text?.trim() || a.payload.quick?.trim()),
    );

    if (answered && hasShared) sharedDecisionsCompleted += 1;

    if (mode === "shared_first" || mode === "either") {
      if (answered && hasShared) {
        sharedFirstCompleted += 1;
        completedTogether += 1;
        completedTotal += 1;
      } else if (answered) {
        completedTotal += 1;
      }
    } else if (mode === "separate_first") {
      if (!answered) separateReflectionRemaining += 1;
      else completedTotal += 1;
    }
  }

  return {
    sharedFirstCompleted,
    separateReflectionRemaining,
    sharedDecisionsCompleted,
    completedTogetherPct: completedTotal
      ? Math.round((completedTogether / completedTotal) * 100)
      : 0,
  };
}
