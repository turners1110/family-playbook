/**
 * Before Baby due-date scheduling engine.
 * Calculates, groups, and sorts tasks from expected_due_date + preferences.
 */
import {
  addDays,
  dayOfWeek,
  diffDays,
  endOfWeekSunday,
  formatShortDate,
  isDateOnly,
  startOfWeekMonday,
  todayDateOnly,
} from "@/lib/checklists/date-math";
import { getDefaultTimingForTask } from "@/lib/checklists/default-timing";
import type {
  BeforeBabySchedulingMode,
  ChecklistDateSource,
  ChecklistTask,
  ChecklistTimelineBadge,
  ChecklistTimelineGroup,
  ChecklistTimingFlexibility,
  ChecklistTimingType,
  FamilySettings,
} from "@/lib/types/models";

export type NormalizedSchedulingSettings = {
  expected_due_date: string | null;
  before_baby_scheduling_mode: BeforeBabySchedulingMode;
  before_baby_preferred_task_days: number[];
  before_baby_max_tasks_per_week: number | null;
  before_baby_weekend_heavy: boolean;
  before_baby_include_post_birth: boolean;
  before_baby_hide_completed: boolean;
  before_baby_avoid_travel_dates: string[];
};

export const DEFAULT_SCHEDULING_SETTINGS: NormalizedSchedulingSettings = {
  expected_due_date: null,
  before_baby_scheduling_mode: "recommended",
  before_baby_preferred_task_days: [1, 2, 3, 4, 5],
  before_baby_max_tasks_per_week: 8,
  before_baby_weekend_heavy: false,
  before_baby_include_post_birth: true,
  before_baby_hide_completed: false,
  before_baby_avoid_travel_dates: [],
};

export function normalizeSchedulingSettings(
  settings: Partial<FamilySettings> | null | undefined,
): NormalizedSchedulingSettings {
  return {
    expected_due_date: settings?.expected_due_date ?? null,
    before_baby_scheduling_mode:
      settings?.before_baby_scheduling_mode ?? "recommended",
    before_baby_preferred_task_days:
      settings?.before_baby_preferred_task_days?.length
        ? settings.before_baby_preferred_task_days
        : DEFAULT_SCHEDULING_SETTINGS.before_baby_preferred_task_days,
    before_baby_max_tasks_per_week:
      settings?.before_baby_max_tasks_per_week ??
      DEFAULT_SCHEDULING_SETTINGS.before_baby_max_tasks_per_week,
    before_baby_weekend_heavy: Boolean(settings?.before_baby_weekend_heavy),
    before_baby_include_post_birth:
      settings?.before_baby_include_post_birth !== false,
    before_baby_hide_completed: Boolean(settings?.before_baby_hide_completed),
    before_baby_avoid_travel_dates: settings?.before_baby_avoid_travel_dates ?? [],
  };
}

export function ensureTaskTimingFields(task: ChecklistTask): ChecklistTask {
  const defaults = getDefaultTimingForTask(
    task.template_task_slug,
    task.category,
  );
  return {
    ...task,
    recommended_start_offset_days:
      task.recommended_start_offset_days ?? defaults.recommended_start_offset_days,
    recommended_due_offset_days:
      task.recommended_due_offset_days ?? defaults.recommended_due_offset_days,
    hard_deadline_offset_days:
      task.hard_deadline_offset_days ?? defaults.hard_deadline_offset_days,
    timing_reason: task.timing_reason ?? defaults.timing_reason,
    timing_flexibility: task.timing_flexibility ?? defaults.timing_flexibility,
    timing_type: task.timing_type ?? defaults.timing_type,
    manual_due_date: task.manual_due_date ?? null,
    calculated_due_date: task.calculated_due_date ?? null,
    calculated_start_date: task.calculated_start_date ?? null,
    date_source: task.date_source ?? (task.due_date ? "manual" : "none"),
  };
}

function modeAdjustedOffset(
  offset: number | null | undefined,
  mode: BeforeBabySchedulingMode,
  flexibility: ChecklistTimingFlexibility,
): number | null {
  if (offset == null) return null;
  if (mode === "manual_only") return null;
  if (flexibility === "fixed") return offset;
  if (mode === "earlier") {
    // Move flexible/optional tasks ~14 days earlier (more negative before birth).
    if (offset <= 0) return offset - 14;
    return Math.max(1, offset - 7);
  }
  if (mode === "compact") {
    // Pull flexible tasks closer to birth / into fewer weeks.
    if (offset <= -60) return Math.round(offset * 0.7);
    if (offset < 0) return Math.max(offset, -21);
    return offset;
  }
  return offset;
}

