import { id, nowIso, readStore, updateStore } from "@/lib/db/store";
import {
  BEFORE_BABY_TEMPLATE,
  countTemplateTasks,
  getChecklistTemplate,
  type ChecklistOwner,
  type ChecklistPriority,
} from "@/lib/checklists";
import "@/lib/checklists/templates/after-birth";
import { AFTER_BIRTH_TEMPLATE } from "@/lib/checklists/templates/after-birth";
import { getDefaultTimingForTask } from "@/lib/checklists/default-timing";
import { TEMPLATE_DEPENDENCIES, applyDependencyState } from "@/lib/checklists/dependencies";
import { ownershipForSlug } from "@/lib/checklists/ownership";
import {
  applyScheduleToTasks,
  ensureTaskTimingFields,
  normalizeSchedulingSettings,
  previewActualBirthDateChange,
  previewDueDateChange,
  setManualTaskTiming,
} from "@/lib/checklists/scheduling";
import type {
  AppStore,
  ChecklistInstance,
  ChecklistOwnershipSource,
  ChecklistTask,
  FamilySettings,
} from "@/lib/types/models";
import { computePregnancyProgress } from "@/lib/checklists/date-math";

const HOUSE_RESET_SUBTASKS = [
  "Dishes",
  "Trash",
  "Laundry",
  "Clean sheets",
  "Bathroom supplies",
  "Pet supplies",
  "Essential groceries",
];

function ensureCollections(store: AppStore) {
  if (!Array.isArray(store.checklist_instances)) store.checklist_instances = [];
  if (!Array.isArray(store.checklist_tasks)) store.checklist_tasks = [];
  normalizeFamilySchedulingSettings(store.settings);
}

function normalizeFamilySchedulingSettings(settings: FamilySettings) {
  const defaults = normalizeSchedulingSettings(settings);
  settings.expected_due_date =
    settings.expected_due_date ?? defaults.expected_due_date;
  settings.actual_birth_date =
    settings.actual_birth_date ?? defaults.actual_birth_date;
  settings.before_baby_scheduling_mode =
    settings.before_baby_scheduling_mode ?? defaults.before_baby_scheduling_mode;
  settings.before_baby_preferred_task_days =
    settings.before_baby_preferred_task_days ??
    defaults.before_baby_preferred_task_days;
  settings.before_baby_max_tasks_per_week =
    settings.before_baby_max_tasks_per_week ??
    defaults.before_baby_max_tasks_per_week;
  settings.before_baby_weekend_heavy =
    settings.before_baby_weekend_heavy ?? defaults.before_baby_weekend_heavy;
  settings.before_baby_include_post_birth =
    settings.before_baby_include_post_birth ??
    defaults.before_baby_include_post_birth;
  settings.before_baby_hide_completed =
    settings.before_baby_hide_completed ?? defaults.before_baby_hide_completed;
  settings.before_baby_avoid_travel_dates =
    settings.before_baby_avoid_travel_dates ??
    defaults.before_baby_avoid_travel_dates;
}

function timingFieldsFromTemplate(
  templateSlug: string | null,
  category: string,
): Pick<
  ChecklistTask,
  | "recommended_start_offset_days"
  | "recommended_due_offset_days"
  | "recommended_target_offset_days"
  | "hard_deadline_offset_days"
  | "timing_reason"
  | "timing_flexibility"
  | "timing_type"
  | "timing_window_label"
  | "provider_confirmation_needed"
  | "task_tags"
  | "depends_on_template_slugs"
  | "manual_due_date"
  | "calculated_due_date"
  | "calculated_start_date"
  | "date_source"
> {
  const timing = getDefaultTimingForTask(templateSlug, category);
  return {
    recommended_start_offset_days: timing.recommended_start_offset_days,
    recommended_due_offset_days: timing.recommended_due_offset_days,
    recommended_target_offset_days: timing.recommended_due_offset_days,
    hard_deadline_offset_days: timing.hard_deadline_offset_days,
    timing_reason: timing.timing_reason,
    timing_flexibility: timing.timing_flexibility,
    timing_type: timing.timing_type,
    timing_window_label: timing.timing_window_label ?? null,
    provider_confirmation_needed: Boolean(timing.confirm_with_provider),
    task_tags: timing.task_tags ?? [],
    depends_on_template_slugs: templateSlug
      ? TEMPLATE_DEPENDENCIES[templateSlug] ?? []
      : [],
    manual_due_date: null,
    calculated_due_date: null,
    calculated_start_date: null,
    date_source: "none",
  };
}

