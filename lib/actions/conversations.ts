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
  skipConversationItem,
  startConversationSession,
  updateConversationSummary,
} from "@/lib/services/conversations";
import type {
  ConversationItemStatus,
  ConversationModeId,
  ConversationSessionSummary,
  DifferenceResolution,
} from "@/lib/types/models";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function revalidateConversationPaths(sessionId?: string) {
  revalidatePath("/conversations");
  revalidatePath("/conversations/history");
  if (sessionId) {
    revalidatePath(`/conversations/session/${sessionId}`);
    revalidatePath(`/conversations/session/${sessionId}/summary`);
  }
}

export async function actionStartConversation(input: {
  mode: ConversationModeId;
  plannedMinutes: number;
  babymoonRound?: 1 | 2 | 3;
  title?: string;
}) {
  const ctx = await requireIdentity();
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
  await openConversationItem(sessionId, itemId);
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
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
}) {
  await requireIdentity();
  await saveConversationQuickAnswer(input);
  if (input.advance) {
    await advanceConversationItem(input.sessionId, "next");
  }
  revalidateConversationPaths(input.sessionId);
  return { ok: true as const };
}

export async function actionAdvanceConversation(
  sessionId: string,
  direction: "next" | "back",
) {
  await requireIdentity();
  await advanceConversationItem(sessionId, direction);
  revalidateConversationPaths(sessionId);
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
) {
  await requireIdentity();
  await skipConversationItem(sessionId, itemId, status);
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
}

export async function actionResolveDifference(input: {
  sessionId: string;
  promptId: string;
  resolution: DifferenceResolution;
  samReason?: string | null;
  michelleReason?: string | null;
  sharedAnswerText?: string | null;
}) {
  await requireIdentity();
  await resolveConversationDifference(input);
  revalidateConversationPaths(input.sessionId);
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
  revalidateConversationPaths(sessionId);
  return { ok: true as const };
}
