/**
 * Manual / inbox checklist capture — timing presets, category heuristics,
 * and similar-task suggestions. Extends the existing checklist system.
 */

import type {
  ChecklistRelativeTimingPreset,
  ChecklistTask,
} from "@/lib/types/models";
import { addDays, todayDateOnly } from "@/lib/checklists/date-math";
import { windowLabelForOffset } from "@/lib/checklists/default-timing";

/** Pregnancy week N → days before due date (40-week assumption). */
export function weeksBeforeDueFromPregnancyWeek(pregnancyWeek: number): number {
  return Math.max(0, 40 - pregnancyWeek);
}

export const MANUAL_CATEGORY_SUGGESTIONS = [
  { slug: "hospital", label: "Hospital" },
  { slug: "medical", label: "Medical" },
  { slug: "shopping", label: "Shopping" },
  { slug: "home", label: "Home" },
  { slug: "paperwork", label: "Paperwork" },
  { slug: "insurance", label: "Insurance" },
  { slug: "nursery", label: "Nursery" },
  { slug: "visitors", label: "Visitors" },
  { slug: "dog", label: "Dog" },
  { slug: "travel", label: "Travel" },
  { slug: "packing", label: "Packing" },
  { slug: "baby_gear", label: "Baby Gear" },
  { slug: "feeding", label: "Feeding" },
  { slug: "recovery", label: "Recovery" },
  { slug: "transportation", label: "Transportation" },
  { slug: "other", label: "Other" },
] as const;

export const EFFORT_OPTIONS = [
  { label: "5 min", minutes: 5 },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "Half day", minutes: 240 },
  { label: "Full day", minutes: 480 },
] as const;

export type RelativeTimingOption = {
  preset: ChecklistRelativeTimingPreset;
  label: string;
  /** Moves with due date when true. */
  recalculates: boolean;
};

export const RELATIVE_TIMING_OPTIONS: RelativeTimingOption[] = [
  { preset: "asap", label: "As soon as possible", recalculates: false },
  { preset: "this_week", label: "This week", recalculates: false },
  { preset: "next_week", label: "Next week", recalculates: false },
  { preset: "before_20_weeks", label: "Before 20 weeks", recalculates: true },
  { preset: "before_28_weeks", label: "Before 28 weeks", recalculates: true },
  { preset: "before_32_weeks", label: "Before 32 weeks", recalculates: true },
  { preset: "before_36_weeks", label: "Before 36 weeks", recalculates: true },
  { preset: "before_birth", label: "Before birth", recalculates: true },
  { preset: "after_birth", label: "After birth", recalculates: true },
  { preset: "choose_date", label: "Choose date", recalculates: false },
  { preset: "custom", label: "Custom", recalculates: false },
];

export type ResolvedManualTiming =
  | {
      kind: "relative";
      preset: ChecklistRelativeTimingPreset;
      label: string;
      timing:
        | { mode: "weeks_before"; weeks: number }
        | { mode: "days_before"; days: number }
        | { mode: "days_after"; days: number };
      absoluteDate: string | null;
    }
  | {
      kind: "absolute";
      preset: ChecklistRelativeTimingPreset;
      label: string;
      date: string;
    }
  | {
      kind: "none";
      preset: null;
      label: null;
    };

export function resolveManualTiming(
  preset: ChecklistRelativeTimingPreset | null | undefined,
  opts: {
    dueDate: string | null;
    chooseDate?: string | null;
    today?: string;
  },
): ResolvedManualTiming {
  if (!preset) return { kind: "none", preset: null, label: null };
  const today = opts.today ?? todayDateOnly();
  const label =
    RELATIVE_TIMING_OPTIONS.find((o) => o.preset === preset)?.label ?? preset;

  if (preset === "choose_date" || preset === "custom") {
    if (!opts.chooseDate) return { kind: "none", preset: null, label: null };
    return {
      kind: "absolute",
      preset,
      label: opts.chooseDate,
      date: opts.chooseDate,
    };
  }

  if (preset === "asap") {
    return {
      kind: "absolute",
      preset,
      label,
      date: today,
    };
  }
  if (preset === "this_week") {
    return {
      kind: "absolute",
      preset,
      label,
      date: addDays(today, 3),
    };
  }
  if (preset === "next_week") {
    return {
      kind: "absolute",
      preset,
      label,
      date: addDays(today, 10),
    };
  }

  // Pregnancy-relative — requires due date to compute absolute display date.
  let weeksBefore = 0;
  let daysAfter: number | null = null;
  if (preset === "before_20_weeks") weeksBefore = weeksBeforeDueFromPregnancyWeek(20);
  else if (preset === "before_28_weeks")
    weeksBefore = weeksBeforeDueFromPregnancyWeek(28);
  else if (preset === "before_32_weeks")
    weeksBefore = weeksBeforeDueFromPregnancyWeek(32);
  else if (preset === "before_36_weeks")
    weeksBefore = weeksBeforeDueFromPregnancyWeek(36);
  else if (preset === "before_birth") weeksBefore = 0;
  else if (preset === "after_birth") daysAfter = 7;

  if (daysAfter != null) {
    const absoluteDate = opts.dueDate ? addDays(opts.dueDate, daysAfter) : null;
    return {
      kind: "relative",
      preset,
      label,
      timing: { mode: "days_after", days: daysAfter },
      absoluteDate,
    };
  }

  const absoluteDate = opts.dueDate
    ? addDays(opts.dueDate, -(weeksBefore * 7))
    : null;
  return {
    kind: "relative",
    preset,
    label,
    timing:
      weeksBefore === 0
        ? { mode: "days_before", days: 0 }
        : { mode: "weeks_before", weeks: weeksBefore },
    absoluteDate,
  };
}