function houseResetSubtasks(slug: string | null) {
  if (slug !== "home_extra_3") return undefined;
  return HOUSE_RESET_SUBTASKS.map((title, i) => ({
    id: `sub_${slug}_${i + 1}`,
    title,
    completed: false,
  }));
}

export function buildTasksFromTemplate(
  checklistId: string,
  templateSlug: string,
  existingSlugs: Set<string>,
): ChecklistTask[] {
  const template = getChecklistTemplate(templateSlug);
  if (!template) return [];

  const ts = nowIso();
  const tasks: ChecklistTask[] = [];

  for (const section of template.sections) {
    section.tasks.forEach((def, index) => {
      if (existingSlugs.has(def.slug)) return;
      const suggestion = ownershipForSlug(def.slug);
      tasks.push({
        id: id("ctask"),
        checklist_id: checklistId,
        template_task_slug: def.slug,
        title: def.title,
        category: section.slug,
        category_label: section.label,
        completed: false,
        completed_at: null,
        due_date: null,
        priority: def.priority ?? "medium",
        owner:
          def.owner ??
          suggestion?.primary_owner ??
          "both",
        contributor: suggestion?.contributor ?? null,
        joint_approval_required: suggestion?.joint_approval_required ?? false,
        ownership_source: suggestion ? "suggested" : "default",
        ownership_updated_at: ts,
        notes: null,
        is_custom: false,
        is_default: true,
        archived: false,
        sort_order: section.sort_order * 1000 + index + 1,
        created_at: ts,
        updated_at: ts,
        subtasks: houseResetSubtasks(def.slug),
        ...timingFieldsFromTemplate(def.slug, section.slug),
      });
    });
  }

  return applyDependencyState(tasks);
}

function backfillTaskTiming(store: AppStore) {
  for (const task of store.checklist_tasks) {
    if (task.archived) continue;
    const ensured = ensureTaskTimingFields(task);
    Object.assign(task, ensured);
  }
}

function enrichChecklistTasks(tasks: ChecklistTask[]): ChecklistTask[] {
  return applyDependencyState(tasks.map((t) => ensureTaskTimingFields(t))).sort(
    (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title),
  );
}

export async function getBeforeBabyChecklist(): Promise<{
  instance: ChecklistInstance | null;
  tasks: ChecklistTask[];
  templateTaskCount: number;
  settings: FamilySettings;
  pregnancy: ReturnType<typeof computePregnancyProgress> | null;
}> {
  const store = await readStore();
  ensureCollections(store);
  backfillTaskTiming(store);
  const instance =
    store.checklist_instances.find((c) => c.template_slug === "before-baby") ??
    null;
  const tasks = instance
    ? enrichChecklistTasks(
        store.checklist_tasks.filter(
          (t) => t.checklist_id === instance.id && !t.archived,
        ),
      )
    : [];
  const due = store.settings.expected_due_date;
  return {
    instance,
    tasks,
    templateTaskCount: countTemplateTasks(BEFORE_BABY_TEMPLATE),
    settings: store.settings,
    pregnancy: due ? computePregnancyProgress(due) : null,
  };
}

export async function getAfterBirthChecklist(): Promise<{
  instance: ChecklistInstance | null;
  tasks: ChecklistTask[];
  templateTaskCount: number;
  settings: FamilySettings;
}> {
  const store = await readStore();
  ensureCollections(store);
  backfillTaskTiming(store);
  const instance =
    store.checklist_instances.find((c) => c.template_slug === "after-birth") ??
    null;
  const tasks = instance
    ? enrichChecklistTasks(
        store.checklist_tasks.filter(
          (t) => t.checklist_id === instance.id && !t.archived,
        ),
      )
    : [];
  return {
    instance,
    tasks,
    templateTaskCount: countTemplateTasks(AFTER_BIRTH_TEMPLATE),
    settings: store.settings,
  };
}

