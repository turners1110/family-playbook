import { id, nowIso, readStore, updateStore } from "@/lib/db/store";
import type {
  AppStore,
  ConversationItemStatus,
  ConversationModeId,
  ConversationQuickAnswer,
  ConversationSession,
  ConversationSessionItem,
  ConversationSessionSummary,
  DifferenceResolution,
} from "@/lib/types/models";
import {
  buildConversationSession,
  describeEnergyMix,
  type SessionBuilderInput,
} from "@/lib/conversations/session-builder";
import { getConversationMode } from "@/lib/conversations/modes";
import { getBabymoonRound } from "@/lib/conversations/babymoon-set";
import { promptForItem } from "@/lib/conversations/session-builder";
import { buildSessionSummary } from "@/lib/conversations/summary";
import { measureActiveSeconds } from "@/lib/conversations/timing";
import { ensureConversationQuestionOptions } from "@/lib/conversations/ensure-options";
import { answeredLibraryDeepIds } from "@/lib/services/previously-answered";

function ensureCollections(store: AppStore) {
  if (!store.conversation_sessions) store.conversation_sessions = [];
  if (!store.conversation_session_items) store.conversation_session_items = [];
  if (!store.conversation_quick_answers) store.conversation_quick_answers = [];
  if (!store.conversation_differences) store.conversation_differences = [];
  ensureConversationQuestionOptions(store);
}

function snapshotAnswer(a: ConversationQuickAnswer): string {
  if (a.short_text) return a.short_text;
  if (a.selected_options.length) return a.selected_options.join(", ");
  if (a.scale != null) return String(a.scale);
  return "";
}

function answersEqual(
  a: ConversationQuickAnswer | undefined,
  b: ConversationQuickAnswer | undefined,
): boolean {
  if (!a || !b) return false;
  return snapshotAnswer(a) === snapshotAnswer(b) && snapshotAnswer(a) !== "";
}

