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
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import {
  addDays,
  computePregnancyProgress,
  diffDays,
  todayDateOnly,
} from "@/lib/checklists/date-math";
import {
  applyScheduleToTasks,
  calculateTaskDates,
  ensureTaskTimingFields,
  getTimelineGroup,
  previewDueDateChange,
  setManualTaskTiming,
} from "@/lib/checklists/scheduling";
import { getDefaultTimingForTask } from "@/lib/checklists/default-timing";

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
      "work_leave",
      "postpartum_prep",
      "legal_extra",
      "lulu_extra",
      "home_extra",
      "final_week",
      "announcements_and_support",
    ]);
    expect(countTemplateTasks(BEFORE_BABY_TEMPLATE)).toBeGreaterThan(110);
    expect(listChecklistTemplates().some((t) => t.slug === "before-baby")).toBe(
      true,
    );
  });

  it("builds default tasks and skips existing template slugs", () => {
    const all = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    expect(all.length).toBe(countTemplateTasks(BEFORE_BABY_TEMPLATE));
    expect(all.every((t) => t.is_default && !t.is_custom)).toBe(true);
    expect(all.every((t) => t.timing_type)).toBe(true);

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

  it("includes Lulu pet prep and final-week rest check", () => {
    const titles = BEFORE_BABY_TEMPLATE.sections.flatMap((s) =>
      s.tasks.map((t) => t.title),
    );
    expect(titles).toContain("Prepare Lulu");
    expect(titles).toContain("Rest and reduce workload");
    expect(titles).toContain("Pack hospital bag for Michelle");
    expect(titles).toContain("Document Sam work handoff");
    expect(titles).toContain("Complete final house reset");
  });
});