/** Import First Month template tasks without overwriting existing rows. */
export async function importAfterBirthTemplate(): Promise<{
  checklistId: string;
  added: number;
  totalDefaults: number;
}> {
  const template = AFTER_BIRTH_TEMPLATE;
  const totalDefaults = countTemplateTasks(template);
  let added = 0;
  let checklistId = "";

  await updateStore((store) => {
    ensureCollections(store);
    const ts = nowIso();
    let instance = store.checklist_instances.find(
      (c) => c.template_slug === template.slug,
    );
    if (!instance) {
      instance = {
        id: id("clist"),
        family_id: store.family.id,
        template_slug: template.slug,
        title: template.title,
        description: template.description,
        created_at: ts,
        updated_at: ts,
      };
      store.checklist_instances.push(instance);
    } else {
      instance.updated_at = ts;
    }
    checklistId = instance.id;
    const existingSlugs = new Set(
      store.checklist_tasks
        .filter(
          (t) =>
            t.checklist_id === instance!.id &&
            Boolean(t.template_task_slug) &&
            !t.is_custom,
        )
        .map((t) => t.template_task_slug as string),
    );
    let fresh = buildTasksFromTemplate(instance.id, template.slug, existingSlugs);
    if (store.settings.expected_due_date || store.settings.actual_birth_date) {
      fresh = applyScheduleToTasks(fresh, store.settings);
    }
    added = fresh.length;
    store.checklist_tasks.push(...fresh);
    return store;
  }, { operation: "importAfterBirthTemplate" });

  return { checklistId, added, totalDefaults };
}

export async function assignChecklistTaskOwner(
  taskId: string,
  owner: ChecklistOwner | "decide_later",
  options?: { source?: ChecklistOwnershipSource; contributor?: ChecklistOwner | null },
): Promise<ChecklistTask | null> {
  let updated: ChecklistTask | null = null;
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task || task.archived) return store;
    const ts = nowIso();
    if (owner === "decide_later") {
      task.ownership_source = "decide_later";
      task.ownership_updated_at = ts;
    } else {
      task.owner = owner;
      task.contributor =
        options?.contributor !== undefined
          ? options.contributor
          : owner === "both"
            ? null
            : owner === "sam"
              ? "michelle"
              : "sam";
      task.ownership_source = options?.source ?? "explicit";
      task.ownership_updated_at = ts;
    }
    task.updated_at = ts;
    updated = { ...task };
    return store;
  }, { operation: "assignChecklistTaskOwner" });
  return updated;
}

export async function bulkAssignChecklistOwners(input: {
  taskIds?: string[];
  category?: string;
  owner: ChecklistOwner;
  onlyUnassigned?: boolean;
  skipCompleted?: boolean;
  applySuggestions?: boolean;
}): Promise<number> {
  let count = 0;
  await updateStore((store) => {
    ensureCollections(store);
    const ts = nowIso();
    const idSet = input.taskIds ? new Set(input.taskIds) : null;
    for (const task of store.checklist_tasks) {
      if (task.archived) continue;
      if (idSet && !idSet.has(task.id)) continue;
      if (input.category && task.category !== input.category) continue;
      if (input.skipCompleted !== false && task.completed) continue;
      if (
        input.onlyUnassigned &&
        task.ownership_source &&
        task.ownership_source !== "default" &&
        task.ownership_source !== "decide_later" &&
        !(task.owner === "both" && task.ownership_source === "suggested")
      ) {
        // Keep explicit user choices
        if (task.ownership_source === "explicit" || task.ownership_source === "bulk") {
          continue;
        }
      }
      if (input.applySuggestions) {
        const suggestion = ownershipForSlug(task.template_task_slug);
        if (!suggestion) continue;
        if (
          task.ownership_source === "explicit" ||
          task.ownership_source === "bulk"
        ) {
          continue;
        }
        task.owner = suggestion.primary_owner;
        task.contributor = suggestion.contributor;
        task.joint_approval_required = suggestion.joint_approval_required;
        task.ownership_source = "suggested";
      } else {
        if (
          task.ownership_source === "explicit" &&
          input.onlyUnassigned
        ) {
          continue;
        }
        task.owner = input.owner;
        task.contributor =
          input.owner === "both"
            ? null
            : input.owner === "sam"
              ? "michelle"
              : "sam";
        task.ownership_source = "bulk";
      }
      task.ownership_updated_at = ts;
      task.updated_at = ts;
      count += 1;
    }
    return store;
  }, { operation: "bulkAssignChecklistOwners" });
  return count;
}