export function formatRelativeTimingDisplay(
  task: Pick<
    ChecklistTask,
    "relative_timing_label" | "relative_timing_preset" | "due_date"
  >,
): string | null {
  const label = task.relative_timing_label;
  if (!label && !task.due_date) return null;
  if (label && task.due_date) {
    return `${label} · ${task.due_date}`;
  }
  return label ?? task.due_date;
}

type CategorySuggestion = {
  slug: string;
  label: string;
  score: number;
};

const CATEGORY_KEYWORDS: Array<{
  slug: string;
  label: string;
  words: string[];
}> = [
  {
    slug: "hospital",
    label: "Hospital",
    words: ["hospital", "bag", "labor", "birth", "delivery", "ob ", "induction"],
  },
  {
    slug: "medical",
    label: "Medical",
    words: [
      "pediatrician",
      "doctor",
      "vaccine",
      "rsv",
      "ob",
      "midwife",
      "appointment",
      "blood",
    ],
  },
  {
    slug: "shopping",
    label: "Shopping",
    words: ["buy", "order", "purchase", "amazon", "diaper", "wipes", "cream"],
  },
  {
    slug: "baby_gear",
    label: "Baby Gear",
    words: [
      "car seat",
      "stroller",
      "bassinet",
      "crib",
      "monitor",
      "pump",
      "carrier",
      "gear",
    ],
  },
  {
    slug: "feeding",
    label: "Feeding",
    words: [
      "breast",
      "nipple",
      "formula",
      "bottle",
      "pump",
      "feeding",
      "nurse",
    ],
  },
  {
    slug: "nursery",
    label: "Nursery",
    words: ["nursery", "curtain", "blackout", "paint", "rocker", "glider"],
  },
  {
    slug: "home",
    label: "Home",
    words: ["install", "curtain", "clean", "organize", "house"],
  },
  {
    slug: "insurance",
    label: "Insurance",
    words: ["insurance", "claim", "coverage", "fsa", "hsa"],
  },
  {
    slug: "paperwork",
    label: "Paperwork",
    words: ["form", "paperwork", "will", "document", "register", "birth certificate"],
  },
  {
    slug: "packing",
    label: "Packing",
    words: ["pack", "bag", "snack", "charger", "outfit"],
  },
  {
    slug: "travel",
    label: "Travel",
    words: ["travel", "flight", "trip", "airport"],
  },
  {
    slug: "dog",
    label: "Dog",
    words: ["dog", "pet", "sitter"],
  },
  {
    slug: "visitors",
    label: "Visitors",
    words: ["visitor", "grandma", "grandpa", "guest", "family visit"],
  },
  {
    slug: "recovery",
    label: "Recovery",
    words: ["recovery", "postpartum", "pad", "mesh", "sitz"],
  },
  {
    slug: "transportation",
    label: "Transportation",
    words: ["car seat", "install", "drive", "uber", "car"],
  },
];

/** Lightweight keyword heuristics — never required. */
export function suggestCategoriesForTitle(title: string): CategorySuggestion[] {
  const t = title.toLowerCase();
  const scored: CategorySuggestion[] = [];
  for (const row of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const w of row.words) {
      if (t.includes(w)) score += w.includes(" ") ? 3 : 1;
    }
    if (score > 0) scored.push({ slug: row.slug, label: row.label, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export type SimilarTaskHit = {
  task: ChecklistTask;
  score: number;
};

/** Suggest merge candidates — never auto-merge. */
export function findSimilarChecklistTasks(
  title: string,
  existing: ChecklistTask[],
  opts?: { limit?: number; minScore?: number },
): SimilarTaskHit[] {
  const limit = opts?.limit ?? 3;
  const minScore = opts?.minScore ?? 0.45;
  const a = tokenize(title);
  if (a.size === 0) return [];
  const hits: SimilarTaskHit[] = [];
  for (const task of existing) {
    if (task.archived || task.completed) continue;
    const b = tokenize(task.title);
    if (b.size === 0) continue;
    let overlap = 0;
    for (const w of a) if (b.has(w)) overlap += 1;
    const score = overlap / Math.max(a.size, b.size);
    if (score >= minScore) hits.push({ task, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function isInboxTask(task: ChecklistTask): boolean {
  if (task.archived || task.completed) return false;
  if (task.inbox) return true;
  return (
    Boolean(task.is_custom) &&
    (task.owner === "unassigned" || !task.owner) &&
    (!task.due_date || task.date_source === "none") &&
    (task.category === "custom" || task.category === "inbox" || !task.category)
  );
}

export function taskOriginBadge(
  task: ChecklistTask,
): "Manual" | "Suggested" | "Essential" | null {
  if (task.is_custom || task.source === "manual" || task.source === "conversation" || task.source === "question") {
    return "Manual";
  }
  if (task.task_tags?.includes("confirm_with_provider")) return "Essential";
  if (task.is_default) return "Suggested";
  return null;
}

export function applyRelativeTimingMetadata(
  task: ChecklistTask,
  resolved: ResolvedManualTiming,
): ChecklistTask {
  if (resolved.kind === "none") {
    return {
      ...task,
      relative_timing_preset: null,
      relative_timing_label: null,
    };
  }
  const offset = task.recommended_due_offset_days ?? null;
  const timingType = task.timing_type ?? "before_birth";
  return {
    ...task,
    relative_timing_preset: resolved.preset,
    relative_timing_label: resolved.label,
    timing_window_label:
      offset != null
        ? windowLabelForOffset(offset, timingType)
        : task.timing_window_label,
  };
}