export async function listConversationSessions(options?: {
  includeTestData?: boolean;
}) {
  const store = await readStore();
  ensureCollections(store);
  return [...(store.conversation_sessions ?? [])]
    .filter((s) => options?.includeTestData || !s.is_test_data)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Progress metadata for resume UI — never includes answer text. */
export function getConversationSessionProgress(
  store: Awaited<ReturnType<typeof readStore>>,
  sessionId: string,
) {
  ensureCollections(store);
  const items = (store.conversation_session_items ?? []).filter(
    (i) => i.session_id === sessionId,
  );
  const answered = items.filter((i) =>
    [
      "answered_same",
      "answered_different",
      "shared_answer_saved",
      "skipped",
      "discuss_later",
      "undecided",
    ].includes(i.status),
  ).length;
  const quickCount = (store.conversation_quick_answers ?? []).filter(
    (a) => a.session_id === sessionId,
  ).length;
  return {
    itemCount: items.length,
    answeredCount: answered,
    quickAnswerCount: quickCount,
    hasProgress: answered > 0 || quickCount > 0,
  };
}

/**
 * Prefer continuing an unfinished session over creating a blank one.
 * This was the production data-loss illusion: answers were saved, but Start
 * created a new empty session that sorted above the real one.
 */
export async function findResumableConversationSession(input: {
  mode: ConversationModeId;
  babymoonRound?: 1 | 2 | 3;
}): Promise<{
  sessionId: string;
  answeredCount: number;
  itemCount: number;
} | null> {
  const store = await readStore();
  ensureCollections(store);
  const tag = input.babymoonRound
    ? `babymoon_set_v1_round_${input.babymoonRound}`
    : getConversationMode(input.mode).session_tag;

  const candidates = (store.conversation_sessions ?? []).filter(
    (s) =>
      !s.is_test_data &&
      (s.status === "active" || s.status === "paused") &&
      s.mode === input.mode &&
      (input.babymoonRound ? s.session_tag === tag : true),
  );
  if (!candidates.length) return null;

  const ranked = candidates
    .map((s) => {
      const progress = getConversationSessionProgress(store, s.id);
      return { session: s, ...progress };
    })
    .sort((a, b) => {
      if (a.hasProgress !== b.hasProgress) return a.hasProgress ? -1 : 1;
      if (b.answeredCount !== a.answeredCount) {
        return b.answeredCount - a.answeredCount;
      }
      return b.session.updated_at.localeCompare(a.session.updated_at);
    });

  const best = ranked[0]!;
  // Only auto-resume when there is real progress; otherwise allow a fresh start.
  if (!best.hasProgress) return null;
  return {
    sessionId: best.session.id,
    answeredCount: best.answeredCount,
    itemCount: best.itemCount,
  };
}

export async function getConversationSession(sessionId: string) {
  const store = await readStore();
  ensureCollections(store);
  const session = store.conversation_sessions!.find((s) => s.id === sessionId);
  if (!session) return null;
  const items = store
    .conversation_session_items!.filter((i) => i.session_id === sessionId)
    .sort((a, b) => a.display_order - b.display_order);
  const answers = store.conversation_quick_answers!.filter(
    (a) => a.session_id === sessionId,
  );
  const differences = store.conversation_differences!.filter(
    (d) => d.session_id === sessionId,
  );
  return { session, items, answers, differences, members: store.members };
}

export async function startConversationSession(input: {
  mode: ConversationModeId;
  plannedMinutes: number;
  createdBy: string;
  babymoonRound?: 1 | 2 | 3;
  title?: string;
  builder?: Partial<SessionBuilderInput>;
  /** When true, never resume — always create (tests / explicit restart). */
  forceNew?: boolean;
  /** Mark Start-again repeats of a completed round. */
  isRepeat?: boolean;
  repeatsSessionId?: string | null;
}) {
  if (!input.forceNew) {
    const resumable = await findResumableConversationSession({
      mode: input.mode,
      babymoonRound: input.babymoonRound,
    });
    if (resumable) {
      return {
        sessionId: resumable.sessionId,
        energyMix: "Continuing saved progress",
        itemCount: resumable.itemCount,
        resumed: true as const,
        answeredCount: resumable.answeredCount,
      };
    }
  }

  const mode = getConversationMode(input.mode);
  const builderInput: SessionBuilderInput = {
    mode: input.mode,
    plannedMinutes: input.plannedMinutes,
    babymoonRound: input.babymoonRound,
    avoidRecentlyAnswered: true,
    ...input.builder,
  };

  // Load recent answers for avoidance + skip library questions already decided.
  const prior = await readStore();
  ensureCollections(prior);
  builderInput.recentlyAnsweredIds = (prior.conversation_quick_answers ?? [])
    .slice(-80)
    .map((a) => a.prompt_id);
  if (builderInput.includeUnansweredOnly !== false) {
    builderInput.answeredLibraryQuestionIds = [
      ...(builderInput.answeredLibraryQuestionIds ?? []),
      ...answeredLibraryDeepIds(prior),
    ];
  }

  const built = buildConversationSession(builderInput);
  const ts = nowIso();
  const sessionId = id("csess");

  let title = input.title;
  if (!title && input.babymoonRound) {
    const round = getBabymoonRound(input.babymoonRound);
    title = input.isRepeat
      ? `Babymoon · ${round.title} (repeat)`
      : `Babymoon · ${round.title}`;
  }
  if (!title) title = `${mode.title} conversation`;

  await updateStore(
    (store) => {
      ensureCollections(store);
      const session: ConversationSession = {
        id: sessionId,
        family_id: store.family.id,
        mode: input.mode,
        title,
        planned_minutes: input.plannedMinutes,
        status: "active",
        started_at: ts,
        paused_at: null,
        completed_at: null,
        active_seconds: 0,
        session_tag: input.babymoonRound
          ? `babymoon_set_v1_round_${input.babymoonRound}`
          : mode.session_tag,
        created_by: input.createdBy,
        current_item_index: 0,
        summary: null,
        completed_item_count: null,
        eligible_item_count: null,
        open_followup_count: null,
        is_repeat: input.isRepeat ?? false,
        repeats_session_id: input.repeatsSessionId ?? null,
        created_at: ts,
        updated_at: ts,
      };
      store.conversation_sessions!.push(session);

      for (const item of built) {
        const row: ConversationSessionItem = {
          id: id("citem"),
          session_id: sessionId,
          prompt_id: item.prompt_id,
          source_question_id: item.source_question_id,
          item_type: item.item_type,
          display_order: item.display_order,
          energy: item.energy,
          estimated_time_seconds: item.estimated_time_seconds,
          actual_time_seconds: 0,
          status: "pending",
          opened_at: null,
          answered_at: null,
          paused_duration_seconds: 0,
          branch_context: null,
          created_at: ts,
          updated_at: ts,
        };
        store.conversation_session_items!.push(row);
      }
      return store;
    },
    { operation: "startConversationSession" },
  );

  return {
    sessionId,
    energyMix: describeEnergyMix(built),
    itemCount: built.length,
    resumed: false as const,
    answeredCount: 0,
  };
}

export async function openConversationItem(sessionId: string, itemId: string) {
  // Skip no-op writes — opening the same card again must not hit remote store.
  const preview = await readStore();
  ensureCollections(preview);
  const existing = preview.conversation_session_items?.find(
    (i) => i.id === itemId && i.session_id === sessionId,
  );
  const sessionPreview = preview.conversation_sessions?.find(
    (s) => s.id === sessionId,
  );
  if (
    existing?.opened_at &&
    existing.status !== "pending" &&
    sessionPreview?.current_item_index === existing.display_order &&
    sessionPreview.status === "active"
  ) {
    return { skipped: true as const };
  }

  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const item = store.conversation_session_items!.find(
        (i) => i.id === itemId && i.session_id === sessionId,
      );
      if (!item) return store;
      if (!item.opened_at) item.opened_at = ts;
      if (item.status === "pending") item.status = "opened";
      item.updated_at = ts;
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (session) {
        session.current_item_index = item.display_order;
        session.updated_at = ts;
        if (session.status === "paused") {
          session.status = "active";
          session.paused_at = null;
        }
      }
      return store;
    },
    { operation: "openConversationItem" },
  );
  return { skipped: false as const };
}