export async function setTaskDependencyOverride(
  taskId: string,
  override: boolean,
): Promise<ChecklistTask | null> {
  let updated: ChecklistTask | null = null;
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task || task.archived) return store;
    task.dependency_override = override;
    task.updated_at = nowIso();
    const siblings = store.checklist_tasks.filter(
      (t) => t.checklist_id === task.checklist_id,
    );
    const enriched = applyDependencyState(siblings);
    for (const next of enriched) {
      const live = store.checklist_tasks.find((t) => t.id === next.id);
      if (!live) continue;
      live.depends_on_task_ids = next.depends_on_task_ids;
      live.blocked_by_count = next.blocked_by_count;
      live.dependency_status = next.dependency_status;
      live.dependency_reason = next.dependency_reason;
      live.dependency_override = next.dependency_override;
    }
    updated = { ...(store.checklist_tasks.find((t) => t.id === taskId) as ChecklistTask) };
    return store;
  }, { operation: "setTaskDependencyOverride" });
  return updated;
}

export async function setActualBirthDate(
  birthDate: string | null,
  options?: { apply?: boolean },
): Promise<{
  settings: FamilySettings;
  preview: ReturnType<typeof previewActualBirthDateChange> | null;
  tasksUpdated: number;
}> {
  let settings!: FamilySettings;
  let preview: ReturnType<typeof previewActualBirthDateChange> | null = null;
  let tasksUpdated = 0;

  await updateStore((store) => {
    ensureCollections(store);
    const allTasks = store.checklist_tasks.filter((t) => !t.archived);
    if (birthDate) {
      preview = previewActualBirthDateChange(allTasks, store.settings, birthDate);
    }
    store.settings.actual_birth_date = birthDate;
    store.settings.updated_at = nowIso();
    settings = { ...store.settings };

    if (options?.apply !== false && birthDate) {
      const byChecklist = new Map<string, ChecklistTask[]>();
      for (const t of allTasks) {
        if (!byChecklist.has(t.checklist_id)) byChecklist.set(t.checklist_id, []);
        byChecklist.get(t.checklist_id)!.push(t);
      }
      for (const group of byChecklist.values()) {
        const scheduled = applyScheduleToTasks(group, store.settings);
        for (const next of scheduled) {
          const live = store.checklist_tasks.find((t) => t.id === next.id);
          if (!live) continue;
          if (live.timing_type !== "after_birth") continue;
          if (live.completed) continue;
          if (live.date_source === "manual" || live.manual_due_date) continue;
          const changed = live.due_date !== next.due_date;
          Object.assign(live, {
            calculated_due_date: next.calculated_due_date,
            calculated_start_date: next.calculated_start_date,
            due_date: next.due_date,
            date_source: next.date_source,
            date_estimated: next.date_estimated,
            updated_at: nowIso(),
          });
          if (changed) tasksUpdated += 1;
        }
      }
    }
    return store;
  }, { operation: "setActualBirthDate" });

  return { settings, preview, tasksUpdated };
}

export async function previewActualBirthDate(birthDate: string) {
  const store = await readStore();
  ensureCollections(store);
  const tasks = store.checklist_tasks
    .filter((t) => !t.archived)
    .map((t) => ensureTaskTimingFields(t));
  return previewActualBirthDateChange(tasks, store.settings, birthDate);
}