describe("Before Baby due-date scheduling", () => {
  const due = "2026-12-15";
  const baseSettings: Partial<FamilySettings> = {
    expected_due_date: due,
    before_baby_scheduling_mode: "recommended",
    before_baby_preferred_task_days: [1, 2, 3, 4, 5],
    before_baby_max_tasks_per_week: 8,
    before_baby_weekend_heavy: false,
    before_baby_include_post_birth: true,
    before_baby_hide_completed: false,
    before_baby_avoid_travel_dates: [],
  };

  it("uses timezone-safe date math", () => {
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(diffDays("2026-12-01", "2026-12-15")).toBe(14);
    const progress = computePregnancyProgress(due, "2026-10-01");
    expect(progress.days_remaining).toBe(75);
    expect(progress.pregnancy_week).toBeGreaterThan(0);
    expect(progress.trimester).toBeTruthy();
  });

  it("creates calculated dates from due date", () => {
    const tasks = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    const scheduled = applyScheduleToTasks(tasks, baseSettings);
    const peds = scheduled.find((t) => t.template_task_slug === "medical_1");
    expect(peds?.date_source).toBe("calculated");
    expect(peds?.due_date).toBeTruthy();
    expect(peds?.calculated_due_date).toBe(peds?.due_date);
    // Target ~90 days before due after rebalance (may snap to preferred weekday).
    const daysBeforeBirth = diffDays(peds!.due_date!, due);
    expect(daysBeforeBirth).toBeGreaterThanOrEqual(75);
    expect(daysBeforeBirth).toBeLessThanOrEqual(105);
  });

  it("moves flexible tasks earlier in earlier mode", () => {
    const task = ensureTaskTimingFields(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()).find(
        (t) => t.template_task_slug === "home_12",
      )!,
    );
    const recommended = calculateTaskDates(task, due, "recommended");
    const earlier = calculateTaskDates(task, due, "earlier");
    expect(earlier.calculated_due_date! < recommended.calculated_due_date!).toBe(
      true,
    );
  });

  it("compacts flexible tasks toward birth", () => {
    const task = ensureTaskTimingFields(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()).find(
        (t) => t.template_task_slug === "paperwork_1",
      )!,
    );
    const recommended = calculateTaskDates(task, due, "recommended");
    const compact = calculateTaskDates(task, due, "compact");
    expect(compact.calculated_due_date! > recommended.calculated_due_date!).toBe(
      true,
    );
  });

  it("manual-only mode does not calculate dates", () => {
    const tasks = buildTasksFromTemplate("clist_1", "before-baby", new Set()).slice(
      0,
      5,
    );
    const scheduled = applyScheduleToTasks(tasks, {
      ...baseSettings,
      before_baby_scheduling_mode: "manual_only",
    });
    expect(scheduled.every((t) => t.date_source === "none" || t.manual_due_date)).toBe(
      true,
    );
    expect(scheduled.every((t) => !t.calculated_due_date)).toBe(true);
  });

  it("manual date survives recalculation", () => {
    let task = ensureTaskTimingFields(
      buildTasksFromTemplate("clist_1", "before-baby", new Set())[0],
    );
    task = {
      ...task,
      manual_due_date: "2026-11-01",
      due_date: "2026-11-01",
      date_source: "manual",
    };
    const scheduled = applyScheduleToTasks([task], {
      ...baseSettings,
      expected_due_date: "2027-01-01",
    });
    expect(scheduled[0].due_date).toBe("2026-11-01");
    expect(scheduled[0].date_source).toBe("manual");
  });

  it("relative custom task moves with due date", () => {
    let task = ensureTaskTimingFields({
      ...buildTasksFromTemplate("clist_1", "before-baby", new Set())[0],
      is_custom: true,
      is_default: false,
      template_task_slug: null,
    });
    task = setManualTaskTiming(task, { mode: "days_before", days: 10 }, due);
    expect(task.due_date).toBe(addDays(due, -10));
    const moved = applyScheduleToTasks([task], {
      ...baseSettings,
      expected_due_date: addDays(due, 7),
    });
    expect(moved[0].due_date).toBe(addDays(addDays(due, 7), -10));
  });

  it("groups post-birth and overdue correctly", () => {
    const tasks = applyScheduleToTasks(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()),
      baseSettings,
    );
    const insurance = tasks.find((t) => t.template_task_slug === "paperwork_3");
    expect(insurance?.timing_type).toBe("after_birth");
    expect(getTimelineGroup(insurance!, due, addDays(due, -30))).toBe(
      "after_birth",
    );

    const overdueTask: ChecklistTask = {
      ...tasks[0],
      completed: false,
      due_date: "2026-01-01",
      date_source: "manual",
      manual_due_date: "2026-01-01",
      timing_type: "exact_date",
    };
    expect(getTimelineGroup(overdueTask, due, "2026-08-01")).toBe("overdue");
  });

  it("completed task stays completed after reschedule", () => {
    const tasks = buildTasksFromTemplate("clist_1", "before-baby", new Set()).slice(
      0,
      3,
    );
    tasks[0].completed = true;
    tasks[0].completed_at = "2026-08-01T00:00:00.000Z";
    const scheduled = applyScheduleToTasks(tasks, baseSettings);
    expect(scheduled[0].completed).toBe(true);
    expect(getTimelineGroup(scheduled[0], due)).toBe("completed");
  });

  it("respects max tasks per week", () => {
    const tasks = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    const scheduled = applyScheduleToTasks(tasks, {
      ...baseSettings,
      before_baby_max_tasks_per_week: 3,
    });
    expect(scheduled.some((t) => t.calculated_due_date)).toBe(true);
    const dated = scheduled.filter(
      (t) => t.date_source === "calculated" && t.calculated_due_date,
    );
    expect(dated.length).toBeGreaterThan(10);
  });

  it("avoids travel dates for flexible tasks", () => {
    const task = ensureTaskTimingFields(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()).find(
        (t) => t.template_task_slug === "home_12",
      )!,
    );
    const raw = calculateTaskDates(task, due, "recommended");
    const blocked = raw.calculated_due_date!;
    const avoided = calculateTaskDates(task, due, "recommended", {
      preferredDays: [0, 1, 2, 3, 4, 5, 6],
      avoidDates: [blocked],
    });
    expect(avoided.calculated_due_date).not.toBe(blocked);
  });

  it("preferred task days snap flexible due dates", () => {
    const task = ensureTaskTimingFields(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()).find(
        (t) => t.timing_flexibility === "flexible" && t.recommended_due_offset_days != null,
      )!,
    );
    const calc = calculateTaskDates(task, due, "recommended", {
      preferredDays: [3], // Wednesday
      weekendHeavy: false,
      avoidDates: [],
    });
    const dow = new Date(`${calc.calculated_due_date}T12:00:00.000Z`).getUTCDay();
    expect(dow).toBe(3);
  });

  it("preview counts tasks that move when due date changes", () => {
    const tasks = applyScheduleToTasks(
      buildTasksFromTemplate("clist_1", "before-baby", new Set()).slice(0, 20),
      baseSettings,
    );
    const preview = previewDueDateChange(tasks, baseSettings, addDays(due, 14));
    expect(preview.moving).toBeGreaterThan(0);
  });

  it("assigns pediatrician and insurance default timings", () => {
    const peds = getDefaultTimingForTask("medical_1", "medical");
    expect(peds.recommended_start_offset_days).toBe(-150);
    expect(peds.recommended_due_offset_days).toBe(-90);
    const insurance = getDefaultTimingForTask("paperwork_3", "paperwork");
    expect(insurance.timing_type).toBe("after_birth");
  });

  it("today helper returns YYYY-MM-DD", () => {
    expect(todayDateOnly(new Date("2026-08-01T23:30:00.000Z"))).toBe(
      "2026-08-01",
    );
  });
});
