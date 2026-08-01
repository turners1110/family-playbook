import { describe, expect, it } from "vitest";
import {
  TEMPLATE_DEPENDENCIES,
  applyDependencyState,
  assertValidDependencyPatch,
  computeDependencyState,
  detectDependencyCycles,
  resolveTemplateDependencies,
  setDependencyOverride,
  validateDependencies,
} from "@/lib/checklists/dependencies";
import {
  BEFORE_BABY_MILESTONES,
  buildMilestoneViews,
  milestoneProgress,
} from "@/lib/checklists/milestones";
import {
  HEAVY_SETUP_TAGS,
  validateFinalTwoWeekTiming,
  BEFORE_BABY_TASK_TIMING,
} from "@/lib/checklists/default-timing";
import {
  applyScheduleToTasks,
  calculateTaskDates,
  previewActualBirthDateChange,
} from "@/lib/checklists/scheduling";
import {
  GENERIC_WHY_MARKERS,
  helperForQuestion,
} from "@/lib/content/helper-templates";
import {
  applyPrimaryStageToQuestion,
  inferPrimaryDiscussionStage,
  isInPregnancyWorkflow,
} from "@/lib/content/primary-stages";
import { ownershipForSlug } from "@/lib/checklists/ownership";
import type { ChecklistTask, Question } from "@/lib/types/models";
import { AFTER_BIRTH_TEMPLATE } from "@/lib/checklists/templates/after-birth";
import { countTemplateTasks } from "@/lib/checklists/types";

