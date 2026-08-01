import { describe, expect, it } from "vitest";
import { buildTasksFromTemplate } from "@/lib/services/checklists";
import {
  applyMaxTasksPerWeek,
  applyScheduleToTasks,
  calculateTaskDates,
} from "@/lib/checklists/scheduling";
import {
  validateScheduledTasks,
  validateTemplateTiming,
} from "@/lib/checklists/validate-timing";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import seedQuestions from "@/data/seed/questions.json";
import {
  matchEssentialQuestion,
  selectEssentialPrimaryQuestions,
  BEFORE_BIRTH_ESSENTIAL_MODULES,
} from "@/lib/content/before-birth-essentials";
import { classifyTopics } from "@/lib/content-review/topics";
import { buildContentUpgradePreview } from "@/lib/content/upgrade";

const baseSettings: FamilySettings = {
  family_id: "family_turner",
  hide_partner_answers_until_both_saved: true,
  dark_mode: "system",
  babymoon_target_date: null,
  babymoon_daily_questions: 3,
  include_perspective_history_in_playbook: true,
  expected_due_date: "2026-12-15",
  before_baby_scheduling_mode: "recommended",
  before_baby_preferred_task_days: [1, 2, 3, 4, 5],
  before_baby_max_tasks_per_week: 8,
  before_baby_weekend_heavy: false,
  before_baby_include_post_birth: true,
  before_baby_hide_completed: false,
  before_baby_avoid_travel_dates: [],
  updated_at: "2026-08-01T12:00:00.000Z",
};

describe("Before Baby date engine fixes", () => {
  it("has no pre-birth positive offsets in template timing", () => {
    expect(validateTemplateTiming()).toEqual([]);
  });

  it("never schedules pre-birth tasks after due date even with tight weekly caps", () => {
    const built = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    const scheduled = applyScheduleToTasks(built, {
      ...baseSettings,
      before_baby_max_tasks_per_week: 3,
    });
    const preBirth = scheduled.filter((t) => t.timing_type === "before_birth");
    expect(preBirth.length).toBeGreaterThan(50);
    for (const task of preBirth) {
      if (!task.calculated_due_date) continue;
      expect(task.calculated_due_date <= "2026-12-15").toBe(true);
    }
    expect(validateScheduledTasks(scheduled, "2026-12-15")).toEqual([]);
  });

  it("preserves manual dates while recalculating others", () => {
    const built = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    const withManual: ChecklistTask[] = built.map((t, i) =>
      i === 0
        ? {
            ...t,
            date_source: "manual",
            manual_due_date: "2026-10-01",
            due_date: "2026-10-01",
          }
        : t,
    );
    const scheduled = applyScheduleToTasks(withManual, baseSettings);
    expect(scheduled[0].due_date).toBe("2026-10-01");
    expect(scheduled[0].date_source).toBe("manual");
  });

  it("clamps snapped pre-birth dates to due date", () => {
    const task = buildTasksFromTemplate("clist_1", "before-baby", new Set()).find(
      (t) => t.template_task_slug === "home_6",
    )!;
    const calc = calculateTaskDates(task, "2026-12-15", "recommended", {
      preferredDays: [0, 6],
      weekendHeavy: true,
      avoidDates: [],
    });
    expect(calc.calculated_due_date).toBeTruthy();
    expect(calc.calculated_due_date! <= "2026-12-15").toBe(true);
  });

  it("moves overflow earlier rather than past birth", () => {
    const built = buildTasksFromTemplate("clist_1", "before-baby", new Set());
    const firstPass = applyScheduleToTasks(built, {
      ...baseSettings,
      before_baby_max_tasks_per_week: 0,
    });
    // Force many into one week then spread with cap
    const piled = firstPass.map((t) =>
      t.timing_type === "before_birth" && t.calculated_due_date
        ? {
            ...t,
            calculated_due_date: "2026-12-10",
            due_date: "2026-12-10",
            date_source: "calculated" as const,
            timing_flexibility: "flexible" as const,
          }
        : t,
    );
    const spread = applyMaxTasksPerWeek(piled, 5, "2026-12-15");
    for (const t of spread) {
      if (t.timing_type === "before_birth" && t.calculated_due_date) {
        expect(t.calculated_due_date <= "2026-12-15").toBe(true);
      }
    }
  });
});

describe("Question title and essentials content", () => {
  it("has no active seeded titles with stored ellipsis", () => {
    const bad = seedQuestions.filter(
      (q) =>
        q.active !== false &&
        (String(q.short_title).includes("…") ||
          String(q.short_title).includes("...")),
    );
    expect(bad).toEqual([]);
  });

  it("matches Before Birth Essentials modules", () => {
    const matched = seedQuestions.filter((q) => matchEssentialQuestion(q as never));
    expect(matched.length).toBeGreaterThan(15);
    expect(BEFORE_BIRTH_ESSENTIAL_MODULES.length).toBe(7);
    const primary = selectEssentialPrimaryQuestions(
      seedQuestions.map((q) => ({
        ...q,
        active: true,
        logical_order: q.logical_order ?? 0,
      })) as never,
    );
    expect(primary.length).toBeGreaterThanOrEqual(20);
    expect(primary.length).toBeLessThanOrEqual(35);
  });

  it("avoids loose topic false matches for common words", () => {
    const pets = classifyTopics("What will our family values be at home?");
    expect(pets.primary_topic).not.toBe("pets");
    expect(pets.secondary_topics).not.toContain("pets");
    const wills = classifyTopics("What will bedtime look like?");
    expect(wills.primary_topic).not.toBe("wills_and_guardianship");
  });

  it("builds a content upgrade preview that preserves answers", () => {
    const storeQuestions = seedQuestions.slice(0, 20).map((q) => ({
      ...q,
      short_title: q.text.slice(0, 20) + "…",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }));
    const preview = buildContentUpgradePreview({
      questions: storeQuestions,
      checklist_tasks: [],
      answers: [],
    } as never);
    expect(preview.summary.questions_retitled).toBeGreaterThan(0);
    expect(
      preview.changes.every((c) => c.data_preserved.includes("answers") || c.entity_type === "checklist_task"),
    ).toBe(true);
  });
});
