"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import {
  advanceConversationItem,
  appendMomentumPrompt,
  completeConversationSession,
  openConversationItem,
  pauseConversationSession,
  resolveConversationDifference,
  saveConversationQuickAnswer,
  saveConversationQuickAnswersBatch,
  skipConversationItem,
  startConversationSession,
  updateConversationSummary,
  type ConversationAnswerWrite,
} from "@/lib/services/conversations";
import { readStore } from "@/lib/db/store";
import type {
  ConversationItemStatus,
  ConversationModeId,
  ConversationSessionSummary,
  DifferenceResolution,
} from "@/lib/types/models";
import {
  publicRemoteStoreMessage,
  RemoteStoreError,
} from "@/lib/db/store-errors";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function revalidateConversationPaths(sessionId?: string, light = false) {
  if (sessionId) {
    revalidatePath(`/conversations/session/${sessionId}`);
    revalidatePath(`/conversations/test/${sessionId}`);
  }
  if (!light) {
    revalidatePath("/conversations");
    revalidatePath("/conversations/history");
    if (sessionId) {
      revalidatePath(`/conversations/session/${sessionId}/summary`);
    }
  }
}

export async function actionStartConversation(input: {
  mode: ConversationModeId;
  plannedMinutes: number;
  babymoonRound?: 1 | 2 | 3;
  title?: string;
  forceNew?: boolean;
}) {
  const ctx = await requireIdentity();
  const { assertDurableStorageForProductWrites } = await import(
    "@/lib/db/durable-save"
  );
  assertDurableStorageForProductWrites();
  const result = await startConversationSession({
    ...input,
    createdBy: ctx.profile.id,
  });
  revalidateConversationPaths(result.sessionId);
  return result;
}

export async function actionOpenConversationItem(
  sessionId: string,
  itemId: string,
) {
  await requireIdentity();
  const result = await openConversationItem(sessionId, itemId);
  // No revalidation on skipped/no-op opens — avoids full page churn.
  if (!result.skipped) {
    revalidateConversationPaths(sessionId, true);
  }
  return { ok: true as const, skipped: result.skipped };
}

export async function actionSaveConversationAnswer(input: {
  sessionId: string;
  itemId: string;
  actor: "sam" | "michelle" | "shared";
  selectedOptions?: string[];
  shortText?: string | null;
  explanation?: string | null;
  scale?: number | null;
  status?: ConversationItemStatus;
  advance?: boolean;
  mutationId?: string;
}) {
  const started = Date.now();
  try {
    await requireIdentity();
    await saveConversationQuickAnswer(input);
    if (input.advance) {
      await advanceConversationItem(input.sessionId, "next");
    }
    revalidateConversationPaths(input.sessionId, true);
    console.info("[save_timing]", {
      operation: "actionSaveConversationAnswer",
      sessionId: input.sessionId,
      questionId: input.itemId,
      durationMs: Date.now() - started,
      result: "success",
      retryCount: 0,
      conflict: false,
      stage: "server_action",
    });
    return { ok: true as const };
  } catch (error) {
    const conflict =
      error instanceof RemoteStoreError && error.code === "version_conflict";
    console.info("[save_timing]", {
      operation: "actionSaveConversationAnswer",
      sessionId: input.sessionId,
      questionId: input.itemId,
      durationMs: Date.now() - started,
      result: conflict ? "conflict" : "failed",
      retryCount: 0,
      conflict,
      stage: "server_action",
    });
    return {
      ok: false as const,
      error: publicRemoteStoreMessage(error),
      code: error instanceof RemoteStoreError ? error.code : "failed",
    };
  }
}

