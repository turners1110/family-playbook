"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import {
  addCustomChecklistTask,
  archiveChecklistTask,
  bulkCompleteChecklistTasks,
  generateBeforeBabySchedule,
  importBeforeBabyTemplate,
  previewBeforeBabyDueDateChange,
  setChecklistTaskCompleted,
  updateBeforeBabySchedulingSettings,
  updateChecklistTask,
} from "@/lib/services/checklists";
import type { ChecklistOwner, ChecklistPriority } from "@/lib/checklists";
import type { FamilySettings } from "@/lib/types/models";
import { logStoreError, publicRemoteStoreMessage } from "@/lib/db/store-errors";
import { canWriteResearch } from "@/lib/research/access";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function assertCanEdit(ctx: Awaited<ReturnType<typeof requireIdentity>>) {
  // Same Sam/Michelle write gate used elsewhere for family edits.
  if (!canWriteResearch(ctx)) {
    throw new Error("Only Sam or Michelle can edit Before Baby scheduling.");
  }
}

function revalidateChecklist() {
  revalidatePath("/before-baby");
  revalidatePath("/before-baby/plan");
  revalidatePath("/settings");
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
  timing?:
    | { mode: "exact"; date: string }
    | { mode: "weeks_before"; weeks: number }
    | { mode: "days_before"; days: number }
    | { mode: "days_after"; days: number }
    | { mode: "none" };
}) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const task = await addCustomChecklistTask(input);
    revalidateChecklist();
    return { ok: true as const, taskId: task.id };
  } catch (error) {
    logStoreError("add_checklist_task", error);
    return {
      ok: false as const,
      error:
        error instanceof Error &&
        (error.message.includes("title") || error.message.includes("Sam"))
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
    manual_timing?:
      | { mode: "exact"; date: string }
      | { mode: "weeks_before"; weeks: number }
      | { mode: "days_before"; days: number }
      | { mode: "days_after"; days: number }
      | { mode: "remove" };
  },
) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    await updateChecklistTask(taskId, patch);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("update_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionArchiveChecklistTask(taskId: string) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    await archiveChecklistTask(taskId);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("archive_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionUpdateBeforeBabyScheduling(
  patch: Partial<FamilySettings>,
  options?: { applySchedule?: boolean; keepManualDates?: boolean },
) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const result = await updateBeforeBabySchedulingSettings(patch, options);
    revalidateChecklist();
    return { ok: true as const, ...result };
  } catch (error) {
    logStoreError("before_baby_scheduling", error);
    return {
      ok: false as const,
      error:
        error instanceof Error && error.message.includes("Sam")
          ? error.message
          : publicRemoteStoreMessage(error),
    };
  }
}

export async function actionPreviewDueDateChange(newDueDate: string) {
  await requireIdentity();
  try {
    const preview = await previewBeforeBabyDueDateChange(newDueDate);
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionGenerateBeforeBabySchedule(force = false) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const result = await generateBeforeBabySchedule({
      forceRecalculateManual: force,
    });
    revalidateChecklist();
    return { ok: true as const, tasksUpdated: result.tasksUpdated };
  } catch (error) {
    logStoreError("generate_before_baby_schedule", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}
