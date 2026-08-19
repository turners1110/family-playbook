import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  applyRelativeTimingMetadata,
  findSimilarChecklistTasks,
  formatRelativeTimingDisplay,
  isInboxTask,
  resolveManualTiming,
  suggestCategoriesForTitle,
  taskOriginBadge,
  weeksBeforeDueFromPregnancyWeek,
} from "@/lib/checklists/manual-tasks";
import { addDays } from "@/lib/checklists/date-math";
import { applyScheduleToTasks, setManualTaskTiming } from "@/lib/checklists/scheduling";
import { filterTasksByView } from "@/lib/checklists/scheduling";
import type { ChecklistTask } from "@/lib/types/models";

const root = path.resolve(__dirname, "../..");
const due = "2026-12-01";

function baseTask(overrides: Partial<ChecklistTask> = {}): ChecklistTask {
  return {
    id: "ctask_1",
    checklist_id: "clist_1",
    template_task_slug: null,
    title: "Buy nipple cream",
    category: "inbox",
    category_label: "Inbox",
    completed: false,
    completed_at: null,
    due_date: null,
    priority: "medium",
    owner: "unassigned",
    notes: null,
    is_custom: true,
    is_default: false,
    archived: false,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    source: "manual",
    inbox: true,
    ...overrides,
  };
}

describe("manual task timing presets", () => {
  it("maps pregnancy weeks to weeks-before-due", () => {
    expect(weeksBeforeDueFromPregnancyWeek(36)).toBe(4);
    expect(weeksBeforeDueFromPregnancyWeek(20)).toBe(20);
  });

  it("resolves Before 36 weeks to absolute date when due exists", () => {
    const resolved = resolveManualTiming("before_36_weeks", { dueDate: due });
    expect(resolved.kind).toBe("relative");
    if (resolved.kind !== "relative") return;
    expect(resolved.label).toBe("Before 36 weeks");
    expect(resolved.absoluteDate).toBe(addDays(due, -28));
    expect(resolved.timing).toEqual({ mode: "weeks_before", weeks: 4 });
  });

  it("recalculates relative timing when due date moves", () => {
    let task = baseTask({ inbox: false, category: "shopping", category_label: "Shopping" });
    const resolved = resolveManualTiming("before_36_weeks", { dueDate: due });
    if (resolved.kind !== "relative") throw new Error("expected relative");
    task = setManualTaskTiming(task, resolved.timing, due);
    task = applyRelativeTimingMetadata(task, resolved);
    expect(task.due_date).toBe(addDays(due, -28));
    expect(task.relative_timing_label).toBe("Before 36 weeks");

    const moved = applyScheduleToTasks([task], {
      expected_due_date: addDays(due, 7),
      before_baby_scheduling_mode: "recommended",
    });
    expect(moved[0].due_date).toBe(addDays(addDays(due, 7), -28));
  });

  it("keeps ASAP as absolute manual date (does not move with due)", () => {
    const resolved = resolveManualTiming("asap", {
      dueDate: due,
      today: "2026-06-01",
    });
    expect(resolved.kind).toBe("absolute");
    if (resolved.kind !== "absolute") return;
    let task = setManualTaskTiming(
      baseTask(),
      { mode: "exact", date: resolved.date },
      due,
    );
    task = applyRelativeTimingMetadata(task, resolved);
    const moved = applyScheduleToTasks([task], {
      expected_due_date: addDays(due, 14),
      before_baby_scheduling_mode: "recommended",
    });
    expect(moved[0].due_date).toBe("2026-06-01");
    expect(moved[0].date_source).toBe("manual");
  });

  it("formats relative + absolute display", () => {
    expect(
      formatRelativeTimingDisplay({
        relative_timing_label: "Before 36 weeks",
        relative_timing_preset: "before_36_weeks",
        due_date: "2026-10-14",
      }),
    ).toBe("Before 36 weeks · 2026-10-14");
  });
});

describe("manual task categorization and similarity", () => {
  it("suggests categories from title heuristics", () => {
    const hits = suggestCategoriesForTitle("Install car seat");
    expect(hits.some((h) => h.slug === "baby_gear" || h.slug === "transportation")).toBe(
      true,
    );
  });

  it("finds similar tasks without auto-merge", () => {
    const existing = [
      baseTask({ id: "a", title: "Buy newborn diapers", inbox: false }),
      baseTask({ id: "b", title: "Call insurance about claims", inbox: false }),
    ];
    const hits = findSimilarChecklistTasks("Buy diapers", existing);
    expect(hits[0]?.task.id).toBe("a");
    expect(hits.every((h) => h.score < 1 || h.task.title !== "Buy diapers")).toBe(
      true,
    );
  });

  it("identifies inbox and manual badges", () => {
    expect(isInboxTask(baseTask())).toBe(true);
    expect(taskOriginBadge(baseTask())).toBe("Manual");
    expect(
      taskOriginBadge(
        baseTask({
          is_custom: false,
          is_default: true,
          source: "generated",
          template_task_slug: "hospital_1",
        }),
      ),
    ).toBe("Suggested");
  });
});

describe("inbox and priority views", () => {
  it("filters inbox and completed views", () => {
    const tasks = [
      baseTask({ id: "1" }),
      baseTask({
        id: "2",
        inbox: false,
        owner: "michelle",
        category: "shopping",
        category_label: "Shopping",
        due_date: due,
        date_source: "manual",
      }),
      baseTask({
        id: "3",
        completed: true,
        inbox: false,
        owner: "sam",
        category: "home",
        category_label: "Home",
      }),
    ];
    expect(filterTasksByView(tasks, "inbox", due).map((t) => t.id)).toEqual([
      "1",
    ]);
    expect(filterTasksByView(tasks, "completed", due).map((t) => t.id)).toEqual([
      "3",
    ]);
  });
});

describe("manual task UI contracts", () => {
  it("Before Baby exposes Add Task entry points and QuickAdd sheet", () => {
    const scheduler = readFileSync(
      path.join(root, "components/checklists/BeforeBabyScheduler.tsx"),
      "utf8",
    );
    expect(scheduler).toMatch(/QuickAddTaskSheet/);
    expect(scheduler).toMatch(/\+ Add Task/);
    expect(scheduler).toMatch(/ADVANCED_FILTERS/);
    const views = readFileSync(
      path.join(root, "lib/checklists/view-state.ts"),
      "utf8",
    );
    expect(views).toMatch(/Inbox/);

    const sheet = readFileSync(
      path.join(root, "components/checklists/QuickAddTaskSheet.tsx"),
      "utf8",
    );
    expect(sheet).toMatch(/Buy newborn diapers/);
    expect(sheet).toMatch(/relative_timing_preset/);
    expect(sheet).toMatch(/Keep both/);

    const card = readFileSync(
      path.join(root, "components/conversations/ConversationCard.tsx"),
      "utf8",
    );
    expect(card).toMatch(/Create follow-up task/);

    const question = readFileSync(
      path.join(root, "app/questions/[slug]/page.tsx"),
      "utf8",
    );
    expect(question).toMatch(/CreateChecklistTaskButton/);
  });

  it("service addCustomChecklistTask accepts relative presets and links", () => {
    const service = readFileSync(
      path.join(root, "lib/services/checklists.ts"),
      "utf8",
    );
    expect(service).toMatch(/relative_timing_preset/);
    expect(service).toMatch(/linked_question_ids/);
    expect(service).toMatch(/inbox/);
  });
});
