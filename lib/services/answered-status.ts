/**
 * Canonical answered / completion status for conversations + library progress.
 * Pages must use these helpers — do not duplicate status logic in UI.
 *
 * METRIC CONTRACT
 * ---------------
 * canonicalQuestionsAnswered:
 *   Progress-eligible library questions where fullyAnswered is true
 *   (shared answer with content OR both Sam + Michelle individual answers).
 *   Does NOT include quick conversation companions alone.
 *   Does NOT include QA / test questions.
 *   Sam-only or Michelle-only → not fully answered (partial).
 *
 * conversationPromptsCompleted:
 *   Non-test conversation session items in answered statuses
 *   (answered_same/different, shared_answer_saved, undecided, discuss_later, skipped).
 *
 * essentialsScreensCompleted:
 *   Visible primary Essentials screens meeting buildEssentialsDashboard rules.
 *
 * sharedDecisions:
 *   Progress-eligible questions with a saved shared answer (content),
 *   plus decisions with status decided or tentatively_decided.
 *
 * openFollowUps:
 *   Undecided library items + Discuss Later conversation items +
 *   Waiting for provider / needs_research answers + active cooling-off +
 *   partially answered library questions (Sam-only or Michelle-only).
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
import {
  listConversationPromptRecords,
  listDeepDiscussionRecords,
  listEssentialsCompletedRecords,
  listOpenFollowUpRecords,
  listSharedDecisionRecords,
} from "@/lib/services/progress-records";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { isProgressEligibleQuestion } from "@/lib/services/question-status";

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

export type FamilyProgressMetrics = {
  /** Deep library discussions fully answered (shared or both parents). */
  canonicalQuestionsAnswered: number;
  canonicalQuestionsTotal: number;
  /** Partial: Sam-only or Michelle-only with content. */
  canonicalQuestionsPartial: number;
  /** Unique question_ids present in store.answers (legacy home metric). */
  legacyUniqueAnsweredQuestionIds: number;
  /** Non-test conversation cards in an answered status. */
  conversationPromptsCompleted: number;
  conversationPromptsTotal: number;
  /** Real (non-QA) quick answer rows. */
  conversationQuickAnswers: number;
  essentialsScreensCompleted: number;
  essentialsScreensVisible: number;
  sharedDecisions: number;
  openFollowUps: number;
  undecidedLibrary: number;
  discussLaterItems: number;
  activeSessionId: string | null;
  activeSessionAnswered: number;
  activeSessionItemCount: number;
};

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

function isQaRecord(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

/**
 * Authoritative family progress metrics for Home / Storage Debug / exports.
 */
export function buildFamilyProgressMetrics(
  store: AppStore,
  session?: ConversationSession | null,
): FamilyProgressMetrics {
  const index = buildQuestionStatusIndex(store);
  const eligible = store.questions.filter(isProgressEligibleQuestion);

  let canonicalQuestionsPartial = 0;
  let undecidedLibrary = 0;
  for (const q of eligible) {
    const st = index.get(q.id);
    if (!st) continue;
    if (!(st.fullyAnswered || st.primary === "shared_answer_saved")) {
      if (st.partiallyAnswered) canonicalQuestionsPartial += 1;
    }
    if (st.undecided || st.primary === "undecided") undecidedLibrary += 1;
  }

  const legacyUniqueAnsweredQuestionIds = new Set(
    (store.answers ?? [])
      .filter((a) => !isQaRecord(a))
      .map((a) => a.question_id),
  ).size;

  const deepRecords = listDeepDiscussionRecords(store);
  const promptRecords = listConversationPromptRecords(store);
  const essentialsRecords = listEssentialsCompletedRecords(store);
  const sharedRecords = listSharedDecisionRecords(store);
  const followUpRecords = listOpenFollowUpRecords(store);
  const essentials = buildEssentialsDashboard(store);

  const realSessions = new Set(
    (store.conversation_sessions ?? [])
      .filter((s) => !isQaRecord(s))
      .map((s) => s.id),
  );
  const conversationQuickAnswers = (store.conversation_quick_answers ?? [])
    .filter((a) => !isQaRecord(a) && realSessions.has(a.session_id)).length;
  const discussLaterItems = followUpRecords.filter(
    (r) => r.group === "discuss_later",
  ).length;

  const progress = session
    ? getConversationSessionProgress(store, session.id)
    : {
        answeredCount: 0,
        itemCount: 0,
        quickAnswerCount: 0,
        hasProgress: false,
      };

  return {
    canonicalQuestionsAnswered: deepRecords.length,
    canonicalQuestionsTotal: eligible.length,
    canonicalQuestionsPartial,
    legacyUniqueAnsweredQuestionIds,
    conversationPromptsCompleted: promptRecords.length,
    conversationPromptsTotal: (store.conversation_session_items ?? []).filter(
      (i) => realSessions.has(i.session_id),
    ).length,
    conversationQuickAnswers,
    essentialsScreensCompleted: essentialsRecords.length,
    essentialsScreensVisible: essentials.visible_primary,
    sharedDecisions: sharedRecords.length,
    openFollowUps: followUpRecords.length,
    undecidedLibrary,
    discussLaterItems,
    activeSessionId: session?.id ?? null,
    activeSessionAnswered: progress.answeredCount,
    activeSessionItemCount: progress.itemCount,
  };
}

/**
 * One-shot progress snapshot for homepage / debug compare.
 * Library counts use canonical question-status (not quick companions).
 */
export function buildProgressSnapshot(
  store: AppStore,
  session?: ConversationSession | null,
): ProgressSnapshot {
  const m = buildFamilyProgressMetrics(store, session);
  const index = buildQuestionStatusIndex(store);
  return {
    libraryAnsweredCount: m.canonicalQuestionsAnswered,
    libraryQuestionCount: m.canonicalQuestionsTotal,
    essentialsCompletedScreens: m.essentialsScreensCompleted,
    essentialsVisibleScreens: m.essentialsScreensVisible,
    conversationAnsweredCount: m.activeSessionAnswered,
    conversationItemCount: m.activeSessionItemCount,
    activeSessionId: m.activeSessionId,
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

/**
 * Quick companions never complete a deep question by themselves.
 */
export function quickCompanionCompletesDeepQuestion(): boolean {
  return false;
}