function task(partial: Partial<ChecklistTask> & { id: string; title: string }): ChecklistTask {
  return {
    checklist_id: "c1",
    template_task_slug: null,
    category: "home",
    category_label: "Home",
    completed: false,
    completed_at: null,
    due_date: null,
    priority: "medium",
    owner: "both",
    notes: null,
    is_custom: false,
    is_default: true,
    archived: false,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("task dependencies", () => {
  it("resolves one and multiple dependencies from template slugs", () => {
    const tasks = [
      task({ id: "a", title: "Install", template_task_slug: "hospital_birth_5" }),
      task({ id: "b", title: "Inspect", template_task_slug: "hospital_birth_6" }),
      task({
        id: "c",
        title: "Bags",
        template_task_slug: "final_week_5",
      }),
      task({ id: "d", title: "M", template_task_slug: "hospital_birth_7" }),
      task({ id: "e", title: "S", template_task_slug: "hospital_birth_8" }),
      task({ id: "f", title: "Docs", template_task_slug: "hospital_birth_9" }),
    ];
    const resolved = resolveTemplateDependencies(tasks);
    const inspect = resolved.find((t) => t.id === "b")!;
    expect(inspect.depends_on_task_ids).toContain("a");
    const bags = resolved.find((t) => t.id === "c")!;
    expect(bags.depends_on_task_ids?.length).toBe(3);
  });

  it("unlocks after completion and supports override", () => {
    const tasks = applyDependencyState([
      task({
        id: "a",
        title: "Choose",
        template_task_slug: "medical_1",
        completed: false,
      }),
      task({
        id: "b",
        title: "Schedule",
        template_task_slug: "medical_2",
      }),
    ]);
    const blocked = computeDependencyState(
      tasks.find((t) => t.id === "b")!,
      tasks,
    );
    expect(blocked.dependency_status).toBe("blocked");
    expect(blocked.blocked_by_count).toBe(1);

    const completed = tasks.map((t) =>
      t.id === "a" ? { ...t, completed: true } : t,
    );
    const open = computeDependencyState(
      completed.find((t) => t.id === "b")!,
      completed,
    );
    expect(open.dependency_status).toBe("satisfied");

    const overridden = setDependencyOverride(tasks.find((t) => t.id === "b")!, true);
    expect(computeDependencyState(overridden, tasks).dependency_status).toBe(
      "overridden",
    );
  });

  it("rejects cycles and missing/archived deps", () => {
    const cyclic = [
      task({ id: "a", title: "A", depends_on_task_ids: ["b"] }),
      task({ id: "b", title: "B", depends_on_task_ids: ["a"] }),
    ];
    expect(detectDependencyCycles(cyclic).length).toBeGreaterThan(0);

    const missing = [
      task({ id: "a", title: "A", depends_on_task_ids: ["missing"] }),
    ];
    expect(
      validateDependencies(missing).some((i) => i.code === "missing_dependency"),
    ).toBe(true);

    const archived = [
      task({ id: "a", title: "A", archived: true }),
      task({ id: "b", title: "B", depends_on_task_ids: ["a"] }),
    ];
    expect(
      validateDependencies(archived).some((i) => i.code === "archived_dependency"),
    ).toBe(true);

    expect(() =>
      assertValidDependencyPatch("a", ["a"], [
        task({ id: "a", title: "A" }),
      ]),
    ).toThrow();
  });

  it("includes required dependency chains", () => {
    expect(TEMPLATE_DEPENDENCIES.hospital_birth_6).toEqual(["hospital_birth_5"]);
    expect(TEMPLATE_DEPENDENCIES.medical_2).toEqual(["medical_1"]);
    expect(TEMPLATE_DEPENDENCIES.final_week_5?.length).toBe(3);
    expect(TEMPLATE_DEPENDENCIES.paperwork_6).toEqual(["paperwork_8"]);
  });
});

describe("milestones", () => {
  it("maps completion into progress without duplicating rows", () => {
    const tasks = [
      task({
        id: "1",
        title: "Car seat",
        template_task_slug: "baby_gear_1",
        completed: true,
        notes: "bought",
      }),
      task({
        id: "2",
        title: "Install",
        template_task_slug: "hospital_birth_5",
        completed: true,
      }),
      task({
        id: "3",
        title: "Inspect",
        template_task_slug: "hospital_birth_6",
        completed: false,
      }),
    ];
    const ms = BEFORE_BABY_MILESTONES.find((m) => m.id === "ms_car_seat")!;
    const bySlug = new Map(tasks.map((t) => [t.template_task_slug!, t]));
    const progress = milestoneProgress(ms, bySlug);
    expect(progress.complete).toBe(2);
    const views = buildMilestoneViews(tasks, "2026-12-01");
    const car = views.find((v) => v.def.id === "ms_car_seat")!;
    expect(car.steps).toHaveLength(3);
    expect(car.steps.find((s) => s.id === "1")?.notes).toBe("bought");
    expect(car.next_action?.id).toBe("3");
  });
});

describe("ownership suggestions", () => {
  it("suggests non-Both owners for key tasks", () => {
    expect(ownershipForSlug("hospital_birth_5")?.primary_owner).toBe("sam");
    expect(ownershipForSlug("hospital_birth_2")?.primary_owner).toBe("michelle");
    expect(ownershipForSlug("work_leave_1")?.primary_owner).toBe("sam");
  });
});

describe("post-birth and birth date", () => {
  it("estimates from due date then replaces with actual birth date", () => {
    const tasks = [
      task({
        id: "p1",
        title: "Insurance",
        template_task_slug: "first_week_1",
        timing_type: "after_birth",
        recommended_due_offset_days: 5,
        timing_flexibility: "fixed",
      }),
      task({
        id: "pre",
        title: "Hospital",
        template_task_slug: "hospital_birth_1",
        timing_type: "before_birth",
        recommended_due_offset_days: -90,
      }),
      task({
        id: "manual",
        title: "Manual",
        template_task_slug: "first_week_3",
        timing_type: "after_birth",
        recommended_due_offset_days: 7,
        manual_due_date: "2026-12-20",
        due_date: "2026-12-20",
        date_source: "manual",
      }),
      task({
        id: "done",
        title: "Done",
        template_task_slug: "first_72h_1",
        timing_type: "after_birth",
        recommended_due_offset_days: 1,
        completed: true,
        due_date: "2026-12-02",
        date_source: "calculated",
      }),
    ];

    const estimated = applyScheduleToTasks(tasks, {
      expected_due_date: "2026-12-01",
      before_baby_scheduling_mode: "recommended",
    });
    expect(estimated.find((t) => t.id === "p1")?.date_estimated).toBe(true);
    expect(estimated.find((t) => t.id === "p1")?.due_date).toBe("2026-12-06");

    const preview = previewActualBirthDateChange(
      estimated,
      { expected_due_date: "2026-12-01" },
      "2026-11-20",
    );
    expect(preview.dates_moving).toBeGreaterThan(0);
    expect(preview.manual_unchanged).toBe(1);
    expect(preview.completed_unchanged).toBe(1);

    const withBirth = applyScheduleToTasks(estimated, {
      expected_due_date: "2026-12-01",
      actual_birth_date: "2026-11-20",
      before_baby_scheduling_mode: "recommended",
    });
    expect(withBirth.find((t) => t.id === "p1")?.due_date).toBe("2026-11-25");
    expect(withBirth.find((t) => t.id === "p1")?.date_estimated).toBe(false);
    expect(withBirth.find((t) => t.id === "manual")?.due_date).toBe("2026-12-20");
    expect(withBirth.find((t) => t.id === "done")?.due_date).toBe("2026-12-02");
    // Pre-birth still anchored to due date, not birth date.
    const pre = withBirth.find((t) => t.id === "pre")!;
    expect(pre.due_date).toBe(
      calculateTaskDates(pre, "2026-12-01", "recommended", {
        expectedDueDate: "2026-12-01",
      }).due_date,
    );
  });

  it("has a First Month template with five sections", () => {
    expect(AFTER_BIRTH_TEMPLATE.sections).toHaveLength(5);
    expect(countTemplateTasks(AFTER_BIRTH_TEMPLATE)).toBeGreaterThan(30);
  });
});

describe("timeline windows", () => {
  it("rejects heavy setup tasks in the final two weeks", () => {
    const issues = validateFinalTwoWeekTiming();
    expect(issues).toEqual([]);
    // Sanity: heavy tags exist on early tasks
    expect(
      (BEFORE_BABY_TASK_TIMING.hospital_birth_5.task_tags ?? []).some((t) =>
        HEAVY_SETUP_TAGS.includes(t),
      ),
    ).toBe(true);
    expect(BEFORE_BABY_TASK_TIMING.hospital_birth_5.recommended_due_offset_days!).toBeLessThan(
      -14,
    );
  });
});

describe("helpers and primary stages", () => {
  it("replaces universal helper with type templates", () => {
    const q = {
      why_it_matters: GENERIC_WHY_MARKERS[0],
      discussion_guidance: "Listen first, then look for the shared principle underneath the preference.",
      follow_up_prompts: ["x"],
      question_type: "values_clarification",
      categories: ["core_values"],
    } as Question;
    const helpers = helperForQuestion(q);
    expect(helpers.replaced).toBe(true);
    expect(helpers.why_it_matters).not.toContain(GENERIC_WHY_MARKERS[0]!);
  });

  it("assigns exactly one primary stage and filters later topics", () => {
    const teen = applyPrimaryStageToQuestion({
      short_title: "Social media rules",
      text: "What rules will apply to social media?",
      categories: ["technology"],
      subcategories: [],
      life_stages: ["teen", "preteen"],
      priority: "medium",
      required_before_birth: false,
    } as unknown as Question);
    expect(teen.primary_discussion_stage).toBeTruthy();
    expect(isInPregnancyWorkflow(teen)).toBe(false);

    const preg = inferPrimaryDiscussionStage({
      short_title: "Leave plan",
      text: "What does each parent’s leave plan look like?",
      categories: ["pregnancy"],
      subcategories: [],
      life_stages: ["pregnancy", "teen"],
      priority: "essential_before_birth",
      required_before_birth: true,
    } as unknown as Question);
    expect(preg.primary).toBe("pregnancy");
  });
});
