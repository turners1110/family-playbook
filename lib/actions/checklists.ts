"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import {
  addCustomChecklistTask,
  archiveChecklistTask,
  bulkCompleteChecklistTasks,
  importBeforeBabyTemplate,
  setChecklistTaskCompleted,
  updateChecklistTask,
} from "@/lib/services/checklists";
import type { ChecklistOwner, ChecklistPriority } from "@/lib/checklists";
import { logStoreError, publicRemoteStoreMessage } from "@/lib/db/store-errors";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function revalidateChecklist() {
  revalidatePath("/before-baby");
  revalidatePath("/home");
}

export async function actionImportBeforeBaby() {
  await requireIdentity();
  try {
    const result = await importBeforeBabyTemplate();
    revalidateChecklist();
    return { ok: true as const, ...result };
  } catch (error) {
    logStoreError("import_before_baby", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionToggleChecklistTask(
  taskId: string,
  completed: boolean,
) {
  await requireIdentity();
  try {
    await setChecklistTaskCompleted(taskId, completed);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("toggle_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionBulkCompleteChecklistTasks(
  taskIds: string[],
  completed: boolean,
) {
  await requireIdentity();
  try {
    const count = await bulkCompleteChecklistTasks(taskIds, completed);
    revalidateChecklist();
    return { ok: true as const, count };
  } catch (error) {
    logStoreError("bulk_checklist", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionAddCustomChecklistTask(input: {
  checklistId: string;
  title: string;
  notes?: string | null;
  due_date?: string | null;
  owner?: ChecklistOwner;
  category?: string;
  category_label?: string;
  priority?: ChecklistPriority;
}) {
  await requireIdentity();
  try {
    const task = await addCustomChecklistTask(input);
    revalidateChecklist();
    return { ok: true as const, taskId: task.id };
  } catch (error) {
    logStoreError("add_checklist_task", error);
    return {
      ok: false as const,
      error:
        error instanceof Error && error.message.includes("title")
          ? error.message
          : publicRemoteStoreMessage(error),
    };
  }
}

export async function actionUpdateChecklistTask(
  taskId: string,
  patch: {
    title?: string;
    notes?: string | null;
    due_date?: string | null;
    owner?: ChecklistOwner;
    priority?: ChecklistPriority;
  },
) {
  await requireIdentity();
  try {
    await updateChecklistTask(taskId, patch);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("update_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionArchiveChecklistTask(taskId: string) {
  await requireIdentity();
  try {
    await archiveChecklistTask(taskId);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("archive_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}
