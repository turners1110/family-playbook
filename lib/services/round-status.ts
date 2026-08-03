/**
 * Babymoon (and tagged) round completion status.
 * Pages must use these helpers — do not duplicate status rules in UI.
 */

import type {
  AppStore,
  ConversationRoundStatus,
  ConversationSession,
  ConversationSessionItem,
  ConversationSessionStatus,
} from "@/lib/types/models";
import { conversationItemIsComplete } from "@/lib/services/answered-status";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { isDeepQuestionAnswered } from "@/lib/services/answered-status";

function isQaRecord(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

export function babymoonRoundTag(round: 1 | 2 | 3): string {
  return `babymoon_set_v1_round_${round}`;
}

export function parseBabymoonRound(
  tag: string | null | undefined,
): 1 | 2 | 3 | null {
  if (!tag) return null;
  const m = tag.match(/^babymoon_set_v1_round_([123])$/);
  if (!m) return null;
  return Number(m[1]) as 1 | 2 | 3;
}

function isHiddenItem(item: ConversationSessionItem): boolean {
  return Boolean(item.branch_context?.hidden);
}

function isOptionalItem(item: ConversationSessionItem): boolean {
  if (item.branch_context?.optional || item.branch_context?.momentum) {
    return true;
  }
  const prompt = resolveConversationPrompt(item.prompt_id);
  return Boolean(prompt?.optional);
}

function itemRequiresDeepAnswer(item: ConversationSessionItem): boolean {
  const prompt = resolveConversationPrompt(item.prompt_id);
  return Boolean(prompt?.requires_deep_answer && prompt.follow_up_open_question_id);
}

/** Visible items that must be finished for round completion. */
export function listEligibleSessionItems(
  store: AppStore,
  sessionId: string,
): ConversationSessionItem[] {
  return (store.conversation_session_items ?? [])
    .filter((i) => i.session_id === sessionId && !isHiddenItem(i))
    .sort((a, b) => a.display_order - b.display_order);
}

export function itemMeetsCompletionRule(
  store: AppStore,
  item: ConversationSessionItem,
): boolean {
  if (isOptionalItem(item) && item.status === "skipped") return true;
  if (isOptionalItem(item) && item.status === "pending") return true;
  if (!conversationItemIsComplete(item.status) && item.status !== "needs_follow_up") {
    return false;
  }
  if (itemRequiresDeepAnswer(item)) {
    const prompt = resolveConversationPrompt(item.prompt_id);
    const deepId = prompt?.follow_up_open_question_id;
    if (deepId && !isDeepQuestionAnswered(store, deepId)) return false;
  }
  return (
    conversationItemIsComplete(item.status) || item.status === "needs_follow_up"
  );
}

export type SessionFollowUpBreakdown = {
  discussLater: number;
  waitingProvider: number;
  needsResearch: number;
  followUpRequested: number;
  unresolvedDifferences: number;
  total: number;
};

export function countSessionOpenFollowUps(
  store: AppStore,
  sessionId: string,
): SessionFollowUpBreakdown {
  const items = listEligibleSessionItems(store, sessionId);
  const discussLater = items.filter((i) => i.status === "discuss_later").length;
  const waitingProvider = items.filter(
    (i) => i.status === "needs_follow_up",
  ).length;
  const followUpRequested = waitingProvider;
  const unresolvedDifferences = (store.conversation_differences ?? []).filter(
    (d) =>
      d.session_id === sessionId &&
      !isQaRecord(d) &&
      (d.resolution_status === "unreviewed" ||
        d.resolution_status === "kept_separate" ||
        d.resolution_status === "discuss_later"),
  ).length;

  // Linked deep answers needing research for required deep items in this session
  let needsResearch = 0;
  for (const item of items) {
    const prompt = resolveConversationPrompt(item.prompt_id);
    const deepId = prompt?.follow_up_open_question_id;
    if (!deepId) continue;
    const research = (store.answers ?? []).some(
      (a) =>
        !isQaRecord(a) &&
        a.question_id === deepId &&
        (a.needs_research || a.status === "needs_research"),
    );
    if (research) needsResearch += 1;
  }

  const total =
    discussLater +
    waitingProvider +
    needsResearch +
    unresolvedDifferences;

  return {
    discussLater,
    waitingProvider,
    needsResearch,
    followUpRequested,
    unresolvedDifferences,
    total,
  };
}

export type SessionCompletionEval = {
  status: ConversationRoundStatus;
  persistedStatus: ConversationSessionStatus | null;
  eligibleItemCount: number;
  completedItemCount: number;
  openFollowupCount: number;
  followUps: SessionFollowUpBreakdown;
  nextUnansweredTitle: string | null;
  allRequiredComplete: boolean;
};

export function evaluateSessionCompletion(
  store: AppStore,
  session: ConversationSession,
): SessionCompletionEval {
  const required = listEligibleSessionItems(store, session.id).filter(
    (i) => !isOptionalItem(i),
  );
  const completedItemCount = required.filter((i) =>
    itemMeetsCompletionRule(store, i),
  ).length;
  const followUps = countSessionOpenFollowUps(store, session.id);
  const allRequiredComplete =
    required.length > 0 && completedItemCount === required.length;

  const anyAnswered = required.some(
    (i) =>
      conversationItemIsComplete(i.status) ||
      i.status === "needs_follow_up" ||
      i.status === "opened",
  );

  let status: ConversationRoundStatus = "not_started";
  if (allRequiredComplete && followUps.total > 0) {
    status = "completed_with_followups";
  } else if (allRequiredComplete) {
    status = "completed";
  } else if (anyAnswered || session.status === "active" || session.status === "paused") {
    // Active empty session stays not_started until an eligible answer exists
    const answeredOrFollowUp = required.some(
      (i) =>
        conversationItemIsComplete(i.status) || i.status === "needs_follow_up",
    );
    status = answeredOrFollowUp ? "in_progress" : "not_started";
  }

  // Persist override: already completed sessions keep completed* even if
  // re-eval would differ slightly (e.g. later follow-up clears).
  if (
    session.status === "completed" ||
    session.status === "completed_with_followups"
  ) {
    status =
      followUps.total > 0 || session.status === "completed_with_followups"
        ? "completed_with_followups"
        : "completed";
    if (session.status === "completed" && followUps.total === 0) {
      status = "completed";
    }
  }

  const next = required.find((i) => !itemMeetsCompletionRule(store, i));
  const nextTitle = next
    ? resolveConversationPrompt(next.prompt_id)?.prompt?.slice(0, 80) ??
      next.prompt_id
    : null;

  return {
    status,
    persistedStatus: session.status,
    eligibleItemCount: required.length,
    completedItemCount,
    openFollowupCount: followUps.total,
    followUps,
    nextUnansweredTitle: nextTitle,
    allRequiredComplete,
  };
}

export type RoundStatusView = {
  round: 1 | 2 | 3;
  status: ConversationRoundStatus;
  session: ConversationSession | null;
  eligibleItemCount: number;
  completedItemCount: number;
  openFollowupCount: number;
  completedAt: string | null;
  nextUnansweredTitle: string | null;
  lastActivityAt: string | null;
};

/**
 * Prefer the best session for a Babymoon round tag:
 * completed* over in-progress over empty active.
 */
export function evaluateBabymoonRoundStatus(
  store: AppStore,
  round: 1 | 2 | 3,
): RoundStatusView {
  const tag = babymoonRoundTag(round);
  const sessions = (store.conversation_sessions ?? [])
    .filter((s) => !isQaRecord(s) && s.session_tag === tag)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (!sessions.length) {
    return {
      round,
      status: "not_started",
      session: null,
      eligibleItemCount: 0,
      completedItemCount: 0,
      openFollowupCount: 0,
      completedAt: null,
      nextUnansweredTitle: null,
      lastActivityAt: null,
    };
  }

  const completed = sessions.find(
    (s) =>
      s.status === "completed" || s.status === "completed_with_followups",
  );
  const inProgress = sessions.find((s) => {
    if (s.status !== "active" && s.status !== "paused") return false;
    const eval_ = evaluateSessionCompletion(store, s);
    return eval_.status === "in_progress";
  });

  const chosen = completed ?? inProgress ?? sessions[0]!;
  const eval_ = evaluateSessionCompletion(store, chosen);

  return {
    round,
    status: eval_.status,
    session: chosen,
    eligibleItemCount: eval_.eligibleItemCount,
    completedItemCount: eval_.completedItemCount,
    openFollowupCount: eval_.openFollowupCount,
    completedAt: chosen.completed_at,
    nextUnansweredTitle: eval_.nextUnansweredTitle,
    lastActivityAt: chosen.updated_at,
  };
}

export function roundStatusLabel(status: ConversationRoundStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "completed_with_followups":
      return "Completed";
  }
}

export function completionPersistedStatus(
  eval_: SessionCompletionEval,
): "completed" | "completed_with_followups" {
  return eval_.openFollowupCount > 0
    ? "completed_with_followups"
    : "completed";
}