export type ConversationAnswerWrite = {
  actor: "sam" | "michelle" | "shared";
  selectedOptions?: string[];
  shortText?: string | null;
  explanation?: string | null;
  scale?: number | null;
};

export async function saveConversationQuickAnswer(input: {
  sessionId: string;
  itemId: string;
  actor: "sam" | "michelle" | "shared";
  selectedOptions?: string[];
  shortText?: string | null;
  explanation?: string | null;
  scale?: number | null;
  status?: ConversationItemStatus;
  mutationId?: string;
}) {
  return saveConversationQuickAnswersBatch({
    sessionId: input.sessionId,
    itemId: input.itemId,
    answers: [
      {
        actor: input.actor,
        selectedOptions: input.selectedOptions,
        shortText: input.shortText,
        explanation: input.explanation,
        scale: input.scale,
      },
    ],
    status: input.status,
    mutationId: input.mutationId,
    advance: false,
  });
}

/**
 * Batch Sam/Michelle/shared writes into one store mutation.
 * Cuts remote round-trips that made “Save and next” feel stuck.
 */
export async function saveConversationQuickAnswersBatch(input: {
  sessionId: string;
  itemId: string;
  answers: ConversationAnswerWrite[];
  status?: ConversationItemStatus;
  mutationId?: string;
  /** Client-asserted prompt id — must match the session item. */
  expectedPromptId?: string;
  /** Persist answers only — do not advance until read-back verification. */
  advance?: boolean;
}): Promise<{
  promptId: string;
  savedAt: string;
  actors: Array<"sam" | "michelle" | "shared">;
  previousIndex: number;
}> {
  if (input.answers.some((a) => a.shortText)) {
    const { validateShortTextLength } = await import("@/lib/qa/validation");
    const preview = await readStore();
    const itemPreview = preview.conversation_session_items?.find(
      (i) => i.id === input.itemId,
    );
    if (itemPreview) {
      for (const answer of input.answers) {
        if (!answer.shortText) continue;
        const valid = validateShortTextLength(
          itemPreview.prompt_id,
          answer.shortText,
        );
        if (!valid.ok) throw new Error(valid.message);
      }
    }
  }

  const ts = nowIso();
  let promptId = "";
  let previousIndex = 0;
  const actors: Array<"sam" | "michelle" | "shared"> = [];

  const preview = await readStore();
  ensureCollections(preview);
  const previewItem = preview.conversation_session_items?.find(
    (i) => i.id === input.itemId && i.session_id === input.sessionId,
  );
  const previewSession = preview.conversation_sessions?.find(
    (s) => s.id === input.sessionId,
  );
  if (!previewItem || !previewSession) {
    throw new Error(
      "Conversation item missing — answer was not saved. Stay on this card and retry.",
    );
  }
  if (
    input.expectedPromptId &&
    previewItem.prompt_id !== input.expectedPromptId
  ) {
    console.info("[stale_payload]", {
      reason: "question_mismatch",
      sessionId: input.sessionId,
      sessionItemId: input.itemId,
      expectedPromptId: input.expectedPromptId,
      actualPromptId: previewItem.prompt_id,
    });
    throw new Error(
      "This answer no longer matches the current question. Reload and retry.",
    );
  }
  promptId = previewItem.prompt_id;
  previousIndex = previewSession.current_item_index;

  await updateStore(
    (store) => {
      ensureCollections(store);
      const item = store.conversation_session_items!.find(
        (i) => i.id === input.itemId && i.session_id === input.sessionId,
      );
      if (!item) {
        throw new Error(
          "Conversation item missing — answer was not saved. Stay on this card and retry.",
        );
      }
      const session = store.conversation_sessions!.find(
        (s) => s.id === input.sessionId,
      );
      if (!session) {
        throw new Error(
          "Conversation session missing — answer was not saved. Stay on this card and retry.",
        );
      }
      const qaTags =
        session.is_test_data && session.test_run_id
          ? {
              is_test_data: true as const,
              test_run_id: session.test_run_id,
              test_case_id: item.test_case_id ?? null,
              source: "qa_test_lab" as const,
            }
          : {};

      for (const answer of input.answers) {
        actors.push(answer.actor);
        const existing = store.conversation_quick_answers!.find(
          (a) =>
            a.session_item_id === input.itemId && a.actor === answer.actor,
        );
        if (existing) {
          existing.selected_options =
            answer.selectedOptions ?? existing.selected_options;
          existing.short_text =
            answer.shortText !== undefined
              ? answer.shortText
              : existing.short_text;
          existing.explanation =
            answer.explanation !== undefined
              ? answer.explanation
              : existing.explanation;
          existing.scale =
            answer.scale !== undefined ? answer.scale : existing.scale;
          existing.updated_at = ts;
          Object.assign(existing, qaTags);
        } else {
          store.conversation_quick_answers!.push({
            id: id("cqans"),
            family_id: store.family.id,
            session_id: input.sessionId,
            session_item_id: input.itemId,
            prompt_id: item.prompt_id,
            actor: answer.actor,
            selected_options: answer.selectedOptions ?? [],
            short_text: answer.shortText ?? null,
            explanation: answer.explanation ?? null,
            scale: answer.scale ?? null,
            created_at: ts,
            updated_at: ts,
            ...qaTags,
          });
        }
      }

      const sam = store.conversation_quick_answers!.find(
        (a) => a.session_item_id === input.itemId && a.actor === "sam",
      );
      const michelle = store.conversation_quick_answers!.find(
        (a) => a.session_item_id === input.itemId && a.actor === "michelle",
      );
      const shared = store.conversation_quick_answers!.find(
        (a) => a.session_item_id === input.itemId && a.actor === "shared",
      );

      let status: ConversationItemStatus = input.status ?? item.status;
      if (input.status) {
        status = input.status;
      } else if (shared && snapshotAnswer(shared)) {
        status = "shared_answer_saved";
      } else if (sam && michelle) {
        status = answersEqual(sam, michelle)
          ? "answered_same"
          : "answered_different";
      } else if (sam || michelle) {
        status = "opened";
      }

      item.status = status;
      item.answered_at = ts;
      item.actual_time_seconds = measureActiveSeconds({
        openedAt: item.opened_at,
        answeredAt: ts,
        pausedDurationSeconds: item.paused_duration_seconds,
      });
      item.updated_at = ts;

      if (status === "answered_different" && sam && michelle) {
        const existingDiff = store.conversation_differences!.find(
          (d) =>
            d.session_id === input.sessionId && d.prompt_id === item.prompt_id,
        );
        if (existingDiff) {
          existingDiff.sam_answer_snapshot = snapshotAnswer(sam);
          existingDiff.michelle_answer_snapshot = snapshotAnswer(michelle);
          existingDiff.updated_at = ts;
        } else {
          store.conversation_differences!.push({
            id: id("cdiff"),
            family_id: store.family.id,
            session_id: input.sessionId,
            prompt_id: item.prompt_id,
            sam_answer_snapshot: snapshotAnswer(sam),
            michelle_answer_snapshot: snapshotAnswer(michelle),
            sam_reason: sam.explanation,
            michelle_reason: michelle.explanation,
            resolution_status: "unreviewed",
            shared_answer_text: null,
            created_at: ts,
            updated_at: ts,
            ...(session.is_test_data && session.test_run_id
              ? {
                  is_test_data: true as const,
                  test_run_id: session.test_run_id,
                  test_case_id: item.test_case_id ?? null,
                  source: "qa_test_lab" as const,
                }
              : {}),
          });
        }
      }

      session.updated_at = ts;
      const items = store.conversation_session_items!.filter(
        (i) => i.session_id === input.sessionId,
      );
      session.active_seconds = items.reduce(
        (sum, i) => sum + i.actual_time_seconds,
        0,
      );
      // Advance is applied only AFTER read-back verification in the action layer.
      void input.advance;
      return store;
    },
    {
      operation: "saveConversationQuickAnswersBatch",
      mutationId: input.mutationId,
    },
  );

  return { promptId, savedAt: ts, actors, previousIndex };
}