function snapToPreferredDay(
  dateOnly: string,
  preferredDays: number[],
  weekendHeavy: boolean,
  avoid: Set<string>,
): string {
  const preferred = weekendHeavy
    ? [...new Set([0, 6, ...preferredDays])]
    : preferredDays.length
      ? preferredDays
      : [1, 2, 3, 4, 5];

  for (let i = 0; i < 14; i += 1) {
    const candidate = addDays(dateOnly, i === 0 ? 0 : i);
    if (avoid.has(candidate)) continue;
    if (preferred.includes(dayOfWeek(candidate))) return candidate;
  }
  // Fall back: first non-travel day
  for (let i = 0; i < 21; i += 1) {
    const candidate = addDays(dateOnly, i);
    if (!avoid.has(candidate)) return candidate;
  }
  return dateOnly;
}

export type CalculatedTaskDates = {
  calculated_start_date: string | null;
  calculated_due_date: string | null;
  due_date: string | null;
  date_source: ChecklistDateSource;
};

/**
 * Calculate dates for one task. Manual dates are never overwritten.
 */
export function calculateTaskDates(
  task: ChecklistTask,
  dueDate: string | null,
  mode: BeforeBabySchedulingMode,
  prefs?: {
    preferredDays?: number[];
    weekendHeavy?: boolean;
    avoidDates?: string[];
  },
): CalculatedTaskDates {
  const timed = ensureTaskTimingFields(task);

  if (timed.date_source === "manual" || timed.manual_due_date) {
    const manual = timed.manual_due_date || timed.due_date || null;
    return {
      calculated_start_date: timed.calculated_start_date ?? null,
      calculated_due_date: timed.calculated_due_date ?? null,
      due_date: manual,
      date_source: "manual",
    };
  }

  if (mode === "manual_only" || !dueDate || !isDateOnly(dueDate)) {
    return {
      calculated_start_date: null,
      calculated_due_date: null,
      due_date: timed.due_date,
      date_source: timed.due_date ? timed.date_source ?? "none" : "none",
    };
  }

  if (
    timed.timing_type === "no_date" ||
    timed.recommended_due_offset_days == null
  ) {
    return {
      calculated_start_date: null,
      calculated_due_date: null,
      due_date: null,
      date_source: "none",
    };
  }

  const flex = timed.timing_flexibility ?? "flexible";
  const dueOffset = modeAdjustedOffset(
    timed.recommended_due_offset_days,
    mode,
    flex,
  );
  const startOffset = modeAdjustedOffset(
    timed.recommended_start_offset_days,
    mode,
    flex,
  );

  if (dueOffset == null) {
    return {
      calculated_start_date: null,
      calculated_due_date: null,
      due_date: null,
      date_source: "none",
    };
  }

  let calcDue = addDays(dueDate, dueOffset);
  let calcStart =
    startOffset != null ? addDays(dueDate, startOffset) : null;

  const avoid = new Set(prefs?.avoidDates ?? []);
  const preferredDays =
    prefs?.preferredDays ?? DEFAULT_SCHEDULING_SETTINGS.before_baby_preferred_task_days;
  if (flex !== "fixed") {
    calcDue = snapToPreferredDay(
      calcDue,
      preferredDays,
      Boolean(prefs?.weekendHeavy),
      avoid,
    );
    if (calcStart) {
      calcStart = snapToPreferredDay(
        calcStart,
        preferredDays,
        Boolean(prefs?.weekendHeavy),
        avoid,
      );
      if (calcStart > calcDue) calcStart = calcDue;
    }
  }

  return {
    calculated_start_date: calcStart,
    calculated_due_date: calcDue,
    due_date: calcDue,
    date_source: "calculated",
  };
}

/**
 * Spread flexible tasks so weeks respect max_tasks_per_week.
 * Mutates calculated due dates for flexible calculated tasks only.
 */
