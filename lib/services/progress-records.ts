/**
 * Record selectors behind Home progress tiles.
 * Counts MUST match buildFamilyProgressMetrics — never recompute separately in pages.
 */

import type { AppStore, Question } from "@/lib/types/models";
import { conversationItemIsComplete } from "@/lib/services/answered-status";
import {
  buildQuestionStatusIndex,
  hasAnswerContent,
  isProgressEligibleQuestion,
} from "@/lib/services/question-status";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { ESSENTIALS_MODULES } from "@/lib/essentials/pathway";

function isQaRecord(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

export type ProgressRecordSort =
  | "newest"
  | "oldest"
  | "category"
  | "module"
  | "title";

export type DeepDiscussionRecord = {
  id: string;
  questionId: string;
  title: string;
  category: string;
  actorStatus: string;
  sharedAnswerStatus: string;
  lastUpdated: string;
  sessionId: string | null;
  href: string;
};

export type ConversationPromptRecord = {
  id: string;
  promptId: string;
  title: string;
  responseType: string;
  mode: string;
  round: number | null;
  actorsAnswered: string;
  lastUpdated: string;
  sessionId: string;
  deepQuestionId: string | null;
  href: string;
};

export type EssentialsCompletedRecord = {
  id: string;
  screenId: string;
  title: string;
  module: string;
  questionTitle: string;
  status: string;
  lastUpdated: string;
  href: string;
};

export type SharedDecisionRecord = {
  id: string;
  title: string;
  source: "shared_answer" | "decision";
  actors: string;
  createdAt: string;
  relatedTaskCount: number;
  href: string;
};

export type OpenFollowUpGroup =
  | "discuss_later"
  | "waiting_provider"
  | "needs_research"
  | "unresolved_differences"
  | "follow_up_requested"
  | "undecided"
  | "partial";

export type OpenFollowUpRecord = {
  id: string;
  group: OpenFollowUpGroup;
  title: string;
  detail: string;
  lastUpdated: string;
  href: string;
};

function realSessionIds(store: AppStore): Set<string> {
  return new Set(
    (store.conversation_sessions ?? [])
      .filter((s) => !isQaRecord(s))
      .map((s) => s.id),
  );
}

function questionById(store: AppStore): Map<string, Question> {
  return new Map(store.questions.map((q) => [q.id, q]));
}

function sessionRound(tag: string | null): number | null {
  if (!tag) return null;
  const m = tag.match(/babymoon_set_v1_round_(\d)/);
  return m ? Number(m[1]) : null;
}

export function listDeepDiscussionRecords(
  store: AppStore,
): DeepDiscussionRecord[] {
  const index = buildQuestionStatusIndex(store);
  const eligible = store.questions.filter(isProgressEligibleQuestion);
  const records: DeepDiscussionRecord[] = [];

  for (const q of eligible) {
    const st = index.get(q.id);
    if (!st) continue;
    if (!(st.fullyAnswered || st.primary === "shared_answer_saved")) continue;

    const answers = (store.answers ?? []).filter(
      (a) => !isQaRecord(a) && a.question_id === q.id,
    );
    const lastUpdated =
      answers
        .map((a) => a.updated_at)
        .sort()
        .at(-1) ?? q.updated_at ?? q.created_at;

    records.push({
      id: q.id,
      questionId: q.id,
      title: q.short_title,
      category: q.categories[0] ?? "uncategorized",
      actorStatus: st.primary,
      sharedAnswerStatus: st.shared,
      lastUpdated,
      sessionId: null,
      href: `/questions/${q.slug}`,
    });
  }

  return records.sort((a, b) =>
    (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  );
}

export function listConversationPromptRecords(
  store: AppStore,
): ConversationPromptRecord[] {
  const sessions = new Map(
    (store.conversation_sessions ?? [])
      .filter((s) => !isQaRecord(s))
      .map((s) => [s.id, s]),
  );
  const real = realSessionIds(store);
  const records: ConversationPromptRecord[] = [];

  for (const item of store.conversation_session_items ?? []) {
    if (!real.has(item.session_id)) continue;
    if (!conversationItemIsComplete(item.status)) continue;
    const session = sessions.get(item.session_id);
    if (!session) continue;
    const prompt = resolveConversationPrompt(item.prompt_id);
    const answers = (store.conversation_quick_answers ?? []).filter(
      (a) => a.session_item_id === item.id && !isQaRecord(a),
    );
    const actors = [
      ...new Set(answers.map((a) => a.actor)),
    ].join(", ");

    records.push({
      id: item.id,
      promptId: item.prompt_id,
      title: prompt?.prompt?.slice(0, 120) ?? item.prompt_id,
      responseType: prompt?.response_type ?? item.item_type,
      mode: session.mode,
      round: sessionRound(session.session_tag),
      actorsAnswered: actors || "—",
      lastUpdated: item.updated_at,
      sessionId: session.id,
      deepQuestionId: prompt?.follow_up_open_question_id ?? null,
      href:
        session.status === "active" || session.status === "paused"
          ? `/conversations/session/${session.id}`
          : `/conversations/session/${session.id}/review`,
    });
  }

  return records.sort((a, b) =>
    (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  );
}

export function listEssentialsCompletedRecords(
  store: AppStore,
): EssentialsCompletedRecord[] {
  const dash = buildEssentialsDashboard(store);
  const moduleTitle = new Map(
    ESSENTIALS_MODULES.map((m) => [m.id, m.title]),
  );
  const qById = questionById(store);

  return dash.screens
    .filter((s) => s.visible && s.state === "completed")
    .map((s) => {
      const q = s.question ?? qById.get(s.screen.question_id) ?? null;
      const answers = (store.answers ?? []).filter(
        (a) =>
          !isQaRecord(a) &&
          (a.question_id === s.screen.question_id ||
            s.screen.paired_question_ids?.includes(a.question_id)),
      );
      const lastUpdated =
        answers
          .map((a) => a.updated_at)
          .sort()
          .at(-1) ?? s.screen.id;
      return {
        id: s.screen.id,
        screenId: s.screen.id,
        title: s.screen.title,
        module: moduleTitle.get(s.screen.module_id) ?? s.screen.module_id,
        questionTitle: q?.short_title ?? s.screen.title,
        status: s.label,
        lastUpdated,
        href: `/questions/before-birth/screen/${s.screen.id}`,
      };
    })
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

export function listSharedDecisionRecords(
  store: AppStore,
): SharedDecisionRecord[] {
  const eligible = store.questions.filter(isProgressEligibleQuestion);
  const eligibleIds = new Set(eligible.map((q) => q.id));
  const qById = questionById(store);
  const records: SharedDecisionRecord[] = [];

  const sharedQuestionIds = new Set<string>();
  for (const a of store.answers ?? []) {
    if (isQaRecord(a)) continue;
    if (!a.is_shared || !hasAnswerContent(a.payload)) continue;
    if (!eligibleIds.has(a.question_id)) continue;
    if (sharedQuestionIds.has(a.question_id)) continue;
    sharedQuestionIds.add(a.question_id);
    const q = qById.get(a.question_id);
    const taskCount = (store.checklist_tasks ?? []).filter(
      (t) => t.linked_question_ids?.includes(a.question_id),
    ).length;
    records.push({
      id: `answer_${a.question_id}`,
      title: q?.short_title ?? a.question_id,
      source: "shared_answer",
      actors: "shared",
      createdAt: a.created_at,
      relatedTaskCount: taskCount,
      href: q ? `/questions/${q.slug}` : "/questions",
    });
  }

  for (const d of store.decisions ?? []) {
    if (!["decided", "tentatively_decided"].includes(d.status)) continue;
    const taskCount = (store.checklist_tasks ?? []).filter(
      (t) =>
        t.linked_question_ids?.some((qid) =>
          d.source_question_ids?.includes(qid),
        ),
    ).length;
    records.push({
      id: d.id,
      title: d.title,
      source: "decision",
      actors: "family",
      createdAt: d.created_at,
      relatedTaskCount: taskCount,
      href: `/decisions/${d.id}`,
    });
  }

  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listOpenFollowUpRecords(store: AppStore): OpenFollowUpRecord[] {
  const index = buildQuestionStatusIndex(store);
  const eligible = store.questions.filter(isProgressEligibleQuestion);
  const real = realSessionIds(store);
  const qById = questionById(store);
  const records: OpenFollowUpRecord[] = [];

  for (const q of eligible) {
    const st = index.get(q.id);
    if (!st) continue;
    if (st.partiallyAnswered && !st.fullyAnswered) {
      records.push({
        id: `partial_${q.id}`,
        group: "partial",
        title: q.short_title,
        detail: "Partially answered",
        lastUpdated: q.updated_at ?? q.created_at,
        href: `/questions/${q.slug}`,
      });
    }
    if (st.undecided || st.primary === "undecided") {
      records.push({
        id: `undecided_${q.id}`,
        group: "undecided",
        title: q.short_title,
        detail: "Undecided",
        lastUpdated: q.updated_at ?? q.created_at,
        href: `/questions/${q.slug}`,
      });
    }
  }

  for (const item of store.conversation_session_items ?? []) {
    if (!real.has(item.session_id)) continue;
    const prompt = resolveConversationPrompt(item.prompt_id);
    const title = prompt?.prompt?.slice(0, 100) ?? item.prompt_id;
    const href = `/conversations/session/${item.session_id}`;
    if (item.status === "discuss_later") {
      records.push({
        id: `discuss_${item.id}`,
        group: "discuss_later",
        title,
        detail: "Discuss later",
        lastUpdated: item.updated_at,
        href,
      });
    }
    if (item.status === "needs_follow_up") {
      records.push({
        id: `followup_item_${item.id}`,
        group: "follow_up_requested",
        title,
        detail: "Follow-up requested",
        lastUpdated: item.updated_at,
        href,
      });
    }
  }

  for (const a of store.answers ?? []) {
    if (isQaRecord(a)) continue;
    const q = qById.get(a.question_id);
    const title = q?.short_title ?? a.question_id;
    const href = q ? `/questions/${q.slug}` : "/questions";
    if (a.needs_research) {
      records.push({
        id: `research_${a.id}`,
        group: a.needs_research ? "needs_research" : "waiting_provider",
        title,
        detail: "Needs research / waiting for provider",
        lastUpdated: a.updated_at,
        href,
      });
    }
    if (a.status === "review_scheduled") {
      records.push({
        id: `review_${a.id}`,
        group: "discuss_later",
        title,
        detail: "Review scheduled",
        lastUpdated: a.updated_at,
        href,
      });
    }
  }

  for (const d of store.conversation_differences ?? []) {
    if (isQaRecord(d)) continue;
    if (!real.has(d.session_id)) continue;
    if (
      d.resolution_status !== "unreviewed" &&
      d.resolution_status !== "kept_separate"
    ) {
      continue;
    }
    const prompt = resolveConversationPrompt(d.prompt_id);
    records.push({
      id: `diff_${d.id}`,
      group: "unresolved_differences",
      title: prompt?.prompt?.slice(0, 100) ?? d.prompt_id,
      detail:
        d.resolution_status === "kept_separate"
          ? "Kept separate"
          : "Unresolved difference",
      lastUpdated: d.updated_at,
      href: `/conversations/session/${d.session_id}`,
    });
  }

  for (const c of store.cooling_off_items ?? []) {
    if (!c.active) continue;
    const q = c.question_id ? qById.get(c.question_id) : null;
    records.push({
      id: `cool_${c.id}`,
      group: "follow_up_requested",
      title: q?.short_title ?? "Cooling-off item",
      detail: "Active cooling-off",
      lastUpdated: c.created_at,
      href: q ? `/questions/${q.slug}` : "/home",
    });
  }

  return records.sort((a, b) =>
    (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  );
}

/**
 * Tile count vs detail list reconciliation.
 * Pass Home metrics from buildFamilyProgressMetrics — never hide mismatches.
 */
export function reconcileProgressTileCounts(
  store: AppStore,
  homeMetrics: {
    canonicalQuestionsAnswered: number;
    conversationPromptsCompleted: number;
    essentialsScreensCompleted: number;
    sharedDecisions: number;
    openFollowUps: number;
  },
) {
  const deep = listDeepDiscussionRecords(store).length;
  const prompts = listConversationPromptRecords(store).length;
  const essentials = listEssentialsCompletedRecords(store).length;
  const shared = listSharedDecisionRecords(store).length;
  const followUps = listOpenFollowUpRecords(store).length;

  const rows = [
    {
      key: "deepDiscussions" as const,
      label: "Deep discussions",
      home: homeMetrics.canonicalQuestionsAnswered,
      detail: deep,
      remoteRaw: deep,
      match: homeMetrics.canonicalQuestionsAnswered === deep,
    },
    {
      key: "conversationPrompts" as const,
      label: "Conversation prompts",
      home: homeMetrics.conversationPromptsCompleted,
      detail: prompts,
      remoteRaw: prompts,
      match: homeMetrics.conversationPromptsCompleted === prompts,
    },
    {
      key: "essentials" as const,
      label: "Essentials",
      home: homeMetrics.essentialsScreensCompleted,
      detail: essentials,
      remoteRaw: essentials,
      match: homeMetrics.essentialsScreensCompleted === essentials,
    },
    {
      key: "sharedDecisions" as const,
      label: "Shared decisions",
      home: homeMetrics.sharedDecisions,
      detail: shared,
      remoteRaw: shared,
      match: homeMetrics.sharedDecisions === shared,
    },
    {
      key: "openFollowUps" as const,
      label: "Open follow-ups",
      home: homeMetrics.openFollowUps,
      detail: followUps,
      remoteRaw: followUps,
      match: homeMetrics.openFollowUps === followUps,
    },
  ];

  const allMatch = rows.every((r) => r.match);
  if (!allMatch) {
    console.info("[progress_count_mismatch]", {
      mismatches: rows
        .filter((r) => !r.match)
        .map((r) => ({
          key: r.key,
          home: r.home,
          detail: r.detail,
        })),
    });
  }

  return { rows, allMatch };
}

export function sortProgressRecords<T extends { lastUpdated?: string; createdAt?: string; title?: string; category?: string; module?: string }>(
  records: T[],
  sort: ProgressRecordSort,
): T[] {
  const copy = [...records];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) =>
        (a.lastUpdated ?? a.createdAt ?? "").localeCompare(
          b.lastUpdated ?? b.createdAt ?? "",
        ),
      );
    case "category":
      return copy.sort((a, b) =>
        (a.category ?? "").localeCompare(b.category ?? ""),
      );
    case "module":
      return copy.sort((a, b) =>
        (a.module ?? "").localeCompare(b.module ?? ""),
      );
    case "title":
      return copy.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? ""),
      );
    case "newest":
    default:
      return copy.sort((a, b) =>
        (b.lastUpdated ?? b.createdAt ?? "").localeCompare(
          a.lastUpdated ?? a.createdAt ?? "",
        ),
      );
  }
}