export async function advanceConversationItem(
  sessionId: string,
  direction: "next" | "back" | "goto",
  index?: number,
) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (!session) return store;
      const items = store
        .conversation_session_items!.filter((i) => i.session_id === sessionId)
        .sort((a, b) => a.display_order - b.display_order);
      if (!items.length) return store;

      let next = session.current_item_index;
      if (direction === "next") next = Math.min(next + 1, items.length - 1);
      if (direction === "back") next = Math.max(next - 1, 0);
      if (direction === "goto" && typeof index === "number") {
        next = Math.max(0, Math.min(index, items.length - 1));
      }
      session.current_item_index = next;
      session.updated_at = ts;
      return store;
    },
    { operation: "advanceConversationItem" },
  );
}

export async function pauseConversationSession(sessionId: string) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (!session) return store;
      session.status = "paused";
      session.paused_at = ts;
      session.updated_at = ts;
      return store;
    },
    { operation: "pauseConversationSession" },
  );
}

export async function skipConversationItem(
  sessionId: string,
  itemId: string,
  status: "skipped" | "discuss_later" | "undecided",
) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const item = store.conversation_session_items!.find(
        (i) => i.id === itemId && i.session_id === sessionId,
      );
      if (!item) return store;
      item.status = status;
      item.answered_at = ts;
      item.updated_at = ts;
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (session) {
        const items = store
          .conversation_session_items!.filter((i) => i.session_id === sessionId)
          .sort((a, b) => a.display_order - b.display_order);
        const idx = items.findIndex((i) => i.id === itemId);
        if (idx >= 0 && idx < items.length - 1) {
          session.current_item_index = idx + 1;
        }
        session.updated_at = ts;
      }
      return store;
    },
    { operation: "skipConversationItem" },
  );
}

