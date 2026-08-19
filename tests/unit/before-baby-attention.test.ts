import { describe, expect, it } from "vitest";
import {
  attentionTaskIds,
  buildBeforeBabyAttention,
  dueDateStage,
} from "@/lib/checklists/attention";
import {
  parseBeforeBabyViewState,
  withFilter,
  withGroupBy,
} from "@/lib/checklists/view-state";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";

const TODAY = "2026-08-19";

function settings(
  overrides: Partial<FamilySettings> = {},
): Pick<
  FamilySettings,
  | "expected_due_date"
  | "actual_birth_date"
  | "before_baby_max_tasks_per_week"
  | "before_baby_include_post_birth"
  | "before_baby_hide_completed"
> {
  return {
    expected_due_date: "2026-10-01",
    actual_birth_date: null,
    before_baby_max_tasks_per_week: 8,
    before_baby_include_post_birth: true,
    before_baby_hide_completed: false,
    ...overrides,
  };
}

function task(overrides: Partial<ChecklistTask> = {}): ChecklistTask {
  return {
    id: "ctask_1",
    checklist_id: "clist_1",
    template_task_slug: null,
    title: "Task",
    category: "medical",
    category_label: "Medical",
    completed: false,
    completed_at: null,
    due_date: "2026-09-01",
    priority: "medium",
    owner: "sam",
    notes: null,
    is_custom: false,
    is_default: true,
    archived: false,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    timing_type: "before_birth",
    date_source: "calculated",
    ...overrides,
  };
}

describe("dueDateStage", () => {
  const due = "2026-10-01";
  it("classifies injected dates without using the system clock", () => {
    expect(dueDateStage(due, "2026-07-23")).toBe("more_than_8_weeks"); // 70 days
    expect(dueDateStage(due, "2026-08-06")).toBe("weeks_6_8"); // 56 days
    expect(dueDateStage(due, "2026-08-20")).toBe("weeks_4_6"); // 42 days
    expect(dueDateStage(due, "2026-09-03")).toBe("weeks_2_4"); // 28 days
    expect(dueDateStage(due, "2026-09-17")).toBe("final_2_weeks"); // 14 days
    expect(dueDateStage(due, "2026-09-24")).toBe("final_week"); // 7 days
    expect(dueDateStage(due, "2026-10-01")).toBe("final_week");
    expect(dueDateStage(due, "2026-10-02")).toBe("past_due");
    expect(dueDateStage(due, "2026-10-15")).toBe("past_due");
    expect(dueDateStage(null, TODAY)).toBe("no_due_date");
  });
});

