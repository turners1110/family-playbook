import { describe, expect, it } from "vitest";
import {
  BEFORE_BABY_TEMPLATE,
  countTemplateTasks,
  getChecklistTemplate,
  listChecklistTemplates,
} from "@/lib/checklists";
import {
  buildChecklistDashboard,
  groupTasksByCategory,
} from "@/lib/checklists/dashboard";
import { buildTasksFromTemplate } from "@/lib/services/checklists";
import type { ChecklistTask } from "@/lib/types/models";

describe("Before Baby template system", () => {
  it("registers the before-baby template with expected sections", () => {
    const template = getChecklistTemplate("before-baby");
    expect(template).toBeTruthy();
    expect(template?.title).toBe("Before Baby");
    expect(template?.sections.map((s) => s.slug)).toEqual([
      "hospital_birth",
      "medical",
      "home",
      "baby_gear",
      "paperwork",
      "financial",
      "relationship",
      "pets",
      "final_week",
    ]);
    expect(countTemplateTasks(BEFORE_BABY_TEMPLATE)).toBeGreaterThan(90);
    expect(listChecklistTemplates().some((t) => t.slug === "before-baby")).toBe(
      true,
    );
  });

  it("builds default tasks and skips existing template slugs", () => {
    const all = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    expect(all.length).toBe(countTemplateTasks(BEFORE_BABY_TEMPLATE));
    expect(all.every((t) => t.is_default && !t.is_custom)).toBe(true);

    const existing = new Set(all.slice(0, 5).map((t) => t.template_task_slug!));
    const partial = buildTasksFromTemplate("clist_1", "before-baby", existing);
    expect(partial.length).toBe(all.length - 5);
  });

  it("computes dashboard progress and groupings", () => {
    const base = buildTasksFromTemplate("clist_1", "before-baby", new Set()).slice(
      0,
      10,
    );
    const tasks: ChecklistTask[] = base.map((task, index) => ({
      ...task,
      completed: index < 4,
      completed_at: index < 4 ? "2026-08-01T12:00:00.000Z" : null,
      due_date:
        index === 4
          ? "2026-07-01"
          : index === 5
            ? "2026-08-02"
            : null,
    }));

    const dashboard = buildChecklistDashboard(
      tasks,
      new Date("2026-08-01T15:00:00.000Z"),
    );
    expect(dashboard.total).toBe(10);
    expect(dashboard.completed).toBe(4);
    expect(dashboard.percent).toBe(40);
    expect(dashboard.overdue.length).toBe(1);
    expect(dashboard.dueThisWeek.length).toBeGreaterThanOrEqual(1);

    const groups = groupTasksByCategory(tasks);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].tasks.length).toBeGreaterThan(0);
  });

  it("includes Lulu pet prep and final-week relax together", () => {
    const titles = BEFORE_BABY_TEMPLATE.sections.flatMap((s) =>
      s.tasks.map((t) => t.title),
    );
    expect(titles).toContain("Prepare Lulu");
    expect(titles).toContain("Relax together");
    expect(titles).toContain("Pack hospital bag for Michelle");
  });
});