export async function resolveConversationDifference(input: {
  sessionId: string;
  promptId: string;
  resolution: DifferenceResolution;
  samReason?: string | null;
  michelleReason?: string | null;
  sharedAnswerText?: string | null;
}) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const diff = store.conversation_differences!.find(
        (d) =>
          d.session_id === input.sessionId && d.prompt_id === input.promptId,
      );
      if (!diff) return store;
      diff.resolution_status = input.resolution;
      if (input.samReason !== undefined) diff.sam_reason = input.samReason;
      if (input.michelleReason !== undefined) {
        diff.michelle_reason = input.michelleReason;
      }
      if (input.sharedAnswerText !== undefined) {
        diff.shared_answer_text = input.sharedAnswerText;
      }
      diff.updated_at = ts;

      const item = store.conversation_session_items!.find(
        (i) =>
          i.session_id === input.sessionId && i.prompt_id === input.promptId,
      );
      if (item) {
        if (input.resolution === "shared_answer_created") {
          item.status = "shared_answer_saved";
        } else if (input.resolution === "kept_separate") {
          item.status = "answered_different";
        } else if (input.resolution === "discuss_later") {
          item.status = "discuss_later";
        } else if (input.resolution === "opened_deep") {
          item.status = "needs_follow_up";
        }
        item.updated_at = ts;
      }

      if (
        input.resolution === "shared_answer_created" &&
        input.sharedAnswerText
      ) {
        const existingShared = store.conversation_quick_answers!.find(
          (a) =>
            a.session_id === input.sessionId &&
            a.prompt_id === input.promptId &&
            a.actor === "shared",
        );
        if (existingShared) {
          existingShared.short_text = input.sharedAnswerText;
          existingShared.updated_at = ts;
        } else if (item) {
          store.conversation_quick_answers!.push({
            id: id("cqans"),
            family_id: store.family.id,
            session_id: input.sessionId,
            session_item_id: item.id,
            prompt_id: input.promptId,
            actor: "shared",
            selected_options: [],
            short_text: input.sharedAnswerText,
            explanation: null,
            scale: null,
            created_at: ts,
            updated_at: ts,
          });
        }
      }
      return store;
    },
    { operation: "resolveConversationDifference" },
  );
}

