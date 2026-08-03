/**
 * Canonical answered / completion status for conversations + library progress.
 * Pages must use these helpers — do not duplicate status logic in UI.
 */

import type {
  AppStore,
  ConversationItemStatus,
  ConversationSession,
} from "@/lib/types/models";
import {
  buildQuestionStatusIndex,
  type QuestionAnswerStatus,
} from "@/lib/services/question-status";
import { getConversationSessionProgress } from "@/lib/services/conversations";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";

export const CONVERSATION_ITEM_STATUS_LABELS = {
  unanswered: "Unanswered",
  sam_answered: "Sam answered",
  michelle_answered: "Michelle answered",
  both_answered: "Both answered",
  shared_answer_saved: "Shared answer saved",
  undecided: "Undecided",
  discuss_later: "Discuss later",
  waiting_for_provider: "Waiting for provider",
  skipped: "Skipped",
  opened: "In progress",
} as const;

export type ConversationItemStatusKey =
  keyof typeof CONVERSATION_ITEM_STATUS_LABELS;

const ANSWERED_ITEM_STATUSES = new Set<ConversationItemStatus>([
  "answered_same",
  "answered_different",
  "shared_answer_saved",
  "skipped",
  "discuss_later",
  "undecided",
]);

export function mapConversationItemStatus(
  status: ConversationItemStatus,
  opts?: { hasSam?: boolean; hasMichelle?: boolean; hasShared?: boolean },
): ConversationItemStatusKey {
  if (status === "shared_answer_saved") return "shared_answer_saved";
  if (status === "undecided") return "undecided";
  if (status === "discuss_later") return "discuss_later";
  if (status === "skipped") return "skipped";
  if (status === "needs_follow_up") return "waiting_for_provider";
  if (status === "answered_same" || status === "answered_different") {
    return "both_answered";
  }
  if (opts?.hasShared) return "shared_answer_saved";
  if (opts?.hasSam && opts?.hasMichelle) return "both_answered";
  if (opts?.hasSam) return "sam_answered";
  if (opts?.hasMichelle) return "michelle_answered";
  if (status === "opened") return "opened";
  return "unanswered";
}

export function conversationItemIsComplete(
  status: ConversationItemStatus,
): boolean {
  return ANSWERED_ITEM_STATUSES.has(status);
}

export type ProgressSnapshot = {
  libraryAnsweredCount: number;
  libraryQuestionCount: number;
  essentialsCompletedScreens: number;
  essentialsVisibleScreens: number;
  conversationAnsweredCount: number;
  conversationItemCount: number;
  activeSessionId: string | null;
  statusIndexSize: number;
};

/**
 * One-shot progress snapshot for homepage / debug compare.
 * Library counts use canonical question-status (not quick companions).
 */
export function buildProgressSnapshot(
  store: AppStore,
  session?: ConversationSession | null,
): ProgressSnapshot {
  const index = buildQuestionStatusIndex(store);
  let libraryAnsweredCount = 0;
  for (const q of store.questions) {
    if (q.id.startsWith("qa_")) continue;
    const st = index.get(q.id);
    if (st?.fullyAnswered || st?.primary === "shared_answer_saved") {
      libraryAnsweredCount += 1;
    }
  }

  const essentials = buildEssentialsDashboard(store);
  const progress = session
    ? getConversationSessionProgress(store, session.id)
    : {
        answeredCount: 0,
        itemCount: 0,
        quickAnswerCount: 0,
        hasProgress: false,
      };

  return {
    libraryAnsweredCount,
    libraryQuestionCount: store.questions.filter((q) => !q.id.startsWith("qa_"))
      .length,
    essentialsCompletedScreens: essentials.completed,
    essentialsVisibleScreens: essentials.visible_primary,
    conversationAnsweredCount: progress.answeredCount,
    conversationItemCount: progress.itemCount,
    activeSessionId: session?.id ?? null,
    statusIndexSize: index.size,
  };
}

export function getLibraryStatus(
  questionId: string,
  store: AppStore,
  index?: Map<string, QuestionAnswerStatus>,
): QuestionAnswerStatus | undefined {
  const map = index ?? buildQuestionStatusIndex(store);
  return map.get(questionId);
}

/** Deep library question requires a real answer record — not a quick companion alone. */
export function isDeepQuestionAnswered(
  store: AppStore,
  deepQuestionId: string,
): boolean {
  return store.answers.some((a) => a.question_id === deepQuestionId);
}