/** Import default Before Baby tasks without overwriting existing custom or default rows. */
export async function importBeforeBabyTemplate(): Promise<{
  checklistId: string;
  added: number;
  totalDefaults: number;
}> {
  const template = BEFORE_BABY_TEMPLATE;
  const totalDefaults = countTemplateTasks(template);
  let added = 0;
  let checklistId = "";

  await updateStore((store) => {
    ensureCollections(store);
    const ts = nowIso();
    let instance = store.checklist_instances.find(
      (c) => c.template_slug === template.slug,
    );

    if (!instance) {
      instance = {
        id: id("clist"),
        family_id: store.family.id,
        template_slug: template.slug,
        title: template.title,
        description: template.description,
        created_at: ts,
        updated_at: ts,
      };
      store.checklist_instances.push(instance);
    } else {
      instance.updated_at = ts;
    }

    checklistId = instance.id;
    const existingSlugs = new Set(
      store.checklist_tasks
        .filter(
          (t) =>
            t.checklist_id === instance!.id &&
            Boolean(t.template_task_slug) &&
            !t.is_custom,
        )
        .map((t) => t.template_task_slug as string),
    );

    const fresh = buildTasksFromTemplate(
      instance.id,
      template.slug,
      existingSlugs,
    );
    added = fresh.length;
    store.checklist_tasks.push(...fresh);
    return store;
  }, { operation: "ensureBeforeBabyChecklist" });

  return { checklistId, added, totalDefaults };
}

export async function addCustomChecklistTask(input: {
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
}): Promise<ChecklistTask> {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");

  let created!: ChecklistTask;
  await updateStore((store) => {
    ensureCollections(store);
    const instance = store.checklist_instances.find((c) => c.id === input.checklistId);
    if (!instance) throw new Error("Checklist not found.");

    const ts = nowIso();
    const maxSort = store.checklist_tasks
      .filter((t) => t.checklist_id === instance.id)
      .reduce((max, t) => Math.max(max, t.sort_order), 0);

    let task: ChecklistTask = {
      id: id("ctask"),
      checklist_id: instance.id,
      template_task_slug: null,
      title,
      category: input.category?.trim() || "custom",
      category_label: input.category_label?.trim() || "Custom",
      completed: false,
      completed_at: null,
      due_date: input.due_date || null,
      priority: input.priority ?? "medium",
      owner: input.owner ?? "both",
      notes: input.notes?.trim() || null,
      is_custom: true,
      is_default: false,
      archived: false,
      sort_order: maxSort + 1,
      created_at: ts,
      updated_at: ts,
      ...timingFieldsFromTemplate(null, "custom"),
    };

        const due = store.settings.expected_due_date ?? null;
    if (input.timing && input.timing.mode !== "none") {
      task = setManualTaskTiming(
        task,
        input.timing.mode === "exact"
          ? { mode: "exact", date: input.timing.date }
          : input.timing,
        due,
      );
    } else if (input.due_date) {
      task.manual_due_date = input.due_date;
      task.due_date = input.due_date;
      task.date_source = "manual";
      task.timing_type = "exact_date";
    } else if (due && store.settings.before_baby_scheduling_mode !== "manual_only") {
      const scheduled = applyScheduleToTasks([task], store.settings)[0];
      task = scheduled;
    }

    created = task;
    store.checklist_tasks.push(created);
    instance.updated_at = ts;
    return store;
  }, { operation: "addCustomChecklistTask" });
  return created;
}

export async function setChecklistTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<ChecklistTask | null> {
  let updated: ChecklistTask | null = null;
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task || task.archived) return store;
    const ts = nowIso();
    task.completed = completed;
    task.completed_at = completed ? ts : null;
    task.updated_at = ts;
    updated = { ...task };
    return store;
  }, { operation: "setChecklistTaskCompleted" });
  return updated;
}

export async function bulkCompleteChecklistTasks(
  taskIds: string[],
  completed: boolean,
): Promise<number> {
  const idSet = new Set(taskIds);
  let count = 0;
  await updateStore((store) => {
    ensureCollections(store);
    const ts = nowIso();
    for (const task of store.checklist_tasks) {
      if (!idSet.has(task.id) || task.archived) continue;
      if (task.completed === completed) continue;
      task.completed = completed;
      task.completed_at = completed ? ts : null;
      task.updated_at = ts;
      count += 1;
    }
    return store;
  }, { operation: "bulkCompleteChecklistTasks" });
  return count;
}