export async function completeConversationSession(sessionId: string) {
  const ts = nowIso();
  const { evaluateSessionCompletion, completionPersistedStatus } = await import(
    "@/lib/services/round-status"
  );

  await updateStore(
    (store) => {
      ensureCollections(store);
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (!session) return store;

      const eval_ = evaluateSessionCompletion(store, session);
      const nextStatus = completionPersistedStatus(eval_);

      // Idempotent: do not duplicate summary or reset index on repeat complete.
      if (
        session.status === "completed" ||
        session.status === "completed_with_followups"
      ) {
        session.status = nextStatus;
        session.completed_item_count = eval_.completedItemCount;
        session.eligible_item_count = eval_.eligibleItemCount;
        session.open_followup_count = eval_.openFollowupCount;
        session.updated_at = ts;
        if (!session.completed_at) session.completed_at = ts;
        if (!session.summary) {
          const items = store.conversation_session_items!.filter(
            (i) => i.session_id === sessionId,
          );
          const answers = store.conversation_quick_answers!.filter(
            (a) => a.session_id === sessionId,
          );
          const differences = store.conversation_differences!.filter(
            (d) => d.session_id === sessionId,
          );
          session.summary = buildSessionSummary({
            session,
            items,
            answers,
            differences,
          });
        }
        return store;
      }

      const items = store.conversation_session_items!.filter(
        (i) => i.session_id === sessionId,
      );
      const answers = store.conversation_quick_answers!.filter(
        (a) => a.session_id === sessionId,
      );
      const differences = store.conversation_differences!.filter(
        (d) => d.session_id === sessionId,
      );
      session.summary = buildSessionSummary({
        session,
        items,
        answers,
        differences,
      });
      session.status = nextStatus;
      session.completed_at = ts;
      session.completed_item_count = eval_.completedItemCount;
      session.eligible_item_count = eval_.eligibleItemCount;
      session.open_followup_count = eval_.openFollowupCount;
      session.active_seconds = items.reduce(
        (sum, i) => sum + i.actual_time_seconds,
        0,
      );
      session.updated_at = ts;
      return store;
    },
    { operation: "completeConversationSession" },
  );
}

