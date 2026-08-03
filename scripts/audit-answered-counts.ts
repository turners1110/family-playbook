/**
 * Safe forensic inventory of answer collections.
 * Never prints answer text / notes / secrets.
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/audit-answered-counts.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

process.env.USE_REMOTE_JSON_STORE = "true";

import { readStore, getRemoteStoreHealth, getStorageMode } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";
import { buildProgressSnapshot } from "@/lib/services/answered-status";
import { getConversationSessionProgress } from "@/lib/services/conversations";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { promptForItem } from "@/lib/conversations/session-builder";
import type {
  AppStore,
} from "@/lib/types/models";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";

type CollectionStats = {
  total: number;
  real: number;
  qa: number;
  uniqueQuestionIds: number;
  uniqueSessionIds: number;
  actorBreakdown: Record<string, number>;
  earliest: string | null;
  latest: string | null;
};

function isQa(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
  id?: string;
}): boolean {
  if (row.is_test_data) return true;
  if (row.test_run_id) return true;
  if (row.id?.startsWith("qa_") || row.id?.includes("_test_")) return true;
  return false;
}

function stampStats(
  rows: Array<{
    updated_at?: string;
    created_at?: string;
    is_test_data?: boolean;
    test_run_id?: string | null;
    id?: string;
    question_id?: string | null;
    prompt_id?: string | null;
    session_id?: string | null;
    actor?: string | null;
    member_id?: string | null;
    is_shared?: boolean;
  }>,
  opts?: {
    questionKey?: "question_id" | "prompt_id";
  },
): CollectionStats {
  const qKey = opts?.questionKey ?? "question_id";
  const questions = new Set<string>();
  const sessions = new Set<string>();
  const actors: Record<string, number> = {};
  let earliest: string | null = null;
  let latest: string | null = null;
  let real = 0;
  let qa = 0;

  for (const row of rows) {
    if (isQa(row)) qa += 1;
    else real += 1;
    const qid = (row as Record<string, unknown>)[qKey];
    if (typeof qid === "string" && qid) questions.add(qid);
    if (row.session_id) sessions.add(row.session_id);
    let actor = row.actor ?? null;
    if (!actor && row.is_shared) actor = "shared";
    if (!actor && row.member_id) actor = `member:${row.member_id}`;
    if (!actor) actor = "unknown";
    actors[actor] = (actors[actor] ?? 0) + 1;
    const ts = row.updated_at ?? row.created_at ?? null;
    if (ts) {
      if (!earliest || ts < earliest) earliest = ts;
      if (!latest || ts > latest) latest = ts;
    }
  }

  return {
    total: rows.length,
    real,
    qa,
    uniqueQuestionIds: questions.size,
    uniqueSessionIds: sessions.size,
    actorBreakdown: actors,
    earliest,
    latest,
  };
}

const ANSWERED_STATUSES = new Set([
  "answered_same",
  "answered_different",
  "shared_answer_saved",
  "skipped",
  "discuss_later",
  "undecided",
  "needs_follow_up",
]);

type CardClass =
  | "A_counted"
  | "B_saved_not_counted_intentional"
  | "C_saved_omitted_bug"
  | "D_status_without_answer"
  | "E_wrong_actor"
  | "F_wrong_question"
  | "G_duplicate"
  | "H_orphaned"
  | "I_lost";

function classifySessionCards(store: AppStore, sessionId: string) {
  const session = store.conversation_sessions?.find((s) => s.id === sessionId);
  const items = (store.conversation_session_items ?? [])
    .filter((i) => i.session_id === sessionId)
    .sort((a, b) => a.display_order - b.display_order);
  const quick = (store.conversation_quick_answers ?? []).filter(
    (a) => a.session_id === sessionId,
  );
  const questionIds = new Set(store.questions.map((q) => q.id));
  const statusIndex = buildQuestionStatusIndex(store);
  const homeAnswered = new Set(
    store.answers.filter((a) => !isQa(a)).map((a) => a.question_id),
  );

  const classes: Record<CardClass, number> = {
    A_counted: 0,
    B_saved_not_counted_intentional: 0,
    C_saved_omitted_bug: 0,
    D_status_without_answer: 0,
    E_wrong_actor: 0,
    F_wrong_question: 0,
    G_duplicate: 0,
    H_orphaned: 0,
    I_lost: 0,
  };

  const details: Array<{
    itemId: string;
    promptId: string;
    status: string;
    responseType: string | null;
    quickCount: number;
    deepQuestionId: string | null;
    deepAnswered: boolean;
    affectsHome: boolean;
    shouldAffectHome: boolean;
    class: CardClass;
  }> = [];

  for (const item of items) {
    const prompt = promptForItem(item.prompt_id);
    const itemQuick = quick.filter((a) => a.session_item_id === item.id);
    const deepId = prompt?.follow_up_open_question_id ?? item.source_question_id ?? null;
    const deepExists = deepId ? questionIds.has(deepId) : false;
    const deepAnswered = deepId
      ? store.answers.some((a) => a.question_id === deepId && !isQa(a))
      : false;
    const affectsHome = deepId ? homeAnswered.has(deepId) : false;
    // Quick companions should NOT affect home canonical count.
    const shouldAffectHome = Boolean(deepId && deepExists && deepAnswered);

    let cls: CardClass = "B_saved_not_counted_intentional";
    if (!ANSWERED_STATUSES.has(item.status) && itemQuick.length === 0) {
      cls = "I_lost"; // opened/pending with no answers — not answered
      if (item.status === "pending" || item.status === "opened") {
        // not answered cards — skip classification as loss
        continue;
      }
    }
    if (ANSWERED_STATUSES.has(item.status) && itemQuick.length === 0) {
      cls = "D_status_without_answer";
    } else if (itemQuick.length > 0 && !deepId) {
      cls = "B_saved_not_counted_intentional";
    } else if (itemQuick.length > 0 && deepId && !deepExists) {
      cls = "F_wrong_question";
    } else if (itemQuick.length > 0 && deepId && deepAnswered && affectsHome) {
      cls = "A_counted";
    } else if (itemQuick.length > 0 && deepId && deepAnswered && !affectsHome) {
      cls = "C_saved_omitted_bug";
    } else if (itemQuick.length > 0 && deepId && !deepAnswered) {
      cls = "B_saved_not_counted_intentional";
    }

    // Duplicate quick rows same actor+item
    const seen = new Set<string>();
    for (const a of itemQuick) {
      const key = `${a.actor}:${a.session_item_id}`;
      if (seen.has(key)) {
        classes.G_duplicate += 1;
      }
      seen.add(key);
    }

    classes[cls] += 1;
    details.push({
      itemId: item.id,
      promptId: item.prompt_id,
      status: item.status,
      responseType: prompt?.response_type ?? null,
      quickCount: itemQuick.length,
      deepQuestionId: deepId,
      deepAnswered,
      affectsHome,
      shouldAffectHome,
      class: cls,
    });
  }

  // Orphan quick answers for this session
  const itemIds = new Set(items.map((i) => i.id));
  const orphans = quick.filter((a) => !itemIds.has(a.session_item_id));
  classes.H_orphaned += orphans.length;

  const answeredItems = items.filter((i) => ANSWERED_STATUSES.has(i.status));
  const linkedDeep = new Set(
    details.map((d) => d.deepQuestionId).filter(Boolean) as string[],
  );
  const canonicalMarked = [...linkedDeep].filter((id) => {
    const st = statusIndex.get(id);
    return st?.fullyAnswered || homeAnswered.has(id);
  });

  return {
    session: session
      ? {
          id: session.id,
          mode: session.mode,
          round: (session as { babymoon_round?: number | null }).babymoon_round ?? null,
          status: session.status,
          title: session.title,
          is_test_data: Boolean(session.is_test_data),
          test_run_id: session.test_run_id ?? null,
          updated_at: session.updated_at,
        }
      : null,
    totalCards: items.length,
    answeredCards: answeredItems.length,
    quickAnswerCount: quick.length,
    deepAnswerCount: details.filter((d) => d.deepAnswered).length,
    samQuick: quick.filter((a) => a.actor === "sam").length,
    michelleQuick: quick.filter((a) => a.actor === "michelle").length,
    sharedQuick: quick.filter((a) => a.actor === "shared").length,
    undecided: answeredItems.filter((i) => i.status === "undecided").length,
    discussLater: answeredItems.filter((i) => i.status === "discuss_later")
      .length,
    skipped: answeredItems.filter((i) => i.status === "skipped").length,
    linkedCanonicalQuestionIds: [...linkedDeep],
    canonicalQuestionsMarkedAnswered: canonicalMarked,
    classes,
    details,
    orphans: orphans.length,
    progress: getConversationSessionProgress(store, sessionId),
  };
}

async function main() {
  const mode = getStorageMode();
  const health = await getRemoteStoreHealth();
  const store = await readStore();

  const members = store.members ?? [];
  const samId = members.find((m) => m.display_name === "Sam")?.id;
  const michelleId = members.find((m) => m.display_name === "Michelle")?.id;

  const answers = store.answers ?? [];
  const realAnswers = answers.filter((a) => !isQa(a));
  const quick = store.conversation_quick_answers ?? [];
  const items = store.conversation_session_items ?? [];
  const sessions = store.conversation_sessions ?? [];

  const knownQuestionIds = new Set(store.questions.map((q) => q.id));
  const knownPromptish = new Set(
    [
      ...store.questions.map((q) => q.id),
      ...(store.conversation_session_items ?? []).map((i) => i.prompt_id),
    ].filter(Boolean),
  );

  const orphanedCanonical = realAnswers.filter(
    (a) => !knownQuestionIds.has(a.question_id),
  );
  const unknownQuick = quick.filter(
    (a) => a.prompt_id && !knownPromptish.has(a.prompt_id),
  );

  // Duplicate logical answers: same question + actor/shared
  const logicalKeys = new Map<string, number>();
  for (const a of realAnswers) {
    const key = `${a.question_id}:${a.is_shared ? "shared" : a.member_id ?? "none"}`;
    logicalKeys.set(key, (logicalKeys.get(key) ?? 0) + 1);
  }
  const duplicateLogical = [...logicalKeys.values()].filter((n) => n > 1).length;

  const statusIndex = buildQuestionStatusIndex(store);
  const homeStyle = new Set(realAnswers.map((a) => a.question_id));
  const activeQuestions = store.questions.filter((q) => q.active !== false);
  const progressEligible = activeQuestions.filter(
    (q) => !q.id.startsWith("qa_") && !/(^|[_-])test([_-]|$)/i.test(q.id),
  );

  let fullyAnswered = 0;
  let samOnly = 0;
  let michelleOnly = 0;
  let both = 0;
  let shared = 0;
  let undecided = 0;
  for (const q of progressEligible) {
    const st = statusIndex.get(q.id);
    if (!st) continue;
    if (st.fullyAnswered || st.primary === "shared_answer_saved") fullyAnswered += 1;
    if (st.primary === "sam_answered") samOnly += 1;
    if (st.primary === "michelle_answered") michelleOnly += 1;
    if (st.primary === "both_answered") both += 1;
    if (st.primary === "shared_answer_saved") shared += 1;
    if (st.undecided || st.primary === "undecided") undecided += 1;
  }

  const essentials = buildEssentialsDashboard(store);

  const babymoonSessions = sessions
    .filter((s) => s.mode === "babymoon" || s.id === "csess_9ouyjygd59hk")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const sessionReports = babymoonSessions
    .filter((s) => !s.is_test_data)
    .slice(0, 8)
    .map((s) => classifySessionCards(store, s.id));

  // Also always include known session even if test-flagged
  const known = sessions.find((s) => s.id === "csess_9ouyjygd59hk");
  if (known && !sessionReports.some((r) => r.session?.id === known.id)) {
    sessionReports.unshift(classifySessionCards(store, known.id));
  }

  const activeSession =
    sessions
      .filter((s) => !s.is_test_data && (s.status === "active" || s.status === "paused"))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;

  const snapshot = buildProgressSnapshot(store, activeSession);

  // Essentials answers = answers whose question is in essentials pathway screens
  const essentialsQuestionIds = new Set(
    ESSENTIALS_SCREENS.map((s) => s.question_id),
  );
  const essentialsAnswers = realAnswers.filter((a) =>
    essentialsQuestionIds.has(a.question_id),
  );

  const report = {
    storage: {
      mode,
      forcedRemote: true,
      remoteConnected: health.connected,
      remoteVersion: health.version,
      familyName: health.familyName ?? store.family.name,
      familyIdHash: store.family.id.slice(0, 8),
      updatedAt: health.updatedAt,
    },
    collections: {
      canonical_answers: stampStats(answers),
      canonical_answers_real_only: stampStats(realAnswers),
      sam_canonical: stampStats(
        realAnswers.filter((a) => a.member_id === samId && !a.is_shared),
      ),
      michelle_canonical: stampStats(
        realAnswers.filter((a) => a.member_id === michelleId && !a.is_shared),
      ),
      shared_canonical: stampStats(realAnswers.filter((a) => a.is_shared)),
      quick_conversation_answers: stampStats(quick, { questionKey: "prompt_id" }),
      session_items_answered: stampStats(
        items.filter((i) => ANSWERED_STATUSES.has(i.status)),
        { questionKey: "prompt_id" },
      ),
      essentials_answers: stampStats(essentialsAnswers),
      undecided_answers: stampStats(
        realAnswers.filter((a) => a.status === "undecided"),
      ),
      discuss_later_ish: stampStats(
        realAnswers.filter((a) => a.status === "review_scheduled"),
      ),
      waiting_provider: stampStats(
        realAnswers.filter((a) => a.needs_research),
      ),
    },
    integrity: {
      orphaned_canonical_unknown_question_id: orphanedCanonical.length,
      unknown_quick_prompt_ids: unknownQuick.length,
      duplicate_logical_answer_groups: duplicateLogical,
      qa_answers: answers.filter((a) => isQa(a)).length,
      qa_quick: quick.filter((a) => isQa(a)).length,
      qa_sessions: sessions.filter((s) => s.is_test_data).length,
    },
    home_metric_today: {
      implementation:
        "getDashboardStats: unique question_id in store.answers (includes shared+individual; any actor; does NOT use buildQuestionStatusIndex.fullyAnswered; does NOT count quick answers)",
      uniqueAnsweredQuestionIds: homeStyle.size,
      activeQuestions: activeQuestions.length,
      progressEligibleQuestions: progressEligible.length,
      statusIndex_fullyAnswered: fullyAnswered,
      statusIndex_sam_only: samOnly,
      statusIndex_michelle_only: michelleOnly,
      statusIndex_both: both,
      statusIndex_shared: shared,
      statusIndex_undecided: undecided,
      essentials_completed: essentials.completed,
      essentials_visible: essentials.visible_primary,
      snapshot,
    },
    babymoon_sessions: sessionReports.map((r) => ({
      session: r.session,
      totalCards: r.totalCards,
      answeredCards: r.answeredCards,
      quickAnswerCount: r.quickAnswerCount,
      deepAnswerCount: r.deepAnswerCount,
      samQuick: r.samQuick,
      michelleQuick: r.michelleQuick,
      sharedQuick: r.sharedQuick,
      undecided: r.undecided,
      discussLater: r.discussLater,
      skipped: r.skipped,
      linkedCanonicalCount: r.linkedCanonicalQuestionIds.length,
      canonicalMarkedCount: r.canonicalQuestionsMarkedAnswered.length,
      progress: r.progress,
      classes: r.classes,
      orphans: r.orphans,
      // Safe card summary — no answer text
      cards: r.details.map((d) => ({
        promptId: d.promptId,
        status: d.status,
        responseType: d.responseType,
        quickCount: d.quickCount,
        deepQuestionId: d.deepQuestionId,
        deepAnswered: d.deepAnswered,
        affectsHome: d.affectsHome,
        shouldAffectHome: d.shouldAffectHome,
        class: d.class,
      })),
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("[audit_failed]", error instanceof Error ? error.message : error);
  process.exit(1);
});