export function applyMaxTasksPerWeek(
  tasks: ChecklistTask[],
  maxPerWeek: number | null,
): ChecklistTask[] {
  if (!maxPerWeek || maxPerWeek < 1) return tasks;

  const byWeek = new Map<string, ChecklistTask[]>();
  for (const task of tasks) {
    if (
      task.completed ||
      task.date_source === "manual" ||
      task.timing_flexibility === "fixed" ||
      !task.calculated_due_date
    ) {
      continue;
    }
    const week = startOfWeekMonday(task.calculated_due_date);
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week)!.push(task);
  }

  const result = tasks.map((t) => ({ ...t }));
  const byId = new Map(result.map((t) => [t.id, t]));

  const weeks = [...byWeek.keys()].sort();
  for (const week of weeks) {
    const bucket = byWeek.get(week)!;
    if (bucket.length <= maxPerWeek) continue;
    // Keep highest priority / earliest; push overflow to following weeks.
    bucket.sort(
      (a, b) =>
        priorityRank(a) - priorityRank(b) ||
        (a.calculated_due_date ?? "").localeCompare(b.calculated_due_date ?? ""),
    );
    const overflow = bucket.slice(maxPerWeek);
    let cursor = addDays(week, 7);
    for (const task of overflow) {
      const live = byId.get(task.id);
      if (!live) continue;
      // Find a week with capacity
      for (let guard = 0; guard < 26; guard += 1) {
        const key = startOfWeekMonday(cursor);
        const existing = result.filter(
          (t) =>
            t.calculated_due_date &&
            startOfWeekMonday(t.calculated_due_date) === key &&
            t.date_source === "calculated",
        );
        if (existing.length < maxPerWeek) {
          live.calculated_due_date = cursor;
          live.due_date = cursor;
          if (live.calculated_start_date && live.calculated_start_date > cursor) {
            live.calculated_start_date = cursor;
          }
          cursor = addDays(cursor, 1);
          break;
        }
        cursor = addDays(key, 7);
      }
    }
  }

  return result;
}

function priorityRank(task: ChecklistTask): number {
  return task.priority === "high" ? 0 : task.priority === "medium" ? 1 : 2;
}

export function applyScheduleToTasks(
  tasks: ChecklistTask[],
  settings: Partial<FamilySettings>,
): ChecklistTask[] {
  const prefs = normalizeSchedulingSettings(settings);
  const dueDate = prefs.expected_due_date;

  let next: ChecklistTask[] = tasks.map((task) => {
    const timed = ensureTaskTimingFields(task);
    const calc = calculateTaskDates(
      timed,
      dueDate,
      prefs.before_baby_scheduling_mode,
      {
        preferredDays: prefs.before_baby_preferred_task_days,
        weekendHeavy: prefs.before_baby_weekend_heavy,
        avoidDates: prefs.before_baby_avoid_travel_dates,
      },
    );
    return {
      ...timed,
      ...calc,
    };
  });

  next = applyMaxTasksPerWeek(next, prefs.before_baby_max_tasks_per_week);
  return next;
}

export function effectiveDueDate(task: ChecklistTask): string | null {
  if (task.date_source === "manual" && task.manual_due_date) {
    return task.manual_due_date;
  }
  return task.due_date ?? task.calculated_due_date ?? task.manual_due_date ?? null;
}

export function getTimelineBadge(
  task: ChecklistTask,
  dueDate: string | null,
  today = todayDateOnly(),
): ChecklistTimelineBadge {
  if (task.completed) return "completed";
  if (task.timing_type === "after_birth") return "after_birth";
  const due = effectiveDueDate(task);
  if (!due) return "no_date";
  if (due < today) return "overdue";

  const weekEnd = endOfWeekSunday(today);
  if (due <= weekEnd) return "do_now";

  if (dueDate && isDateOnly(dueDate)) {
    const daysToBirth = diffDays(today, dueDate);
    const daysTaskToBirth = diffDays(due, dueDate);
    if (daysToBirth <= 7 && daysTaskToBirth <= 7 && daysTaskToBirth >= 0) {
      return "final_week";
    }
    if (daysToBirth <= 30 && daysTaskToBirth <= 30 && daysTaskToBirth >= 0) {
      return "final_month";
    }
  }

  const nextWeekEnd = endOfWeekSunday(addDays(today, 7));
  if (due <= nextWeekEnd) return "due_this_week";
  return "upcoming";
}

export function getTimelineGroup(
  task: ChecklistTask,
  dueDate: string | null,
  today = todayDateOnly(),
): ChecklistTimelineGroup {
  if (task.completed) return "completed";
  if (task.timing_type === "after_birth") return "after_birth";
  const due = effectiveDueDate(task);
  if (!due) return "no_date";
  if (due < today) return "overdue";

  const thisWeekEnd = endOfWeekSunday(today);
  if (due <= thisWeekEnd) {
    // Do now = due within 3 days or overdue window already handled
    if (diffDays(today, due) <= 3) return "do_now";
    return "due_this_week";
  }

  const nextWeekStart = addDays(thisWeekEnd, 1);
  const nextWeekEnd = endOfWeekSunday(nextWeekStart);
  if (due <= nextWeekEnd) return "due_next_week";

  const twoWeekEnd = addDays(today, 14);
  if (due <= twoWeekEnd) return "due_next_2_weeks";

  if (dueDate && isDateOnly(dueDate)) {
    const daysTaskToBirth = diffDays(due, dueDate);
    if (daysTaskToBirth >= 0 && daysTaskToBirth <= 7) return "final_week";
    if (daysTaskToBirth >= 0 && daysTaskToBirth <= 30) return "final_month";
  }

  return "later";
}