export async function actionSaveConversationAnswersBatch(input: {
  sessionId: string;
  itemId: string;
  answers: ConversationAnswerWrite[];
  status?: ConversationItemStatus;
  advance?: boolean;
  mutationId?: string;
  testRunId?: string | null;
}) {
  const started = Date.now();
  try {
    await requireIdentity();
    const { assertDurableStorageForProductWrites, answerContentFingerprint, verifyConversationAnswersInStore, hashFamilyId } =
      await import("@/lib/db/durable-save");
    assertDurableStorageForProductWrites();

    const mutationStarted = Date.now();
    const saved = await saveConversationQuickAnswersBatch({
      sessionId: input.sessionId,
      itemId: input.itemId,
      answers: input.answers,
      status: input.status,
      mutationId: input.mutationId,
      advance: false,
    });
    const mutationMs = Date.now() - mutationStarted;

    const verifyStarted = Date.now();
    const store = await readStore();
    const expectations = input.answers.map((a) => ({
      actor: a.actor,
      fingerprint: answerContentFingerprint({
        selectedOptions: a.selectedOptions,
        shortText: a.shortText,
        explanation: a.explanation,
        scale: a.scale,
      }),
    }));
    const verified = verifyConversationAnswersInStore(store, {
      sessionId: input.sessionId,
      itemId: input.itemId,
      promptId: saved.promptId,
      expectations,
    });
    const verificationMs = Date.now() - verifyStarted;

    if (!verified.ok) {
      console.info("[save_timing]", {
        operation: "actionSaveConversationAnswersBatch",
        sessionId: input.sessionId,
        testRunId: input.testRunId ?? null,
        questionId: input.itemId,
        durationMs: Date.now() - started,
        result: "failed",
        retryCount: 0,
        conflict: false,
        stage: "verification",
        verificationReason: verified.reason,
        familyIdHash: hashFamilyId(store.family.id),
      });
      throw new Error(
        "Save could not be verified. Your answer is still on this screen — tap Retry.",
      );
    }

    let advanced = false;
    let currentItemIndex = verified.currentItemIndex;
    if (input.advance) {
      await advanceConversationItem(input.sessionId, "next");
      advanced = true;
      const after = await readStore();
      const session = after.conversation_sessions?.find(
        (s) => s.id === input.sessionId,
      );
      currentItemIndex = session?.current_item_index ?? currentItemIndex;
      if (
        typeof saved.previousIndex === "number" &&
        typeof currentItemIndex === "number" &&
        currentItemIndex <= saved.previousIndex &&
        // last card: index may stay
        true
      ) {
        // Allow staying on last card; only fail if we expected mid-session advance
        const items = (after.conversation_session_items ?? [])
          .filter((i) => i.session_id === input.sessionId)
          .sort((a, b) => a.display_order - b.display_order);
        const idx = items.findIndex((i) => i.id === input.itemId);
        if (idx >= 0 && idx < items.length - 1 && currentItemIndex <= saved.previousIndex) {
          throw new Error(
            "Progress advance could not be verified. Your answer was saved — tap Retry to continue.",
          );
        }
      }
    }

    revalidateConversationPaths(input.sessionId, true);
    const { getStorageMode, getRemoteStoreHealth, usesRemoteJsonStore } =
      await import("@/lib/db/store");
    let version: number | null = null;
    if (usesRemoteJsonStore()) {
      const health = await getRemoteStoreHealth();
      version = health.version;
    }

    console.info("[save_timing]", {
      operation: "actionSaveConversationAnswersBatch",
      sessionId: input.sessionId,
      testRunId: input.testRunId ?? null,
      questionId: input.itemId,
      durationMs: Date.now() - started,
      result: "success",
      retryCount: 0,
      conflict: false,
      stage: "total",
      mutationMs,
      verificationMs,
      verified: true,
      advanced,
      familyIdHash: hashFamilyId(store.family.id),
    });

    return {
      ok: true as const,
      mutationSucceeded: true as const,
      verified: true as const,
      storageMode: getStorageMode(),
      version,
      questionId: saved.promptId,
      sessionId: input.sessionId,
      itemId: input.itemId,
      actors: saved.actors,
      savedAt: saved.savedAt,
      advanced,
      currentItemIndex,
      durationMs: {
        mutation: mutationMs,
        verification: verificationMs,
        total: Date.now() - started,
      },
    };
  } catch (error) {
    const conflict =
      error instanceof RemoteStoreError && error.code === "version_conflict";
    console.info("[save_timing]", {
      operation: "actionSaveConversationAnswersBatch",
      sessionId: input.sessionId,
      testRunId: input.testRunId ?? null,
      questionId: input.itemId,
      durationMs: Date.now() - started,
      result: conflict ? "conflict" : "failed",
      retryCount: 0,
      conflict,
      stage: "server_action",
    });
    const err = new Error(publicRemoteStoreMessage(error));
    if (conflict) (err as Error & { code: string }).code = "version_conflict";
    throw err;
  }
}

export async function actionAdvanceConversation(
  sessionId: string,
  direction: "next" | "back",
) {
  await requireIdentity();
  await advanceConversationItem(sessionId, direction);
  revalidateConversationPaths(sessionId, true);
  return { ok: true as const };
}

export async function actionPauseConversation(sessionId: string) {
  await requireIdentity();
  await pauseConversationSession(sessionId);
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
}

export async function actionSkipConversationItem(
  sessionId: string,
  itemId: string,
  status: "skipped" | "discuss_later" | "undecided",
  mutationId?: string,
) {
  await requireIdentity();
  await skipConversationItem(sessionId, itemId, status);
  void mutationId;
  revalidateConversationPaths(sessionId, true);
  return { ok: true as const };
}

export async function actionResolveDifference(input: {
  sessionId: string;
  promptId: string;
  resolution: DifferenceResolution;
  samReason?: string | null;
  michelleReason?: string | null;
  sharedAnswerText?: string | null;
  mutationId?: string;
}) {
  await requireIdentity();
  await resolveConversationDifference(input);
  revalidateConversationPaths(input.sessionId, true);
  return { ok: true as const };
}

export async function actionCompleteConversation(sessionId: string) {
  await requireIdentity();
  await completeConversationSession(sessionId);
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
}

export async function actionUpdateConversationSummary(
  sessionId: string,
  summary: ConversationSessionSummary,
) {
  await requireIdentity();
  await updateConversationSummary(sessionId, summary);
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
}

export async function actionAppendMomentum(
  sessionId: string,
  promptId: string,
) {
  await requireIdentity();
  await appendMomentumPrompt(sessionId, promptId);
  revalidateConversationPaths(sessionId, true);
  return { ok: true as const };
}