export async function updateConversationSummary(
  sessionId: string,
  summary: ConversationSessionSummary,
) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (!session) return store;
      session.summary = summary;
      session.updated_at = ts;
      return store;
    },
    { operation: "updateConversationSummary" },
  );
}

export async function appendMomentumPrompt(
  sessionId: string,
  promptId: string,
) {
  const prompt = promptForItem(promptId);
  if (!prompt) throw new Error("Unknown prompt");
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureCollections(store);
      const items = store
        .conversation_session_items!.filter((i) => i.session_id === sessionId)
        .sort((a, b) => a.display_order - b.display_order);
      if (items.some((i) => i.prompt_id === promptId)) return store;
      const order = items.length;
      store.conversation_session_items!.push({
        id: id("citem"),
        session_id: sessionId,
        prompt_id: promptId,
        source_question_id: prompt.follow_up_open_question_id,
        item_type: prompt.response_type,
        display_order: order,
        energy:
          prompt.conversation_energy === "lightning"
            ? "light"
            : prompt.conversation_energy === "coffee"
              ? "medium"
              : prompt.conversation_energy === "planning"
                ? "planning"
                : "deep",
        estimated_time_seconds: prompt.estimated_time_seconds,
        actual_time_seconds: 0,
        status: "pending",
        opened_at: null,
        answered_at: null,
        paused_duration_seconds: 0,
        branch_context: { momentum: true },
        created_at: ts,
        updated_at: ts,
      });
      const session = store.conversation_sessions!.find((s) => s.id === sessionId);
      if (session) {
        session.current_item_index = order;
        session.updated_at = ts;
      }
      return store;
    },
    { operation: "appendMomentumPrompt" },
  );
}

export function getQuickContextForDeep(
  store: AppStore,
  deepQuestionId: string,
): {
  promptId: string;
  prompt: string;
  sam?: string;
  michelle?: string;
} | null {
  ensureCollections(store);
  const answers = (store.conversation_quick_answers ?? []).filter((a) => {
    const prompt = promptForItem(a.prompt_id);
    return prompt?.follow_up_open_question_id === deepQuestionId;
  });
  if (!answers.length) return null;
  const latestSession = answers
    .map((a) => a.session_id)
    .sort()
    .at(-1);
  const scoped = answers.filter((a) => a.session_id === latestSession);
  const promptId = scoped[0]?.prompt_id;
  const prompt = promptId ? promptForItem(promptId) : undefined;
  if (!prompt) return null;
  return {
    promptId: prompt.id,
    prompt: prompt.prompt,
    sam: scoped.find((a) => a.actor === "sam")
      ? snapshotAnswer(scoped.find((a) => a.actor === "sam")!)
      : undefined,
    michelle: scoped.find((a) => a.actor === "michelle")
      ? snapshotAnswer(scoped.find((a) => a.actor === "michelle")!)
      : undefined,
  };
}
