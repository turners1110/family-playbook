/**
 * First-class checklist task dependencies.
 * Template slug chains are resolved to task IDs when a checklist is loaded.
 */

import type { ChecklistDependencyStatus, ChecklistTask } from "@/lib/types/models";

/** Required dependency chains keyed by dependent template slug → prerequisite slugs. */
export const TEMPLATE_DEPENDENCIES: Record<string, string[]> = {
  // Car seat inspection depends on install
  hospital_birth_6: ["hospital_birth_5"],
  // Schedule first pediatrician appointment → choose pediatrician
  medical_2: ["medical_1"],
  // Complete hospital registration → choose hospital
  hospital_birth_2: ["hospital_birth_1"],
  // Hospital pre-registration confirmation → submit registration
  paperwork_9: ["hospital_birth_2"],
  // Bags in car → pack Michelle, Sam, snacks/docs
  final_week_5: ["hospital_birth_7", "hospital_birth_8", "hospital_birth_9"],
  // Safe sleep final check
  home_extra_2: ["home_2", "home_7", "home_extra_1"],
  // Lulu labor plan confirmed
  lulu_extra_6: ["lulu_extra_1", "lulu_extra_2", "lulu_extra_3"],
  // Will finalized → choose guardians
  paperwork_6: ["paperwork_8"],
  // Beneficiaries updated → review designations
  paperwork_5: ["legal_extra_1"],
  legal_extra_6: ["legal_extra_1", "paperwork_6"],
};

export type DependencyValidationIssue = {
  code:
    | "missing_dependency"
    | "archived_dependency"
    | "circular_dependency"
    | "self_dependency";
  task_id: string;
  message: string;
  related_ids?: string[];
};

function slugMap(tasks: ChecklistTask[]): Map<string, ChecklistTask> {
  const map = new Map<string, ChecklistTask>();
  for (const t of tasks) {
    if (t.template_task_slug) map.set(t.template_task_slug, t);
  }
  return map;
}

/** Resolve template slug deps onto depends_on_task_ids without wiping manual deps. */
export function resolveTemplateDependencies(
  tasks: ChecklistTask[],
): ChecklistTask[] {
  const bySlug = slugMap(tasks);
  return tasks.map((task) => {
    const slugDeps =
      (task.template_task_slug &&
        TEMPLATE_DEPENDENCIES[task.template_task_slug]) ||
      task.depends_on_template_slugs ||
      [];
    if (!slugDeps.length && !(task.depends_on_task_ids?.length)) {
      return task;
    }
    const fromSlugs = slugDeps
      .map((slug) => bySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));
    const existing = task.depends_on_task_ids ?? [];
    const merged = [...new Set([...existing, ...fromSlugs])];
    return {
      ...task,
      depends_on_template_slugs: slugDeps.length
        ? [...slugDeps]
        : task.depends_on_template_slugs,
      depends_on_task_ids: merged,
    };
  });
}

export function detectDependencyCycles(
  tasks: ChecklistTask[],
): DependencyValidationIssue[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const issues: DependencyValidationIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string, stack: string[]) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cycle = stack.slice(cycleStart >= 0 ? cycleStart : 0).concat(id);
      issues.push({
        code: "circular_dependency",
        task_id: id,
        message: `Circular dependency: ${cycle.join(" → ")}`,
        related_ids: cycle,
      });
      return;
    }
    visiting.add(id);
    const task = byId.get(id);
    for (const depId of task?.depends_on_task_ids ?? []) {
      visit(depId, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const t of tasks) visit(t.id, []);
  return issues;
}

export function validateDependencies(
  tasks: ChecklistTask[],
): DependencyValidationIssue[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const issues: DependencyValidationIssue[] = [];

  for (const task of tasks) {
    for (const depId of task.depends_on_task_ids ?? []) {
      if (depId === task.id) {
        issues.push({
          code: "self_dependency",
          task_id: task.id,
          message: "Task cannot depend on itself.",
        });
        continue;
      }
      const dep = byId.get(depId);
      if (!dep) {
        issues.push({
          code: "missing_dependency",
          task_id: task.id,
          message: `Missing dependency id ${depId}`,
          related_ids: [depId],
        });
        continue;
      }
      if (dep.archived) {
        issues.push({
          code: "archived_dependency",
          task_id: task.id,
          message: `Dependency "${dep.title}" is archived and cannot block an active task.`,
          related_ids: [depId],
        });
      }
    }
  }

  issues.push(...detectDependencyCycles(tasks));
  return issues;
}

export type DependencyComputeResult = {
  depends_on_task_ids: string[];
  blocked_by_count: number;
  dependency_status: ChecklistDependencyStatus;
  dependency_reason: string | null;
};

export function computeDependencyState(
  task: ChecklistTask,
  allTasks: ChecklistTask[],
): DependencyComputeResult {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const depIds = [...new Set(task.depends_on_task_ids ?? [])];
  if (task.dependency_override) {
    return {
      depends_on_task_ids: depIds,
      blocked_by_count: 0,
      dependency_status: "overridden",
      dependency_reason:
        "Manual override: this task may proceed even though prerequisites are incomplete.",
    };
  }
  if (!depIds.length) {
    return {
      depends_on_task_ids: [],
      blocked_by_count: 0,
      dependency_status: "open",
      dependency_reason: null,
    };
  }

  const blockers: ChecklistTask[] = [];
  for (const depId of depIds) {
    const dep = byId.get(depId);
    if (!dep || dep.archived) continue;
    if (!dep.completed) blockers.push(dep);
  }

  if (!blockers.length) {
    return {
      depends_on_task_ids: depIds,
      blocked_by_count: 0,
      dependency_status: "satisfied",
      dependency_reason: null,
    };
  }

  const titles = blockers.map((b) => b.title).join("; ");
  return {
    depends_on_task_ids: depIds,
    blocked_by_count: blockers.length,
    dependency_status: "blocked",
    dependency_reason: `Blocked until complete: ${titles}`,
  };
}

/** Apply resolved dependency state onto every task. */
export function applyDependencyState(tasks: ChecklistTask[]): ChecklistTask[] {
  const resolved = resolveTemplateDependencies(tasks);
  return resolved.map((task) => {
    const state = computeDependencyState(task, resolved);
    return { ...task, ...state };
  });
}

export function setDependencyOverride(
  task: ChecklistTask,
  override: boolean,
): ChecklistTask {
  return {
    ...task,
    dependency_override: override,
    updated_at: new Date().toISOString(),
  };
}

/** Reject invalid dependency ID lists (cycles / missing / archived / self). */
export function assertValidDependencyPatch(
  taskId: string,
  dependsOn: string[],
  allTasks: ChecklistTask[],
): void {
  const next = allTasks.map((t) =>
    t.id === taskId ? { ...t, depends_on_task_ids: dependsOn } : t,
  );
  const issues = validateDependencies(next).filter(
    (i) => i.task_id === taskId || (i.related_ids ?? []).includes(taskId),
  );
  if (issues.length) {
    throw new Error(issues.map((i) => i.message).join(" "));
  }
}
