/**
 * Checklist milestones: group related template tasks into progress-tracked units.
 * Existing task IDs remain stable; milestones are a view/grouping layer.
 */

export type ChecklistMilestoneDef = {
  id: string;
  title: string;
  category: string;
  step_slugs: string[];
  target_offset_days: number;
};

export const BEFORE_BABY_MILESTONES: ChecklistMilestoneDef[] = [
  {
    id: "ms_car_seat",
    title: "Prepare infant car seat",
    category: "hospital_birth",
    step_slugs: ["hospital_birth_5", "hospital_birth_6", "baby_gear_1"],
    target_offset_days: -35,
  },
  {
    id: "ms_pediatrician",
    title: "Choose and prepare pediatrician",
    category: "medical",
    step_slugs: ["medical_1", "medical_2", "hospital_birth_11", "medical_7"],
    target_offset_days: -60,
  },
  {
    id: "ms_hospital_registration",
    title: "Complete hospital registration",
    category: "hospital_birth",
    step_slugs: ["hospital_birth_1", "hospital_birth_2", "hospital_birth_3", "hospital_birth_13"],
    target_offset_days: -60,
  },
  {
    id: "ms_hospital_bags",
    title: "Prepare hospital bags",
    category: "hospital_birth",
    step_slugs: ["hospital_birth_7", "hospital_birth_8", "hospital_birth_9"],
    target_offset_days: -21,
  },
  {
    id: "ms_safe_sleep",
    title: "Prepare safe sleep space",
    category: "home",
    step_slugs: ["home_1", "home_2", "home_3", "home_7"],
    target_offset_days: -35,
  },
  {
    id: "ms_feeding_area",
    title: "Prepare feeding area",
    category: "home",
    step_slugs: ["home_11", "baby_gear_20", "baby_gear_4"],
    target_offset_days: -28,
  },
  {
    id: "ms_lulu",
    title: "Prepare Lulu",
    category: "pets",
    step_slugs: ["pets_1", "pets_2", "pets_3", "pets_4"],
    target_offset_days: -30,
  },
  {
    id: "ms_legal_financial",
    title: "Complete legal and financial preparation",
    category: "financial",
    step_slugs: ["financial_1", "financial_2", "financial_3", "financial_4", "financial_5"],
    target_offset_days: -60,
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
  const complete = steps.filter((t) => t!.completed).length;
  return {
    complete,
    total,
    percent: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}
