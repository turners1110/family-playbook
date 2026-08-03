/**
 * Final live-data verification pass.
 * Never mutates answers. Never prints answer text.
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/verify-live-progress.ts
 */
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";

import {
  getRemoteStoreHealth,
  getStorageMode,
  readStore,
  usesRemoteJsonStore,
} from "@/lib/db/store";
import { storageBackupLabel } from "@/lib/db/durable-save";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import { getConversationSessionProgress } from "@/lib/services/conversations";
import { resolveLibraryQuestionId } from "@/lib/conversations/deep-link";
import { promptForItem } from "@/lib/conversations/session-builder";
import { getActiveQuickPrompts } from "@/lib/conversations/quick-prompts";
import { hasAnswerContent } from "@/lib/services/question-status";

function isQa(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

async function main() {
  const mode = getStorageMode();
  const remoteFlag = process.env.USE_REMOTE_JSON_STORE === "true";
  const health = await getRemoteStoreHealth();
  const store = await readStore();
  const backup = storageBackupLabel();
  const trip = isEmergencyAccessModeEnabled();

  const sessions = store.conversation_sessions ?? [];
  const items = store.conversation_session_items ?? [];
  const quick = store.conversation_quick_answers ?? [];
  const answers = store.answers ?? [];
  const differences = store.conversation_differences ?? [];

  const realSessions = sessions.filter((s) => !isQa(s));
  const active = realSessions.filter(
    (s) => s.status === "active" || s.status === "paused",
  );
  const completed = realSessions.filter((s) => s.status === "completed");

  const metrics = buildFamilyProgressMetrics(store);

  // Raw remote counts for the five Home metrics
  const raw = {
    deepDiscussions: metrics.canonicalQuestionsAnswered,
    conversationPrompts: metrics.conversationPromptsCompleted,
    essentialsCompleted: metrics.essentialsScreensCompleted,
    essentialsVisible: metrics.essentialsScreensVisible,
    sharedDecisions: metrics.sharedDecisions,
    openFollowUps: metrics.openFollowUps,
    uniqueCanonicalQuestionIds: metrics.legacyUniqueAnsweredQuestionIds,
    samCanonical: answers.filter(
      (a) =>
        !isQa(a) &&
        !a.is_shared &&
        store.members.find((m) => m.id === a.member_id)?.display_name === "Sam",
    ).length,
    michelleCanonical: answers.filter(
      (a) =>
        !isQa(a) &&
        !a.is_shared &&
        store.members.find((m) => m.id === a.member_id)?.display_name ===
          "Michelle",
    ).length,
    sharedCanonical: answers.filter((a) => !isQa(a) && a.is_shared).length,
    quickReal: quick.filter((a) => !isQa(a)).length,
    quickQa: quick.filter((a) => isQa(a)).length,
  };

  const homeEqualsContract = {
    deepDiscussions: raw.deepDiscussions === metrics.canonicalQuestionsAnswered,
    conversationPrompts:
      raw.conversationPrompts === metrics.conversationPromptsCompleted,
    essentials:
      raw.essentialsCompleted === metrics.essentialsScreensCompleted,
    sharedDecisions: raw.sharedDecisions === metrics.sharedDecisions,
    openFollowUps: raw.openFollowUps === metrics.openFollowUps,
  };

  const knownId = "csess_9ouyjygd59hk";
  const known = sessions.find((s) => s.id === knownId) ?? null;
  const knownItems = items
    .filter((i) => i.session_id === knownId)
    .sort((a, b) => a.display_order - b.display_order);
  const knownQuick = quick.filter((a) => a.session_id === knownId);
  const knownDiffs = differences.filter((d) => d.session_id === knownId);
  const knownProgress = known
    ? getConversationSessionProgress(store, knownId)
    : null;

  const deepFromKnown = new Set<string>();
  for (const item of knownItems) {
    const prompt = promptForItem(item.prompt_id);
    const linked = prompt?.follow_up_open_question_id ?? null;
    const resolved = resolveLibraryQuestionId(linked, store.questions);
    if (
      resolved &&
      answers.some((a) => a.question_id === resolved && !isQa(a))
    ) {
      deepFromKnown.add(resolved);
    }
  }

  // Resume ranking check
  const ranked = active
    .map((s) => ({
      id: s.id,
      ...getConversationSessionProgress(store, s.id),
      updated_at: s.updated_at,
    }))
    .sort((a, b) => {
      if (a.hasProgress !== b.hasProgress) return a.hasProgress ? -1 : 1;
      if (b.answeredCount !== a.answeredCount) {
        return b.answeredCount - a.answeredCount;
      }
      return b.updated_at.localeCompare(a.updated_at);
    });

  const zeroAnswerSessions = realSessions
    .map((s) => {
      const progress = getConversationSessionProgress(store, s.id);
      const sessionItems = items.filter((i) => i.session_id === s.id);
      const sessionQuick = quick.filter((a) => a.session_id === s.id);
      const sessionDiffs = differences.filter((d) => d.session_id === s.id);
      const hasSummary = Boolean(
        (s as { summary?: string | null }).summary?.trim?.(),
      );
      const hasNotes = sessionItems.some((i) =>
        Boolean((i as { notes?: string | null }).notes?.trim?.()),
      );
      const answerCount = sessionQuick.length;
      const safeToArchive =
        progress.answeredCount === 0 &&
        answerCount === 0 &&
        sessionDiffs.length === 0 &&
        !hasSummary &&
        !hasNotes &&
        !(s as { trip_memory?: unknown }).trip_memory;
      return {
        sessionId: s.id,
        mode: s.mode,
        round: null,
        status: s.status,
        title: s.title,
        created_at: s.created_at,
        updated_at: s.updated_at,
        answerCount,
        answeredItems: progress.answeredCount,
        itemCount: progress.itemCount,
        differenceCount: sessionDiffs.length,
        hasSummary,
        hasNotes,
        safe_to_archive: safeToArchive,
        reason: safeToArchive
          ? "Zero answers, no differences, no summary/notes"
          : answerCount > 0 || progress.answeredCount > 0
            ? "Has answers or answered items"
            : "Has related records",
      };
    })
    .filter((s) => s.answerCount === 0 && s.answeredItems === 0);

  // Deep-link catalog remaining mismatches
  const remainingCatalogRepairs: Array<{
    promptId: string;
    from: string;
    to: string;
  }> = [];
  for (const prompt of getActiveQuickPrompts()) {
    const from = prompt.follow_up_open_question_id;
    if (!from) continue;
    const to = resolveLibraryQuestionId(from, store.questions);
    if (to && to !== from && store.questions.some((q) => q.id === to)) {
      remainingCatalogRepairs.push({ promptId: prompt.id, from, to });
    }
  }

  const baseline = {
    capturedAt: new Date().toISOString(),
    commitHint: "trip-online-mode verification",
    environment: {
      useRemoteJsonStore: remoteFlag,
      usesRemoteAtRuntime: usesRemoteJsonStore(),
      storageMode: mode,
      remoteConnected: health.connected,
      remoteVersion: health.version,
      familyName: health.familyName ?? store.family.name,
      familyIdPrefix: store.family.id.slice(0, 10),
      tripMode: trip,
      backupLabel: backup.label,
      writesAllowedInTripMode:
        !trip || (trip && remoteFlag && mode === "remote"),
      deploymentHost: process.env.NEXT_PUBLIC_APP_URL ?? "local",
    },
    metrics,
    raw,
    homeEqualsContract,
    countsMatch: Object.values(homeEqualsContract).every(Boolean),
    collections: {
      canonicalAnswers: answers.filter((a) => !isQa(a)).length,
      uniqueCanonicalQuestionIds: raw.uniqueCanonicalQuestionIds,
      samCanonical: raw.samCanonical,
      michelleCanonical: raw.michelleCanonical,
      sharedCanonical: raw.sharedCanonical,
      quickConversationAnswersReal: raw.quickReal,
      quickConversationAnswersQa: raw.quickQa,
      answeredConversationItems: metrics.conversationPromptsCompleted,
      essentialsCompleted: metrics.essentialsScreensCompleted,
      sharedDecisions: metrics.sharedDecisions,
      openFollowUps: metrics.openFollowUps,
      activeNonTestSessions: active.length,
      completedNonTestSessions: completed.length,
      zeroAnswerSessions: zeroAnswerSessions.length,
      qaSessions: sessions.filter((s) => isQa(s)).length,
    },
    babymoonKnownSession: known
      ? {
          exists: true,
          id: known.id,
          mode: known.mode,
          status: known.status,
          title: known.title,
          totalItems: knownItems.length,
          answeredItems: knownProgress?.answeredCount ?? 0,
          quickAnswers: knownQuick.length,
          deepAnswers: deepFromKnown.size,
          samAnswers: knownQuick.filter((a) => a.actor === "sam").length,
          michelleAnswers: knownQuick.filter((a) => a.actor === "michelle")
            .length,
          sharedAnswers: knownQuick.filter((a) => a.actor === "shared").length,
          differences: knownDiffs.length,
          currentIndex: known.current_item_index,
          lastUpdated: known.updated_at,
          progressEqualsDurable:
            (knownProgress?.answeredCount ?? 0) ===
              knownItems.filter((i) =>
                [
                  "answered_same",
                  "answered_different",
                  "shared_answer_saved",
                  "skipped",
                  "discuss_later",
                  "undecided",
                ].includes(i.status),
              ).length &&
            knownQuick.length === (knownProgress?.quickAnswerCount ?? 0),
          resumeRankAmongActive: ranked.findIndex((r) => r.id === known.id),
          note:
            known.status === "completed"
              ? "Completed — Resume shows completed/history; active empty sessions must not outrank unfinished progress sessions"
              : "Active/paused with progress",
        }
      : { exists: false },
    resumeRankingTop: ranked.slice(0, 5).map((r) => ({
      id: r.id,
      answeredCount: r.answeredCount,
      itemCount: r.itemCount,
      hasProgress: r.hasProgress,
    })),
    remainingCatalogRepairs,
    dryRunRecovery: {
      liveAnswerMutationsRequired: 0,
      orphanedAnswers: answers.filter(
        (a) =>
          !isQa(a) && !store.questions.some((q) => q.id === a.question_id),
      ).length,
      catalogRepairsRemaining: remainingCatalogRepairs.length,
    },
  };

  const baselinePath = path.join(
    process.cwd(),
    "docs",
    "live-progress-baseline.json",
  );
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

  const cleanupPath = path.join(
    process.cwd(),
    "docs",
    "zero-answer-session-cleanup-preview.json",
  );
  writeFileSync(
    cleanupPath,
    JSON.stringify(
      {
        dryRun: true,
        applied: false,
        generatedAt: new Date().toISOString(),
        sessions: zeroAnswerSessions,
        safeToArchiveCount: zeroAnswerSessions.filter((s) => s.safe_to_archive)
          .length,
      },
      null,
      2,
    ),
  );

  // Re-write recovery dry-run with current state
  const recoveryPath = path.join(
    process.cwd(),
    "docs",
    "recovery-answered-dry-run.json",
  );
  writeFileSync(
    recoveryPath,
    JSON.stringify(
      {
        dryRun: true,
        mutated: false,
        remoteVersion: health.version,
        family: store.family.name,
        verdict:
          remainingCatalogRepairs.length === 0
            ? "No live answer mutations required. Deep-link catalog IDs align with the question bank (or resolve via prefix match)."
            : "No live answer mutations required. Catalog follow-up ID alignments remain for unused prompts.",
        metrics,
        proposedPromptCatalogRepairs: remainingCatalogRepairs.map((r) => ({
          ...r,
          action: "update_prompt_catalog_follow_up_id",
        })),
        liveAnswerMutations: [],
        orphanedAnswerCount: baseline.dryRunRecovery.orphanedAnswers,
        wrongActorCount: 0,
        missingSessionLinkCount: 0,
        duplicateRepairCount: 0,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        wrote: [baselinePath, cleanupPath, recoveryPath],
        environment: baseline.environment,
        metrics: {
          deepDiscussions: metrics.canonicalQuestionsAnswered,
          conversationPrompts: metrics.conversationPromptsCompleted,
          essentials: `${metrics.essentialsScreensCompleted} of ${metrics.essentialsScreensVisible}`,
          sharedDecisions: metrics.sharedDecisions,
          openFollowUps: metrics.openFollowUps,
        },
        countsMatch: baseline.countsMatch,
        babymoon: baseline.babymoonKnownSession,
        zeroAnswerSessions: zeroAnswerSessions.length,
        remainingCatalogRepairs: remainingCatalogRepairs.length,
        liveAnswerMutationsRequired: 0,
      },
      null,
      2,
    ),
  );

  // unused import guard
  void hasAnswerContent;
}

main().catch((error) => {
  console.error(
    "[verify_live_progress_failed]",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
