import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import { diffDays, todayDateOnly } from "@/lib/checklists/date-math";
import {
  effectiveDueDate,
  getTimelineGroup,
} from "@/lib/checklists/scheduling";

export type DueDateStage =
  | "no_due_date"
  | "more_than_8_weeks"
  | "weeks_6_8"
  | "weeks_4_6"
  | "weeks_2_4"
  | "final_2_weeks"
  | "final_week"
  | "past_due";

export type AttentionGroupId =
  | "overdue"
  | "needs_attention_now"
  | "this_week"
  | "coming_next"
  | "recently_completed"
  | "still_worth_finishing"
  | "first_days"
  | "later";

export type AttentionTask = {
  task: ChecklistTask;
  group: AttentionGroupId;
  blocked: boolean;
  blockedReason: string | null;
};

export type BeforeBabyAttention = {
  today: string;
  dueDate: string | null;
  stage: DueDateStage;
  daysRemaining: number | null;
  postBirth: boolean;
  overdue: AttentionTask[];
  needsAttentionNow: AttentionTask[];
  thisWeek: AttentionTask[];
  comingNext: AttentionTask[];
  recentlyCompleted: ChecklistTask[];
  stillWorthFinishing: AttentionTask[];
  firstDays: AttentionTask[];
  later: AttentionTask[];
  summary: {
    headline: string;
    overdueCount: number;
    nowCount: number;
    thisWeekCount: number;
    comingNextCount: number;
    remainingBeforeBirth: number;
  };
};

export function dueDateStage(
  dueDate: string | null,
  today: string,
  actualBirthDate?: string | null,
): DueDateStage {
  if (actualBirthDate && actualBirthDate <= today) return "past_due";
  if (!dueDate) return "no_due_date";
  const days = diffDays(today, dueDate);
  if (days < 0) return "past_due";
  if (days <= 7) return "final_week";
  if (days <= 14) return "final_2_weeks";
  if (days <= 28) return "weeks_2_4";
  if (days <= 42) return "weeks_4_6";
  if (days <= 56) return "weeks_6_8";
  return "more_than_8_weeks";
}

function wrap(
  task: ChecklistTask,
  group: AttentionGroupId,
): AttentionTask {
  const blocked = task.dependency_status === "blocked";
  return {
    task,
    group,
    blocked,
    blockedReason: blocked ? task.dependency_reason ?? "Blocked by another task" : null,
  };
}

function sortByDue(a: ChecklistTask, b: ChecklistTask) {
  const da = effectiveDueDate(a) ?? "9999-12-31";
  const db = effectiveDueDate(b) ?? "9999-12-31";
  const pri = rankPriority(a) - rankPriority(b);
  if (pri !== 0) return pri;
  return da.localeCompare(db) || a.title.localeCompare(b.title);
}

function rankPriority(task: ChecklistTask) {
  if (task.priority === "critical") return 0;
  if (task.priority === "high") return 1;
  if (task.priority === "medium") return 2;
  return 3;
}

function startReached(task: ChecklistTask, today: string) {
  const start = task.calculated_start_date;
  return Boolean(start && start <= today);
}

function hardDeadlineSoon(task: ChecklistTask, today: string, dueDate: string | null) {
  if (task.hard_deadline_offset_days == null || !dueDate) return false;
  const due = effectiveDueDate(task);
  if (!due) return false;
  const days = diffDays(today, due);
  return days >= 0 && days <= 7;
}

/**
 * Canonical Before Baby attention list. Uses existing timeline groups and
 * scheduling fields — does not recompute dates.
 */