const GROUP_ORDER: ChecklistTimelineGroup[] = [
  "overdue",
  "do_now",
  "due_this_week",
  "due_next_week",
  "due_next_2_weeks",
  "final_month",
  "final_week",
  "later",
  "after_birth",
  "no_date",
  "completed",
];

export const TIMELINE_GROUP_LABELS: Record<ChecklistTimelineGroup, string> = {
  overdue: "Overdue",
  do_now: "Do now",
  due_this_week: "Due this week",
  due_next_week: "Due next week",
  due_next_2_weeks: "Due in next 2 weeks",
  final_month: "Final month",
  final_week: "Final week",
  later: "Later",
  after_birth: "After birth",
  no_date: "No date",
  completed: "Completed",
};

export const TIMELINE_BADGE_LABELS: Record<ChecklistTimelineBadge, string> = {
  overdue: "Overdue",
  do_now: "Do now",
  due_this_week: "Due this week",
  upcoming: "Upcoming",
  final_month: "Final month",
  final_week: "Final week",
  after_birth: "After birth",
  no_date: "No date",
  completed: "Completed",
};

export function compareScheduledTasks(
  a: ChecklistTask,
  b: ChecklistTask,
  dueDate: string | null,
  today = todayDateOnly(),
): number {
  const ga = GROUP_ORDER.indexOf(getTimelineGroup(a, dueDate, today));
  const gb = GROUP_ORDER.indexOf(getTimelineGroup(b, dueDate, today));
  if (ga !== gb) return ga - gb;
  if (priorityRank(a) !== priorityRank(b)) return priorityRank(a) - priorityRank(b);
  const da = effectiveDueDate(a) ?? "9999-99-99";
  const db = effectiveDueDate(b) ?? "9999-99-99";
  if (da !== db) return da.localeCompare(db);
  // Unassigned (both) before assigned single owners
  const oa = a.owner === "both" ? 0 : 1;
  const ob = b.owner === "both" ? 0 : 1;
  if (oa !== ob) return oa - ob;
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
}

export function sortTasksForTimeline(
  tasks: ChecklistTask[],
  dueDate: string | null,
  today = todayDateOnly(),
): ChecklistTask[] {
  return [...tasks].sort((a, b) => compareScheduledTasks(a, b, dueDate, today));
}

