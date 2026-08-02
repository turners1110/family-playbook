"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { saveAnswer, saveAnswersBatch } from "@/lib/services/answers";
import { readStore, updateStore } from "@/lib/db/store";
import {
  logStoreError,
  publicRemoteStoreMessage,
  RemoteStoreError,
} from "@/lib/db/store-errors";
import type { SaveAnswerInput } from "@/lib/validation/schemas";
import {
  buildSuggestedChecklistTasks,
  collectTaskSuggestions,
} from "@/lib/essentials/task-suggestions";
import { canWriteResearch } from "@/lib/research/access";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function revalidateEssentials() {
  revalidatePath("/questions/before-birth");
  revalidatePath("/questions/before-birth/review");
  revalidatePath("/before-birth");
  revalidatePath("/babymoon");
  revalidatePath("/before-baby");
  revalidatePath("/questions");
}

export async function actionSaveEssentialsAnswer(input: SaveAnswerInput) {
  const started = Date.now();
  await requireIdentity();
  try {
    await saveAnswer(input);
    // Light revalidation — skip dashboard/history churn on every answer write.
    revalidatePath("/questions/before-birth");
    console.info("[save_timing]", {
      operation: "actionSaveEssentialsAnswer",
      questionId: input.question_id,
      durationMs: Date.now() - started,
      result: "success",
      retryCount: 0,
      conflict: false,
      stage: "server_action",
    });
    return { ok: true as const };
  } catch (error) {
    logStoreError("essentials_save", error);
    const conflict =
      error instanceof RemoteStoreError && error.code === "version_conflict";
    console.info("[save_timing]", {
      operation: "actionSaveEssentialsAnswer",
      questionId: input.question_id,
      durationMs: Date.now() - started,
      result: conflict ? "conflict" : "failed",
      retryCount: 0,
      conflict,
      stage: "server_action",
    });
    return {
      ok: false as const,
      error: publicRemoteStoreMessage(error),
      code: conflict ? ("version_conflict" as const) : ("failed" as const),
    };
  }
}

export async function actionSaveEssentialsAnswersBatch(input: {
  answers: SaveAnswerInput[];
  mutationId?: string;
}) {
  const started = Date.now();
  await requireIdentity();
  try {
    await saveAnswersBatch(input.answers, undefined, input.mutationId);
    revalidatePath("/questions/before-birth");
    console.info("[save_timing]", {
      operation: "actionSaveEssentialsAnswersBatch",
      questionId: input.answers[0]?.question_id ?? null,
      durationMs: Date.now() - started,
      result: "success",
      retryCount: 0,
      conflict: false,
      stage: "server_action",
    });
    return { ok: true as const };
  } catch (error) {
    logStoreError("essentials_save_batch", error);
    const conflict =
      error instanceof RemoteStoreError && error.code === "version_conflict";
    console.info("[save_timing]", {
      operation: "actionSaveEssentialsAnswersBatch",
      questionId: input.answers[0]?.question_id ?? null,
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

export async function actionApplyEssentialsTaskSuggestions(
  suggestionIds: string[],
) {
  const ctx = await requireIdentity();
  if (!canWriteResearch(ctx)) {
    return { ok: false as const, error: "Only Sam or Michelle can add tasks." };
  }
  try {
    let added = 0;
    await updateStore((store) => {
      const all = collectTaskSuggestions(store);
      const selected = all.filter((s) => suggestionIds.includes(s.id));
      const instance = store.checklist_instances.find(
        (c) => c.template_slug === "before-baby",
      );
      if (!instance) {
        throw new Error("Import Before Baby checklist before adding suggested tasks.");
      }
      const tasks = buildSuggestedChecklistTasks(instance.id, selected);
      store.checklist_tasks.push(...tasks);
      added = tasks.length;
      return store;
    }, { operation: "applyEssentialsTaskSuggestions" });
    revalidateEssentials();
    return { ok: true as const, added };
  } catch (error) {
    logStoreError("essentials_tasks", error);
    return {
      ok: false as const,
      error:
        error instanceof Error && error.message.includes("Import Before Baby")
          ? error.message
          : publicRemoteStoreMessage(error),
    };
  }
}

export async function actionPreviewEssentialsTasks() {
  await requireIdentity();
  const store = await readStore();
  return {
    ok: true as const,
    suggestions: collectTaskSuggestions(store),
  };
}
