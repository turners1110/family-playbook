import type { ChecklistTask } from "@/lib/types/models";

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function endOfWeekKey(now = new Date()): string {
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const end = new Date(now);
  end.setDate(now.getDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
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

export function buildChecklistDashboard(
  tasks: ChecklistTask[],
  now = new Date(),
): ChecklistDashboard {
  const active = tasks.filter((t) => !t.archived);
  const completed = active.filter((t) => t.completed);
  const open = active.filter((t) => !t.completed);
  const today = todayKey(now);
  const weekEnd = endOfWeekKey(now);

  const overdue = open
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const dueThisWeek = open
    .filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const upcoming = open
    .filter((t) => t.due_date && t.due_date > weekEnd)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 8);

  const recentlyCompleted = completed
    .filter((t) => t.completed_at)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 8);

  const total = active.length;
  const done = completed.length;
  return {
    total,
    completed: done,
    remaining: Math.max(total - done, 0),
    percent: total ? Math.round((done / total) * 100) : 0,
    overdue,
    dueThisWeek,
    upcoming,
    recentlyCompleted,
  };
}

export function groupTasksByCategory(tasks: ChecklistTask[]) {
  const map = new Map<string, { label: string; tasks: ChecklistTask[] }>();
  for (const task of tasks) {
    const key = task.category;
    if (!map.has(key)) {
      map.set(key, { label: task.category_label, tasks: [] });
    }
    map.get(key)!.tasks.push(task);
  }
  return [...map.entries()]
    .map(([slug, value]) => ({
      slug,
      label: value.label,
      tasks: value.tasks.sort(
        (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title),
      ),
      completed: value.tasks.filter((t) => t.completed).length,
      total: value.tasks.length,
    }))
    .sort((a, b) => {
      const aOrder = a.tasks[0]?.sort_order ?? 0;
      const bOrder = b.tasks[0]?.sort_order ?? 0;
      return aOrder - bOrder || a.label.localeCompare(b.label);
    });
}
