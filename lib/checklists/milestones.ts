/**
 * Checklist milestones: group related template tasks into progress-tracked units.
 * Existing task IDs remain stable; milestones are a view/grouping layer.
 */

import type { ChecklistOwner, ChecklistTask } from "@/lib/types/models";
import { formatShortDate } from "@/lib/checklists/date-math";
import { effectiveDueDate } from "@/lib/checklists/scheduling";

export type ChecklistMilestoneDef = {
  id: string;
  title: string;
  description: string;
  category: string;
  step_slugs: string[];
  target_offset_days: number;
  timing_reason: string;
  suggested_primary_owner?: ChecklistOwner;
  suggested_contributor?: ChecklistOwner | null;
};

export const BEFORE_BABY_MILESTONES: ChecklistMilestoneDef[] = [
  {
    id: "ms_car_seat",
    title: "Prepare infant car seat",
    description:
      "Select, install, and verify the infant car seat before the final weeks.",
    category: "hospital_birth",
    step_slugs: [
      "baby_gear_1",
      "hospital_birth_5",
      "hospital_birth_6",
      "final_week_4",
    ],
    target_offset_days: -35,
    timing_reason:
      "Completing by ~34 weeks leaves time for inspection help or replacement.",
    suggested_primary_owner: "sam",
    suggested_contributor: "michelle",
  },
  {
    id: "ms_pediatrician",
    title: "Choose and prepare pediatrician",
    description:
      "Shortlist, choose, save contacts, and confirm the newborn visit process.",
    category: "medical",
    step_slugs: [
      "medical_1",
      "hospital_birth_11",
      "medical_7",
      "medical_2",
      "final_week_9",
    ],
    target_offset_days: -60,
    timing_reason: "Selecting early leaves time to interview another practice.",
    suggested_primary_owner: "michelle",
    suggested_contributor: "sam",
  },
  {
    id: "ms_hospital_registration",
    title: "Complete hospital registration",
    description:
      "Choose the hospital, submit registration, and confirm acceptance.",
    category: "hospital_birth",
    step_slugs: [
      "hospital_birth_1",
      "hospital_birth_2",
      "paperwork_9",
      "hospital_birth_12",
      "hospital_birth_13",
    ],
    target_offset_days: -60,
    timing_reason: "Registration and insurance checks need provider lead time.",
    suggested_primary_owner: "michelle",
    suggested_contributor: "sam",
  },
  {
    id: "ms_hospital_bags",
    title: "Prepare hospital bags",
    description: "Pack both bags, documents, chargers, and place near exit.",
    category: "hospital_birth",
    step_slugs: [
      "hospital_birth_7",
      "hospital_birth_8",
      "hospital_birth_9",
      "final_week_5",
    ],
    target_offset_days: -21,
    timing_reason: "Pack early; move bags to the car in the final week.",
    suggested_primary_owner: "michelle",
    suggested_contributor: "sam",
  },
  {
    id: "ms_safe_sleep",
    title: "Prepare safe sleep space",
    description:
      "Assemble sleep space, fitted sheets, clear hazards, and final check.",
    category: "home",
    step_slugs: [
      "home_2",
      "home_1",
      "home_7",
      "home_extra_1",
      "home_3",
      "home_extra_2",
    ],
    target_offset_days: -35,
    timing_reason: "Safe sleep setup should be ready by ~34 weeks.",
    suggested_primary_owner: "sam",
    suggested_contributor: "michelle",
  },
  {
    id: "ms_feeding_area",
    title: "Prepare feeding area",
    description: "Supplies, station setup, and backup feeding plan.",
    category: "home",
    step_slugs: ["home_11", "baby_gear_15", "baby_gear_20", "baby_gear_18"],
    target_offset_days: -28,
    timing_reason: "Feeding setup before the final two weeks reduces day-one stress.",
    suggested_primary_owner: "michelle",
    suggested_contributor: "sam",
  },
  {
    id: "ms_lulu",
    title: "Prepare Lulu",
    description:
      "Sitters, care instructions, practice walks, boundaries, and labor plan.",
    category: "pets",
    step_slugs: [
      "pets_1",
      "lulu_extra_1",
      "lulu_extra_2",
      "lulu_extra_3",
      "pets_2",
      "lulu_extra_4",
      "lulu_extra_5",
      "lulu_extra_6",
    ],
    target_offset_days: -30,
    timing_reason: "Lulu needs practice time before labor day.",
    suggested_primary_owner: "sam",
    suggested_contributor: "michelle",
  },
  {
    id: "ms_legal_financial",
    title: "Complete legal and financial preparation",
    description:
      "Insurance, guardians, will, beneficiaries, budget, and education savings.",
    category: "financial",
    step_slugs: [
      "paperwork_4",
      "paperwork_8",
      "paperwork_6",
      "legal_extra_1",
      "paperwork_5",
      "financial_1",
      "legal_extra_4",
      "legal_extra_2",
    ],
    target_offset_days: -60,
    timing_reason: "Legal and financial work belongs in the second trimester / early third.",
    suggested_primary_owner: "both",
    suggested_contributor: null,
  },
];