export function buildBeforeBabyAttention(input: {
  tasks: ChecklistTask[];
  settings: Pick<
    FamilySettings,
    | "expected_due_date"
    | "actual_birth_date"
    | "before_baby_max_tasks_per_week"
    | "before_baby_include_post_birth"
    | "before_baby_hide_completed"
  >;
  today?: string;
  comingNextLimit?: number;
}): BeforeBabyAttention {
  const today = input.today ?? todayDateOnly();
  const dueDate = input.settings.expected_due_date ?? null;
  const stage = dueDateStage(dueDate, today, input.settings.actual_birth_date);
  const postBirth = stage === "past_due";
  const maxNow = Math.max(3, input.settings.before_baby_max_tasks_per_week ?? 8);
  const comingNextLimit = input.comingNextLimit ?? 5;
  const includePost = input.settings.before_baby_include_post_birth !== false;

  const active = input.tasks.filter((t) => !t.archived);
  const open = active.filter((t) => !t.completed);
  const hideCompleted = Boolean(input.settings.before_baby_hide_completed);

  const grouped = (task: ChecklistTask) => getTimelineGroup(task, dueDate, today);

  const overdueTasks = open
    .filter((t) => grouped(t) === "overdue")
    .sort(sortByDue);

  const nowPool = open
    .filter((t) => {
      if (overdueTasks.some((o) => o.id === t.id)) return false;
      const g = grouped(t);
      if (g === "do_now") return true;
      if (t.provider_confirmation_needed && startReached(t, today)) return true;
      if (hardDeadlineSoon(t, today, dueDate)) return true;
      if (
        (t.priority === "high" || t.priority === "critical") &&
        (g === "due_this_week" || startReached(t, today))
      ) {
        return true;
      }
      return false;
    })
    .sort(sortByDue);

  const nowCapped = nowPool.slice(0, maxNow);
  const nowIds = new Set(nowCapped.map((t) => t.id));
  const overdueIds = new Set(overdueTasks.map((t) => t.id));

  const thisWeekTasks = open
    .filter((t) => {
      if (overdueIds.has(t.id) || nowIds.has(t.id)) return false;
      const g = grouped(t);
      return g === "due_this_week" || g === "do_now";
    })
    .sort(sortByDue);

  const comingPool = open
    .filter((t) => {
      if (overdueIds.has(t.id) || nowIds.has(t.id)) return false;
      if (thisWeekTasks.some((w) => w.id === t.id)) return false;
      const g = grouped(t);
      return (
        g === "due_next_week" ||
        g === "due_next_2_weeks" ||
        g === "final_week" ||
        g === "final_month" ||
        g === "later"
      );
    })
    .sort(sortByDue);

  const comingNext = comingPool.slice(0, comingNextLimit);

  const recentlyCompleted = hideCompleted
    ? []
    : active
        .filter((t) => t.completed)
        .sort((a, b) =>
          (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
        )
        .slice(0, 4);

  const afterBirthOpen = includePost
    ? open.filter((t) => t.timing_type === "after_birth").sort(sortByDue)
    : [];

  const stillWorth = postBirth
    ? open
        .filter(
          (t) =>
            t.timing_type !== "after_birth" &&
            (t.priority === "high" ||
              t.priority === "critical" ||
              grouped(t) === "overdue" ||
              grouped(t) === "do_now"),
        )
        .sort(sortByDue)
    : [];

  const laterPost = postBirth
    ? open
        .filter(
          (t) =>
            !stillWorth.some((s) => s.id === t.id) &&
            t.timing_type !== "after_birth",
        )
        .sort(sortByDue)
        .slice(0, 8)
    : [];

  const remainingBeforeBirth = open.filter(
    (t) => t.timing_type !== "after_birth",
  ).length;
  const daysRemaining =
    dueDate && !postBirth ? diffDays(today, dueDate) : postBirth ? 0 : null;

  const overdue = overdueTasks.map((t) => wrap(t, "overdue"));
  const needsAttentionNow = nowCapped.map((t) => wrap(t, "needs_attention_now"));
  const thisWeek = thisWeekTasks.map((t) => wrap(t, "this_week"));
  const coming = comingNext.map((t) => wrap(t, "coming_next"));

  return {
    today,
    dueDate,
    stage,
    daysRemaining,
    postBirth,
    overdue,
    needsAttentionNow,
    thisWeek,
    comingNext: coming,
    recentlyCompleted,
    stillWorthFinishing: stillWorth.map((t) => wrap(t, "still_worth_finishing")),
    firstDays: afterBirthOpen.map((t) => wrap(t, "first_days")),
    later: laterPost.map((t) => wrap(t, "later")),
    summary: {
      headline: attentionHeadline({
        stage,
        daysRemaining,
        dueDate,
        overdueCount: overdue.length,
        nowCount: needsAttentionNow.length,
        thisWeekCount: thisWeek.length,
        remainingBeforeBirth,
        postBirth,
      }),
      overdueCount: overdue.length,
      nowCount: needsAttentionNow.length,
      thisWeekCount: thisWeek.length,
      comingNextCount: coming.length,
      remainingBeforeBirth,
    },
  };
}

function attentionHeadline(input: {
  stage: DueDateStage;
  daysRemaining: number | null;
  dueDate: string | null;
  overdueCount: number;
  nowCount: number;
  thisWeekCount: number;
  remainingBeforeBirth: number;
  postBirth: boolean;
}): string {
  if (input.stage === "no_due_date") {
    return "Set a due date in Settings to place tasks on the timeline.";
  }
  if (input.postBirth) {
    return "Baby is here — finish what still matters, then First Month tasks.";
  }
  const weeks = input.daysRemaining != null ? Math.ceil(input.daysRemaining / 7) : null;
  if (input.stage === "final_week") {
    return `Final week · ${input.remainingBeforeBirth} task${input.remainingBeforeBirth === 1 ? "" : "s"} left before delivery`;
  }
  if (input.stage === "final_2_weeks" || input.stage === "weeks_2_4") {
    return `Final month · ${input.remainingBeforeBirth} task${input.remainingBeforeBirth === 1 ? "" : "s"} should be finished before delivery`;
  }
  if (weeks != null) {
    return `${weeks} week${weeks === 1 ? "" : "s"} until due date`;
  }
  return "Before Baby checklist";
}

export function attentionTaskIds(attention: BeforeBabyAttention): string[] {
  const ids = new Set<string>();
  for (const row of [
    ...attention.overdue,
    ...attention.needsAttentionNow,
    ...attention.thisWeek,
  ]) {
    ids.add(row.task.id);
  }
  return [...ids];
}