describe("buildBeforeBabyAttention", () => {
  it("places overdue, today, this week, and future tasks into distinct groups", () => {
    const overdue = task({
      id: "overdue",
      title: "Overdue hospital registration",
      due_date: "2026-08-01",
    });
    const todayTask = task({
      id: "today",
      title: "Due today",
      due_date: TODAY,
      priority: "high",
    });
    const thisWeek = task({
      id: "week",
      title: "Due Sunday this week",
      due_date: "2026-08-23",
    });
    const future = task({
      id: "future",
      title: "Choose pediatrician",
      due_date: "2026-09-10",
    });
    const result = buildBeforeBabyAttention({
      tasks: [overdue, todayTask, thisWeek, future],
      settings: settings(),
      today: TODAY,
    });
    expect(result.overdue.map((r) => r.task.id)).toEqual(["overdue"]);
    expect(result.needsAttentionNow.map((r) => r.task.id)).toContain("today");
    expect(result.thisWeek.map((r) => r.task.id)).toContain("week");
    expect(result.comingNext.map((r) => r.task.id)).toContain("future");
  });

  it("flags blocked overdue tasks with a blocker explanation", () => {
    const result = buildBeforeBabyAttention({
      tasks: [
        task({
          id: "blocked",
          title: "Schedule pediatrician",
          due_date: "2026-08-01",
          dependency_status: "blocked",
          dependency_reason: "Blocked by: Choose pediatrician",
        }),
      ],
      settings: settings(),
      today: TODAY,
    });
    expect(result.overdue[0]?.blocked).toBe(true);
    expect(result.overdue[0]?.blockedReason).toMatch(/Choose pediatrician/);
  });

  it("surfaces provider-confirmation tasks once start date is reached", () => {
    const result = buildBeforeBabyAttention({
      tasks: [
        task({
          id: "prov",
          title: "Confirm with OB",
          due_date: "2026-09-20",
          calculated_start_date: "2026-08-10",
          provider_confirmation_needed: true,
        }),
      ],
      settings: settings(),
      today: TODAY,
    });
    expect(result.needsAttentionNow.map((r) => r.task.id)).toEqual(["prov"]);
  });

  it("respects manual due dates and hard-deadline urgency", () => {
    const manual = task({
      id: "manual",
      title: "Manual override",
      due_date: "2026-08-10",
      date_source: "manual",
      manual_due_date: "2026-08-10",
    });
    const hard = task({
      id: "hard",
      title: "Hard deadline soon",
      due_date: "2026-08-24",
      hard_deadline_offset_days: -7,
      priority: "high",
    });
    const result = buildBeforeBabyAttention({
      tasks: [manual, hard],
      settings: settings(),
      today: TODAY,
    });
    expect(result.overdue.map((r) => r.task.id)).toContain("manual");
    expect(result.needsAttentionNow.map((r) => r.task.id)).toContain("hard");
  });

  it("caps Needs attention now using max tasks per week", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      task({
        id: `n${i}`,
        title: `Now ${i}`,
        due_date: TODAY,
        priority: "high",
      }),
    );
    const result = buildBeforeBabyAttention({
      tasks: many,
      settings: settings({ before_baby_max_tasks_per_week: 4 }),
      today: TODAY,
    });
    expect(result.needsAttentionNow.length).toBe(4);
  });

  it("uses scheduled due dates (travel/weekend placement already applied)", () => {
    const avoided = task({
      id: "travel",
      title: "Task moved off travel week",
      due_date: "2026-09-08",
    });
    const result = buildBeforeBabyAttention({
      tasks: [avoided],
      settings: settings(),
      today: TODAY,
    });
    expect(result.overdue).toHaveLength(0);
    expect(result.comingNext.map((r) => r.task.id)).toContain("travel");
  });

  it("moves to post-birth groups after the due date", () => {
    const leftover = task({
      id: "left",
      title: "Finish hospital bag",
      due_date: "2026-09-20",
      priority: "high",
      timing_type: "before_birth",
    });
    const firstDays = task({
      id: "after",
      title: "Newborn feeding check",
      due_date: "2026-10-03",
      timing_type: "after_birth",
    });
    const later = task({
      id: "later",
      title: "Optional nursery tweak",
      due_date: "2026-10-20",
      priority: "low",
      timing_type: "before_birth",
    });
    const result = buildBeforeBabyAttention({
      tasks: [leftover, firstDays, later],
      settings: settings({ actual_birth_date: "2026-10-02" }),
      today: "2026-10-02",
    });
    expect(result.postBirth).toBe(true);
    expect(result.stillWorthFinishing.map((r) => r.task.id)).toContain("left");
    expect(result.firstDays.map((r) => r.task.id)).toContain("after");
    expect(result.later.map((r) => r.task.id)).toContain("later");
  });

  it("keeps completed tasks out of attention groups", () => {
    const done = task({
      id: "done",
      title: "Done",
      completed: true,
      completed_at: "2026-08-18T12:00:00.000Z",
      due_date: "2026-08-01",
    });
    const result = buildBeforeBabyAttention({
      tasks: [done],
      settings: settings(),
      today: TODAY,
    });
    expect(result.overdue).toHaveLength(0);
    expect(result.recentlyCompleted.map((t) => t.id)).toEqual(["done"]);
  });

  it("exposes one id list for Home and Before Baby", () => {
    const result = buildBeforeBabyAttention({
      tasks: [
        task({ id: "a", due_date: "2026-08-01" }),
        task({ id: "b", due_date: TODAY, priority: "high" }),
      ],
      settings: settings(),
      today: TODAY,
    });
    expect(attentionTaskIds(result).sort()).toEqual(
      [...result.overdue, ...result.needsAttentionNow, ...result.thisWeek]
        .map((r) => r.task.id)
        .sort(),
    );
  });
});

describe("Before Baby view state", () => {
  it("defaults to What needs attention", () => {
    expect(parseBeforeBabyViewState({})).toEqual({
      displayMode: "attention",
      groupBy: "none",
      filter: "attention",
    });
  });

  it("does not keep a stale owner-board view after switching to Overdue", () => {
    const owner = withGroupBy(parseBeforeBabyViewState({ view: "timeline" }), "owner");
    expect(owner).toEqual({
      displayMode: "timeline",
      groupBy: "owner",
      filter: "all",
    });
    const overdue = withFilter(owner, "overdue");
    expect(overdue.displayMode).toBe("timeline");
    expect(overdue.groupBy).toBe("owner");
    expect(overdue.filter).toBe("overdue");
  });

  it("parses shareable search params", () => {
    const parsed = parseBeforeBabyViewState({
      view: "timeline",
      group: "category",
      filter: "this_week",
    });
    expect(parsed).toEqual({
      displayMode: "timeline",
      groupBy: "category",
      filter: "this_week",
    });
  });
});