export function milestoneProgress(
  milestone: ChecklistMilestoneDef,
  tasksBySlug: Map<string, { completed: boolean }>,
): { complete: number; total: number; percent: number } {
  const steps = milestone.step_slugs
    .map((slug) => tasksBySlug.get(slug))
    .filter(Boolean);
  const total = milestone.step_slugs.length;
  const complete = steps.filter((s) => s?.completed).length;
  const present = steps.length;
  const denom = present || total;
  return {
    complete,
    total,
    percent: denom ? Math.round((complete / denom) * 100) : 0,
  };
}

export type MilestoneViewModel = {
  def: ChecklistMilestoneDef;
  steps: ChecklistTask[];
  missing_slugs: string[];
  complete: number;
  total: number;
  percent: number;
  blocked_count: number;
  next_action: ChecklistTask | null;
  primary_owner: ChecklistOwner;
  contributor: ChecklistOwner | null;
  target_date: string | null;
  target_label: string | null;
  notes: string | null;
};

export function buildMilestoneViews(
  tasks: ChecklistTask[],
  dueDate: string | null,
): MilestoneViewModel[] {
  const bySlug = new Map<string, ChecklistTask>();
  for (const t of tasks) {
    if (t.archived) continue;
    if (t.template_task_slug) bySlug.set(t.template_task_slug, t);
  }

  return BEFORE_BABY_MILESTONES.map((def) => {
    const steps = def.step_slugs
      .map((slug) => bySlug.get(slug))
      .filter((t): t is ChecklistTask => Boolean(t));
    const missing_slugs = def.step_slugs.filter((slug) => !bySlug.has(slug));
    const complete = steps.filter((s) => s.completed).length;
    const total = def.step_slugs.length;
    const percent = total ? Math.round((complete / Math.max(steps.length, 1)) * 100) : 0;
    const blocked_count = steps.filter(
      (s) => s.dependency_status === "blocked" && !s.completed,
    ).length;
    const next_action =
      steps.find(
        (s) =>
          !s.completed &&
          (s.dependency_status === "open" ||
            s.dependency_status === "satisfied" ||
            s.dependency_status === "overridden" ||
            !s.dependency_status),
      ) ??
      steps.find((s) => !s.completed) ??
      null;

    const owners = steps.map((s) => s.owner);
    const primary_owner =
      owners.find((o) => o !== "both") ??
      def.suggested_primary_owner ??
      "both";
    const contributor =
      steps.find((s) => s.contributor)?.contributor ??
      def.suggested_contributor ??
      null;

    const target_date =
      dueDate && def.target_offset_days != null
        ? (() => {
            const d = new Date(`${dueDate}T12:00:00`);
            d.setDate(d.getDate() + def.target_offset_days);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          })()
        : null;

    const notes =
      steps
        .map((s) => s.notes)
        .filter(Boolean)
        .slice(0, 2)
        .join(" · ") || null;

    return {
      def,
      steps,
      missing_slugs,
      complete,
      total,
      percent: steps.length ? Math.round((complete / steps.length) * 100) : percent,
      blocked_count,
      next_action,
      primary_owner,
      contributor,
      target_date,
      target_label: target_date
        ? `Recommended by ${formatShortDate(target_date)}`
        : null,
      notes,
    };
  });
}

export function tasksForMilestone(
  milestoneId: string,
  tasks: ChecklistTask[],
): ChecklistTask[] {
  const def = BEFORE_BABY_MILESTONES.find((m) => m.id === milestoneId);
  if (!def) return [];
  const slugSet = new Set(def.step_slugs);
  return tasks.filter(
    (t) => !t.archived && t.template_task_slug && slugSet.has(t.template_task_slug),
  );
}

export function nextDueAmongSteps(steps: ChecklistTask[]): string | null {
  const dates = steps
    .filter((s) => !s.completed)
    .map((s) => effectiveDueDate(s))
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}
