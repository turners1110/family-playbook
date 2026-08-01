import { id, nowIso, readStore, updateStore } from "@/lib/db/store";
import {
  BEFORE_BABY_TEMPLATE,
  countTemplateTasks,
  getChecklistTemplate,
  type ChecklistOwner,
  type ChecklistPriority,
} from "@/lib/checklists";
import type {
  AppStore,
  ChecklistInstance,
  ChecklistTask,
} from "@/lib/types/models";

function ensureCollections(store: AppStore) {
  if (!Array.isArray(store.checklist_instances)) store.checklist_instances = [];
  if (!Array.isArray(store.checklist_tasks)) store.checklist_tasks = [];
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
        owner: def.owner ?? "both",
        notes: null,
        is_custom: false,
        is_default: true,
        archived: false,
        sort_order: section.sort_order * 1000 + index + 1,
        created_at: ts,
        updated_at: ts,
      });
    });
  }

  return tasks;
}

export async function getBeforeBabyChecklist(): Promise<{
  instance: ChecklistInstance | null;
  tasks: ChecklistTask[];
  templateTaskCount: number;
}> {
  const store = await readStore();
  ensureCollections(store);
  const instance =
    store.checklist_instances.find((c) => c.template_slug === "before-baby") ??
    null;
  const tasks = instance
    ? store.checklist_tasks
        .filter((t) => t.checklist_id === instance.id && !t.archived)
        .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
    : [];
  return {
    instance,
    tasks,
    templateTaskCount: countTemplateTasks(BEFORE_BABY_TEMPLATE),
  };
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
  });

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

    created = {
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
    };
    store.checklist_tasks.push(created);
    instance.updated_at = ts;
    return store;
  });
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
  });
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
  });
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
  }>,
): Promise<ChecklistTask | null> {
  let updated: ChecklistTask | null = null;
  await updateStore((store) => {
    ensureCollections(store);
    const task = store.checklist_tasks.find((t) => t.id === taskId);
    if (!task || task.archived) return store;
    if (patch.title != null) task.title = patch.title.trim() || task.title;
    if (patch.notes !== undefined) task.notes = patch.notes?.trim() || null;
    if (patch.due_date !== undefined) task.due_date = patch.due_date || null;
    if (patch.owner) task.owner = patch.owner;
    if (patch.priority) task.priority = patch.priority;
    if (patch.category) task.category = patch.category;
    if (patch.category_label) task.category_label = patch.category_label;
    task.updated_at = nowIso();
    updated = { ...task };
    return store;
  });
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
  });
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
  const tasks = buildTasksFromTemplate(instance.id, template.slug, new Set());
  store.checklist_tasks.push(...tasks);
  return tasks.length;
}