export async function updateChecklistTask(
  taskId: string,
  patch: Partial<{
    title: string;
    notes: string | null;
    due_date: string | null;
    owner: ChecklistOwner;
    priority: ChecklistPriority;
    category: string;
    category_label: string;
    manual_timing:
      | { mode: "exact"; date: string }
      | { mode: "weeks_before"; weeks: number }
      | { mode: "days_before"; days: number }
      | { mode: "days_after"; days: number }
      | { mode: "remove" };
  }>,
): Promise<ChecklistTask | null> {
  let updated: ChecklistTask | null = null;
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task || task.archived) return store;
    if (patch.title != null) task.title = patch.title.trim() || task.title;
    if (patch.notes !== undefined) task.notes = patch.notes?.trim() || null;
    if (patch.owner) task.owner = patch.owner;
    if (patch.priority) task.priority = patch.priority;
    if (patch.category) task.category = patch.category;
    if (patch.category_label) task.category_label = patch.category_label;

    if (patch.manual_timing) {
      Object.assign(
        task,
        setManualTaskTiming(
          ensureTaskTimingFields(task),
          patch.manual_timing,
          store.settings.expected_due_date ?? null,
        ),
      );
    } else if (patch.due_date !== undefined) {
      if (patch.due_date) {
        task.manual_due_date = patch.due_date;
        task.due_date = patch.due_date;
        task.date_source = "manual";
        task.timing_type = "exact_date";
      } else {
        Object.assign(
          task,
          setManualTaskTiming(
            ensureTaskTimingFields(task),
            { mode: "remove" },
            store.settings.expected_due_date ?? null,
          ),
        );
      }
    }

    task.updated_at = nowIso();
    updated = { ...task };
    return store;
  }, { operation: "updateChecklistTask" });
  return updated;
}

export async function archiveChecklistTask(taskId: string): Promise<void> {
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task) return store;
    task.archived = true;
    task.updated_at = nowIso();
    return store;
  }, { operation: "archiveChecklistTask" });
}

export async function updateBeforeBabySchedulingSettings(
  patch: Partial<FamilySettings>,
  options?: { applySchedule?: boolean; keepManualDates?: boolean },
): Promise<{
  settings: FamilySettings;
  preview: ReturnType<typeof previewDueDateChange> | null;
  tasksUpdated: number;
}> {
  let settings!: FamilySettings;
  let preview: ReturnType<typeof previewDueDateChange> | null = null;
  let tasksUpdated = 0;

  await updateStore((store) => {
    ensureCollections(store);
    backfillTaskTiming(store);

    const beforeBaby = store.checklist_instances.find(
      (c) => c.template_slug === "before-baby",
    );
    const tasks = beforeBaby
      ? store.checklist_tasks.filter(
          (t) => t.checklist_id === beforeBaby.id && !t.archived,
        )
      : [];

    const nextDue =
      patch.expected_due_date !== undefined
        ? patch.expected_due_date
        : store.settings.expected_due_date;

    if (
      patch.expected_due_date !== undefined &&
      patch.expected_due_date &&
      patch.expected_due_date !== store.settings.expected_due_date
    ) {
      preview = previewDueDateChange(tasks, store.settings, patch.expected_due_date);
    }

    store.settings = {
      ...store.settings,
      ...patch,
      expected_due_date: nextDue,
      updated_at: nowIso(),
    };
    normalizeFamilySchedulingSettings(store.settings);
    settings = { ...store.settings };

    if (options?.applySchedule !== false) {
      const scheduled = applyScheduleToTasks(tasks, store.settings);
      for (const next of scheduled) {
        const live = store.checklist_tasks.find((t) => t.id === next.id);
        if (!live) continue;
        if (options?.keepManualDates && (live.date_source === "manual" || live.manual_due_date)) {
          continue;
        }
        const changed =
          live.due_date !== next.due_date ||
          live.calculated_due_date !== next.calculated_due_date ||
          live.date_source !== next.date_source;
        Object.assign(live, {
          recommended_start_offset_days: next.recommended_start_offset_days,
          recommended_due_offset_days: next.recommended_due_offset_days,
          hard_deadline_offset_days: next.hard_deadline_offset_days,
          timing_reason: next.timing_reason,
          timing_flexibility: next.timing_flexibility,
          timing_type: next.timing_type,
          manual_due_date: next.manual_due_date,
          calculated_due_date: next.calculated_due_date,
          calculated_start_date: next.calculated_start_date,
          date_source: next.date_source,
          due_date: next.due_date,
          updated_at: nowIso(),
        });
        if (changed) tasksUpdated += 1;
      }
    }

    return store;
  }, { operation: "updateBeforeBabySchedulingSettings" });

  return { settings, preview, tasksUpdated };
}

