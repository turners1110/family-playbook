"use server";

import { revalidatePath } from "next/cache";
import { saveAnswer } from "@/lib/services/answers";
import { createSession, advanceSession } from "@/lib/services/sessions";
import { saveDecision } from "@/lib/services/decisions";
import {
  startCoolingOff,
  scheduleReview,
  toggleBookmark,
  updateSettings,
} from "@/lib/services/family";
import { savePlaybookSnapshot } from "@/lib/services/playbook";
import type { SaveAnswerInput, CreateSessionInput, SaveDecisionInput } from "@/lib/validation/schemas";
import { aiService } from "@/lib/services/ai";
import { updateStore, id, nowIso } from "@/lib/db/store";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { publicRemoteStoreMessage, logStoreError, RemoteStoreError } from "@/lib/db/store-errors";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function toActionError(error: unknown): {
  ok: false;
  error: string;
  code?: string;
} {
  logStoreError("action", error);
  const code =
    error instanceof RemoteStoreError ? error.code : undefined;
  return {
    ok: false,
    error: publicRemoteStoreMessage(error),
    code,
  };
}

export async function actionSaveAnswer(input: SaveAnswerInput) {
  await requireIdentity();
  try {
    await saveAnswer(input);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/home");
  revalidatePath("/questions");
  revalidatePath("/dashboard");
  revalidatePath("/discuss");
  return { ok: true as const };
}

export async function actionCreateSession(input: CreateSessionInput) {
  await requireIdentity();
  const sessionId = await createSession(input);
  revalidatePath("/discuss");
  revalidatePath("/home");
  return { sessionId };
}

export async function actionAdvanceSession(
  sessionId: string,
  action: "answered" | "skipped" | "pause" | "complete",
  note?: string,
) {
  await requireIdentity();
  await advanceSession(sessionId, action, note);
  revalidatePath(`/discuss/${sessionId}`);
  revalidatePath("/home");
  return { ok: true as const };
}

export async function actionSaveDecision(input: SaveDecisionInput) {
  await requireIdentity();
  try {
    await saveDecision(input);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/decisions");
  revalidatePath("/playbook");
  revalidatePath("/dashboard");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function actionStartCoolingOff(input: {
  question_id?: string | null;
  decision_id?: string | null;
  wait_days: number;
  reason: string;
  notes?: string | null;
}) {
  await requireIdentity();
  await startCoolingOff(input);
  revalidatePath("/home");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function actionScheduleReview(input: {
  entity_type: "question" | "answer" | "decision" | "outcome" | "principle";
  entity_id: string;
  review_date: string;
  reason?: string;
}) {
  await requireIdentity();
  await scheduleReview(input);
  revalidatePath("/home");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function actionToggleBookmark(questionId: string, memberId: string) {
  await requireIdentity();
  await toggleBookmark(questionId, memberId);
  revalidatePath("/questions");
  return { ok: true as const };
}

export async function actionUpdateSettings(input: {
  hide_partner_answers_until_both_saved?: boolean;
  dark_mode?: "system" | "light" | "dark";
  babymoon_target_date?: string | null;
  babymoon_daily_questions?: number;
  include_perspective_history_in_playbook?: boolean;
}) {
  await requireIdentity();
  await updateSettings(input);
  revalidatePath("/settings");
  revalidatePath("/playbook");
  return { ok: true as const };
}

export async function actionSavePlaybook(includeHistory: boolean) {
  await requireIdentity();
  const playbook = await savePlaybookSnapshot(includeHistory);
  revalidatePath("/playbook");
  return { id: playbook.id };
}

export async function actionGenerateAiSection(sectionSlug: string, sectionTitle: string) {
  await requireIdentity();
  const result = await aiService.generateSection({
    sectionSlug,
    sectionTitle,
    decisions: [],
    outcomes: [],
    openQuestions: [],
    principles: [],
  });
  await updateStore((store) => {
    store.ai_outputs.unshift({
      id: id("ai"),
      family_id: store.family.id,
      purpose: `playbook:${sectionSlug}`,
      prompt: result.prompt,
      output: result.output,
      approved: false,
      model: result.model,
      created_at: nowIso(),
    });
    return store;
  });
  revalidatePath("/playbook");
  return result;
}