export function groupTasksForTimeline(
  tasks: ChecklistTask[],
  dueDate: string | null,
  today = todayDateOnly(),
): Array<{ group: ChecklistTimelineGroup; label: string; tasks: ChecklistTask[] }> {
  const sorted = sortTasksForTimeline(tasks, dueDate, today);
  const map = new Map<ChecklistTimelineGroup, ChecklistTask[]>();
  for (const task of sorted) {
    const g = getTimelineGroup(task, dueDate, today);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(task);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((group) => ({
    group,
    label: TIMELINE_GROUP_LABELS[group],
    tasks: map.get(group)!,
  }));
}

export type TimelineView =
  | "recommended"
  | "do_now"
  | "this_week"
  | "next_week"
  | "next_2_weeks"
  | "final_month"
  | "final_week"
  | "after_birth"
  | "overdue"
  | "by_week"
  | "by_month"
  | "by_category"
  | "by_owner"
  | "all";

export function filterTasksByView(
  tasks: ChecklistTask[],
  view: TimelineView,
  dueDate: string | null,
  options?: {
    includePostBirth?: boolean;
    hideCompleted?: boolean;
    today?: string;
  },
): ChecklistTask[] {
  const today = options?.today ?? todayDateOnly();
  let list = tasks.filter((t) => !t.archived);
  if (options?.hideCompleted) list = list.filter((t) => !t.completed);
  if (options?.includePostBirth === false) {
    list = list.filter((t) => t.timing_type !== "after_birth");
  }

  const inGroup = (g: ChecklistTimelineGroup) =>
    list.filter((t) => getTimelineGroup(t, dueDate, today) === g);

  switch (view) {
    case "do_now":
      return [...inGroup("overdue"), ...inGroup("do_now")];
    case "this_week":
      return [...inGroup("do_now"), ...inGroup("due_this_week")];
    case "next_week":
      return inGroup("due_next_week");
    case "next_2_weeks":
      return [
        ...inGroup("do_now"),
        ...inGroup("due_this_week"),
        ...inGroup("due_next_week"),
        ...inGroup("due_next_2_weeks"),
      ];
    case "final_month":
      return inGroup("final_month");
    case "final_week":
      return inGroup("final_week");
    case "after_birth":
      return inGroup("after_birth");
    case "overdue":
      return inGroup("overdue");
    case "recommended":
    case "all":
    case "by_week":
    case "by_month":
    case "by_category":
    case "by_owner":
    default:
      return sortTasksForTimeline(list, dueDate, today);
  }
}

export function recommendedByLabel(task: ChecklistTask): string | null {
  const due = effectiveDueDate(task);
  if (!due) return null;
  return `Recommended by ${formatShortDate(due)}`;
}

export type DueDateChangePreview = {
  moving: number;
  manualKept: number;
  samples: Array<{ id: string; title: string; from: string | null; to: string | null }>;
};

export function previewDueDateChange(
  tasks: ChecklistTask[],
  settings: Partial<FamilySettings>,
  newDueDate: string,
): DueDateChangePreview {
  const nextSettings = { ...settings, expected_due_date: newDueDate };
  const recalculated = applyScheduleToTasks(tasks, nextSettings);
  let moving = 0;
  let manualKept = 0;
  const samples: DueDateChangePreview["samples"] = [];

  for (let i = 0; i < tasks.length; i += 1) {
    const before = effectiveDueDate(tasks[i]);
    const after = effectiveDueDate(recalculated[i]);
    if (tasks[i].date_source === "manual" || tasks[i].manual_due_date) {
      manualKept += 1;
      continue;
    }
    if (before !== after) {
      moving += 1;
      if (samples.length < 8) {
        samples.push({
          id: tasks[i].id,
          title: tasks[i].title,
          from: before,
          to: after,
        });
      }
    }
  }

  return { moving, manualKept, samples };
}

export function setManualTaskTiming(
  task: ChecklistTask,
  input:
    | { mode: "exact"; date: string }
    | { mode: "weeks_before"; weeks: number }
    | { mode: "days_before"; days: number }
    | { mode: "days_after"; days: number }
    | { mode: "remove" },
  dueDate: string | null,
): ChecklistTask {
  const timed = ensureTaskTimingFields(task);
  if (input.mode === "remove") {
    return {
    ...timed,
    timing_type: timed.timing_type === "exact_date" ? "no_date" : timed.timing_type,
    manual_due_date: null,
    due_date: timed.calculated_due_date ?? null,
    date_source: timed.calculated_due_date ? "calculated" : "none",
  };
  }
  if (input.mode === "exact") {
    return {
      ...timed,
      manual_due_date: input.date,
      due_date: input.date,
      date_source: "manual",
      timing_type: "exact_date",
      recommended_due_offset_days: null,
    };
  }
  if (!dueDate) {
    throw new Error("Set the expected due date before using relative timing.");
  }
  if (input.mode === "weeks_before") {
    const offset = -(input.weeks * 7);
    const date = addDays(dueDate, offset);
    return {
      ...timed,
      timing_type: "before_birth",
      timing_flexibility: "fixed",
      recommended_due_offset_days: offset,
      recommended_start_offset_days: offset - 14,
      manual_due_date: null,
      date_source: "calculated",
      calculated_due_date: date,
      due_date: date,
    };
  }
  if (input.mode === "days_before") {
    const offset = -input.days;
    const date = addDays(dueDate, offset);
    return {
      ...timed,
      timing_type: "before_birth",
      timing_flexibility: "fixed",
      recommended_due_offset_days: offset,
      manual_due_date: null,
      date_source: "calculated",
      calculated_due_date: date,
      due_date: date,
    };
  }
  // days_after
  const offset = input.days;
  const date = addDays(dueDate, offset);
  return {
    ...timed,
    timing_type: "after_birth",
    timing_flexibility: "fixed",
    recommended_due_offset_days: offset,
    manual_due_date: null,
    date_source: "calculated",
    calculated_due_date: date,
    due_date: date,
  };
}

export type TimingType = ChecklistTimingType;
export type TimingFlexibility = ChecklistTimingFlexibility;
export type DateSource = ChecklistDateSource;