export async function generateBeforeBabySchedule(options?: {
  forceRecalculateManual?: boolean;
}): Promise<{ tasksUpdated: number; tasks: ChecklistTask[] }> {
  let tasksUpdated = 0;
  let tasks: ChecklistTask[] = [];
  await updateStore((store) => {
    ensureCollections(store);
    backfillTaskTiming(store);
    const instance = store.checklist_instances.find(
      (c) => c.template_slug === "before-baby",
    );
    if (!instance) return store;
    const current = store.checklist_tasks.filter(
      (t) => t.checklist_id === instance.id && !t.archived,
    );
    const scheduled = applyScheduleToTasks(current, store.settings);
    for (const next of scheduled) {
      const live = store.checklist_tasks.find((t) => t.id === next.id);
      if (!live) continue;
      if (
        !options?.forceRecalculateManual &&
        (live.date_source === "manual" || live.manual_due_date)
      ) {
        continue;
      }
      Object.assign(live, {
        calculated_due_date: next.calculated_due_date,
        calculated_start_date: next.calculated_start_date,
        date_source: next.date_source,
        due_date: next.due_date,
        timing_type: next.timing_type,
        timing_flexibility: next.timing_flexibility,
        timing_reason: next.timing_reason,
        recommended_due_offset_days: next.recommended_due_offset_days,
        recommended_start_offset_days: next.recommended_start_offset_days,
        updated_at: nowIso(),
      });
      tasksUpdated += 1;
    }
    tasks = store.checklist_tasks
      .filter((t) => t.checklist_id === instance.id && !t.archived)
      .map((t) => ensureTaskTimingFields(t));
    return store;
  }, { operation: "generateBeforeBabySchedule" });
  return { tasksUpdated, tasks };
}

export async function previewBeforeBabyDueDateChange(newDueDate: string) {
  const store = await readStore();
  ensureCollections(store);
  const instance = store.checklist_instances.find(
    (c) => c.template_slug === "before-baby",
  );
  const tasks = instance
    ? store.checklist_tasks
        .filter((t) => t.checklist_id === instance.id && !t.archived)
        .map((t) => ensureTaskTimingFields(t))
    : [];
  return previewDueDateChange(tasks, store.settings, newDueDate);
}

export type ChecklistDashboard = {
  total: number;
  completed: number;
  remaining: number;
  percent: number;
  overdue: ChecklistTask[];
  dueThisWeek: ChecklistTask[];
  upcoming: ChecklistTask[];
  recentlyCompleted: ChecklistTask[];
};

export {
  buildChecklistDashboard,
  groupTasksByCategory,
} from "@/lib/checklists/dashboard";

/** Used by seed / new family bootstrap. */
export function seedBeforeBabyIntoStore(store: AppStore): number {
  ensureCollections(store);
  if (store.checklist_instances.some((c) => c.template_slug === "before-baby")) {
    return 0;
  }
  const template = getChecklistTemplate("before-baby");
  if (!template) return 0;
  const ts = nowIso();
  const instance: ChecklistInstance = {
    id: id("clist"),
    family_id: store.family.id,
    template_slug: template.slug,
    title: template.title,
    description: template.description,
    created_at: ts,
    updated_at: ts,
  };
  store.checklist_instances.push(instance);
  let tasks = buildTasksFromTemplate(instance.id, template.slug, new Set());
  if (store.settings.expected_due_date) {
    tasks = applyScheduleToTasks(tasks, store.settings);
  }
  store.checklist_tasks.push(...tasks);
  return tasks.length;
}
