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
  switchCurrentUser,
} from "@/lib/services/family";
import { savePlaybookSnapshot } from "@/lib/services/playbook";
import type { SaveAnswerInput, CreateSessionInput, SaveDecisionInput } from "@/lib/validation/schemas";
import { aiService } from "@/lib/services/ai";
import { updateStore, id, nowIso } from "@/lib/db/local-store";

export async function actionSaveAnswer(input: SaveAnswerInput) {
  await saveAnswer(input);
  revalidatePath("/home");
  revalidatePath("/questions");
  revalidatePath("/dashboard");
  revalidatePath("/discuss");
  return { ok: true as const };
}

export async function actionCreateSession(input: CreateSessionInput) {
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
  await advanceSession(sessionId, action, note);
  revalidatePath(`/discuss/${sessionId}`);
  revalidatePath("/home");
  return { ok: true as const };
}

export async function actionSaveDecision(input: SaveDecisionInput) {
  await saveDecision(input);
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
  await scheduleReview(input);
  revalidatePath("/home");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function actionToggleBookmark(questionId: string, memberId: string) {
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
  await updateSettings(input);
  revalidatePath("/settings");
  revalidatePath("/playbook");
  return { ok: true as const };
}

export async function actionSwitchUser(userId: string) {
  await switchCurrentUser(userId);
  revalidatePath("/");
  return { ok: true as const };
}

export async function actionSavePlaybook(includeHistory: boolean) {
  const playbook = await savePlaybookSnapshot(includeHistory);
  revalidatePath("/playbook");
  return { id: playbook.id };
}

export async function actionGenerateAiSection(sectionSlug: string, sectionTitle: string) {
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
