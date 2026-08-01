"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { saveAnswer } from "@/lib/services/answers";
import { readStore, updateStore } from "@/lib/db/store";
import { logStoreError, publicRemoteStoreMessage } from "@/lib/db/store-errors";
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
  await requireIdentity();
  try {
    await saveAnswer(input);
    revalidateEssentials();
    return { ok: true as const };
  } catch (error) {
    logStoreError("essentials_save", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
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
