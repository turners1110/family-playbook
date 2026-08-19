"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import {
  addCustomChecklistTask,
  archiveChecklistTask,
  assignChecklistTaskOwner,
  bulkAssignChecklistOwners,
  bulkCompleteChecklistTasks,
  generateBeforeBabySchedule,
  getBeforeBabyChecklist,
  importAfterBirthTemplate,
  importBeforeBabyTemplate,
  previewActualBirthDate,
  previewBeforeBabyDueDateChange,
  setActualBirthDate,
  setChecklistTaskCompleted,
  setTaskDependencyOverride,
  updateBeforeBabySchedulingSettings,
  updateChecklistTask,
} from "@/lib/services/checklists";
import type { ChecklistOwner, ChecklistPriority } from "@/lib/checklists";
import type { ChecklistOwnershipSource, FamilySettings } from "@/lib/types/models";
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
  revalidatePath("/before-baby/assign");
  revalidatePath("/after-birth");
  revalidatePath("/settings");
  revalidatePath("/settings/content-upgrade");
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
    const result = await setChecklistTaskCompleted(taskId, completed);
    revalidateChecklist();
    const { tasks } = await getBeforeBabyChecklist();
    return { ok: true as const, task: result, tasks };
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
    const { tasks } = await getBeforeBabyChecklist();
    return { ok: true as const, count, tasks };
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
  relative_timing_preset?: import("@/lib/types/models").ChecklistRelativeTimingPreset | null;
  choose_date?: string | null;
  estimated_minutes?: number | null;
  inbox?: boolean;
  source?: string | null;
  created_from_label?: string | null;
  linked_question_ids?: string[];
  linked_conversation_ids?: string[];
  linked_research_ids?: string[];
  linked_book_ids?: string[];
  subtasks?: Array<{ title: string; completed?: boolean }>;
  recurrence?: import("@/lib/types/models").ChecklistRecurrence | null;
}) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const task = await addCustomChecklistTask({
      ...input,
      created_by: ctx.profile.id,
    });
    revalidateChecklist();
    return { ok: true as const, taskId: task.id, task };
  } catch (error) {
    logStoreError("add_checklist_task", error);
    return {
      ok: false as const,
      error:
        error instanceof Error &&
        (error.message.includes("title") ||
          error.message.includes("Sam") ||
          error.message.includes("due date"))
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
    category?: string;
    category_label?: string;
    inbox?: boolean;
    estimated_minutes?: number | null;
    relative_timing_preset?: import("@/lib/types/models").ChecklistRelativeTimingPreset | null;
    choose_date?: string | null;
    subtasks?: Array<{ id: string; title: string; completed: boolean }>;
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
    const updated = await updateChecklistTask(taskId, patch);
    revalidateChecklist();
    const { tasks } = await getBeforeBabyChecklist();
    return { ok: true as const, task: updated, tasks };
  } catch (error) {
    logStoreError("update_checklist_task", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function getBeforeBabyChecklistIdAction() {
  try {
    await requireIdentity();
    const { importBeforeBabyTemplate, getBeforeBabyChecklist } = await import(
      "@/lib/services/checklists"
    );
    await importBeforeBabyTemplate();
    const data = await getBeforeBabyChecklist();
    if (!data.instance) {
      return { ok: false as const, error: "Checklist not available yet." };
    }
    return {
      ok: true as const,
      checklistId: data.instance.id,
      tasks: data.tasks,
      dueDate: data.settings.expected_due_date ?? null,
    };
  } catch (error) {
    logStoreError("before_baby_checklist_id", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionArchiveChecklistTask(taskId: string) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    await archiveChecklistTask(taskId);
    revalidateChecklist();
    const { tasks } = await getBeforeBabyChecklist();
    return { ok: true as const, taskId, tasks };
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
    return {
      ok: true as const,
      tasksUpdated: result.tasksUpdated,
      tasks: result.tasks,
    };
  } catch (error) {
    logStoreError("generate_before_baby_schedule", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionImportAfterBirth() {
  await requireIdentity();
  try {
    const result = await importAfterBirthTemplate();
    revalidateChecklist();
    return { ok: true as const, ...result };
  } catch (error) {
    logStoreError("import_after_birth", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionAssignChecklistOwner(
  taskId: string,
  owner: ChecklistOwner | "decide_later",
  source: ChecklistOwnershipSource = "explicit",
) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    await assignChecklistTaskOwner(taskId, owner, { source });
    revalidateChecklist();
    const { tasks } = await getBeforeBabyChecklist();
    return { ok: true as const, tasks };
  } catch (error) {
    logStoreError("assign_checklist_owner", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionBulkAssignOwners(input: {
  taskIds?: string[];
  category?: string;
  owner: ChecklistOwner;
  onlyUnassigned?: boolean;
  applySuggestions?: boolean;
}) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const count = await bulkAssignChecklistOwners(input);
    revalidateChecklist();
    return { ok: true as const, count };
  } catch (error) {
    logStoreError("bulk_assign_owners", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionSetDependencyOverride(
  taskId: string,
  override: boolean,
) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    await setTaskDependencyOverride(taskId, override);
    revalidateChecklist();
    return { ok: true as const };
  } catch (error) {
    logStoreError("dependency_override", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionPreviewActualBirthDate(birthDate: string) {
  await requireIdentity();
  try {
    const preview = await previewActualBirthDate(birthDate);
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionSetActualBirthDate(
  birthDate: string | null,
  apply = true,
) {
  const ctx = await requireIdentity();
  try {
    assertCanEdit(ctx);
    const result = await setActualBirthDate(birthDate, { apply });
    revalidateChecklist();
    return { ok: true as const, ...result };
  } catch (error) {
    logStoreError("set_actual_birth_date", error);
    return { ok: false as const, error: publicRemoteStoreMessage(error) };
  }
}
