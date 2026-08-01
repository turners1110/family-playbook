/**
 * Default relative timing for Before Baby template tasks.
 * Offsets are days relative to expected_due_date:
 *   negative = before birth, positive = after birth.
 * Avoid false precision — ranges and flexible timing where practical.
 */

import type {
  ChecklistTimingFlexibility,
  ChecklistTimingType,
} from "@/lib/types/models";

export type TaskTimingDef = {
  recommended_start_offset_days: number | null;
  recommended_due_offset_days: number | null;
  hard_deadline_offset_days: number | null;
  timing_reason: string;
  timing_flexibility: ChecklistTimingFlexibility;
  timing_type: ChecklistTimingType;
  confirm_with_provider?: boolean;
};

const PROVIDER =
  "Confirm timing with your provider (OB, hospital, pediatrician, insurer, or employer).";

function before(
  due: number,
  reason: string,
  opts?: Partial<TaskTimingDef> & { start?: number; hard?: number },
): TaskTimingDef {
  return {
    recommended_start_offset_days: opts?.start ?? null,
    recommended_due_offset_days: due,
    hard_deadline_offset_days: opts?.hard ?? null,
    timing_reason: opts?.confirm_with_provider
      ? `${reason} ${PROVIDER}`
      : reason,
    timing_flexibility: opts?.timing_flexibility ?? "flexible",
    timing_type: "before_birth",
    confirm_with_provider: opts?.confirm_with_provider,
  };
}

function after(
  due: number,
  reason: string,
  flexibility: ChecklistTimingFlexibility = "flexible",
): TaskTimingDef {
  return {
    recommended_start_offset_days: null,
    recommended_due_offset_days: due,
    hard_deadline_offset_days: null,
    timing_reason: `${reason} Mark as post-birth — do not place before delivery. ${PROVIDER}`,
    timing_flexibility: flexibility,
    timing_type: "after_birth",
    confirm_with_provider: true,
  };
}

function finalWeek(due: number, reason: string): TaskTimingDef {
  return before(due, reason, {
    timing_flexibility: due >= -7 ? "fixed" : "flexible",
  });
}

/** Explicit overrides keyed by template task slug. */
export const BEFORE_BABY_TASK_TIMING: Record<string, TaskTimingDef> = {
  // Hospital & Birth
  hospital_birth_1: before(-90, "Choosing a hospital early leaves time for registration and tours.", {
    start: -150,
    confirm_with_provider: true,
  }),
  hospital_birth_2: before(-60, "Hospital registration usually needs lead time before delivery.", {
    start: -90,
    confirm_with_provider: true,
  }),
  hospital_birth_3: before(-75, "Confirm insurance coverage before final hospital paperwork.", {
    start: -120,
    confirm_with_provider: true,
  }),
  hospital_birth_4: before(-45, "A hospital tour is useful once registration is underway.", {
    start: -75,
    confirm_with_provider: true,
  }),
  hospital_birth_5: before(-21, "Install the car seat with enough time for inspection.", {
    start: -35,
    hard: -7,
  }),
  hospital_birth_6: before(-14, "Inspection catches install issues before the final week.", {
    start: -28,
  }),
  hospital_birth_7: before(-21, "Pack Michelle’s hospital bag early so last-minute stress stays low.", {
    start: -35,
  }),
  hospital_birth_8: before(-21, "Pack Sam’s bag alongside Michelle’s.", {
    start: -35,
  }),
  hospital_birth_9: before(-14, "Snacks and comfort items are easy to finish in the final weeks.", {
    start: -28,
  }),
  hospital_birth_10: before(-21, "Mirror install pairs well with car seat prep.", {
    start: -35,
  }),
  hospital_birth_11: before(-30, "Save pediatrician contact info before the final month.", {
    start: -60,
    confirm_with_provider: true,
  }),
  hospital_birth_12: before(-30, "Keep OB emergency numbers easy to find.", {
    start: -60,
    confirm_with_provider: true,
  }),
  hospital_birth_13: before(-21, "Practice the hospital route once bags and car seat are ready.", {
    start: -35,
  }),
  hospital_birth_14: before(-60, "A birth plan is easier to refine over several prenatal visits.", {
    start: -120,
    confirm_with_provider: true,
  }),
  hospital_birth_15: before(-21, "Print the birth plan after it feels settled.", {
    start: -35,
  }),
  hospital_birth_16: before(-45, "Visitor expectations are best discussed before the final month.", {
    start: -90,
  }),
  hospital_birth_17: before(-90, "Cord blood decisions need research time.", {
    start: -150,
    confirm_with_provider: true,
    timing_flexibility: "optional",
  }),
  hospital_birth_18: before(-60, "Discuss circumcision only if relevant for your family.", {
    start: -120,
    confirm_with_provider: true,
    timing_flexibility: "optional",
  }),

  // Medical
  medical_1: before(-60, "Completing this early leaves time to interview another pediatrician.", {
    start: -120,
    confirm_with_provider: true,
  }),
  medical_2: before(-30, "Schedule the first pediatrician visit once a practice is chosen.", {
    start: -60,
    confirm_with_provider: true,
  }),
  medical_3: before(-45, "Review the vaccine schedule with your pediatrician.", {
    start: -90,
    confirm_with_provider: true,
  }),
  medical_4: before(-60, "Prenatal classes fill up; book with buffer.", {
    start: -120,
    confirm_with_provider: true,
  }),
  medical_5: before(-45, "Infant CPR is most useful before the final month.", {
    start: -90,
  }),
  medical_6: before(-45, "Pair choking response training with CPR.", {
    start: -90,
  }),
  medical_7: before(-21, "Know after-hours pediatric contact before the final week.", {
    start: -45,
    confirm_with_provider: true,
  }),

  // Home
  home_1: before(-45, "Assemble the crib with time to replace missing parts.", {
    start: -90,
  }),
  home_2: before(-45, "Bassinet setup pairs with sleep-station prep.", {
    start: -75,
  }),
  home_3: before(-30, "Install the monitor once the sleep space is set.", {
    start: -60,
  }),
  home_4: before(-30, "Blackout curtains help early nights.", {
    start: -60,
    timing_flexibility: "optional",
  }),
  home_5: before(-21, "Wash clothes before packing the hospital bag.", {
    start: -45,
  }),
  home_6: before(-21, "Wash swaddles with other baby textiles.", {
    start: -45,
  }),
  home_7: before(-21, "Wash crib sheets with other baby textiles.", {
    start: -45,
  }),
  home_8: before(-30, "Baby-proof high-priority areas before the final month.", {
    start: -60,
  }),
  home_9: before(-28, "Organize the changing station once gear arrives.", {
    start: -50,
  }),
  home_10: before(-28, "Set up diaper supplies near the changing area.", {
    start: -50,
  }),
  home_11: before(-28, "Feeding station setup can wait until gear is home.", {
    start: -50,
  }),
  home_12: before(-10, "Freeze meals while energy is still decent.", {
    start: -28,
  }),
  home_13: before(-14, "Stock pantry staples before the final week.", {
    start: -28,
  }),
  home_14: before(-21, "Night lights are a quick finish.", {
    start: -35,
    timing_flexibility: "optional",
  }),

  // Baby gear — mostly flexible shopping windows
  baby_gear_1: before(-45, "Car seat purchase should leave install/inspection time.", {
    start: -120,
  }),
  baby_gear_2: before(-60, "Stroller shopping benefits from an earlier window.", {
    start: -120,
    timing_flexibility: "optional",
  }),
  baby_gear_3: before(-45, "Carrier practice helps before baby arrives.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_4: before(-60, "Bassinet purchase pairs with sleep setup.", {
    start: -120,
  }),
  baby_gear_5: before(-75, "Crib lead time covers shipping delays.", {
    start: -150,
  }),
  baby_gear_6: before(-75, "Mattress arrives with the crib.", {
    start: -150,
  }),
  baby_gear_7: before(-60, "Waterproof protector is a quick add-on.", {
    start: -90,
  }),
  baby_gear_8: before(-45, "Changing pad for the station.", {
    start: -90,
  }),
  baby_gear_9: before(-45, "Diaper pail once the station is planned.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_10: before(-45, "Monitor purchase before install.", {
    start: -90,
  }),
  baby_gear_11: before(-30, "White noise is optional comfort gear.", {
    start: -60,
    timing_flexibility: "optional",
  }),
  baby_gear_12: before(-30, "Thermometer for newborn care kit.", {
    start: -60,
  }),
  baby_gear_13: before(-30, "Nasal aspirator for newborn care kit.", {
    start: -60,
  }),
  baby_gear_14: before(-30, "Nail clippers for newborn care kit.", {
    start: -60,
  }),
  baby_gear_15: before(-45, "Bottles if you may use them.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_16: before(-45, "Bottle brush with bottles.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_17: before(-45, "Drying rack with bottle setup.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_18: before(-60, "Breast pump often needs insurance paperwork.", {
    start: -120,
    confirm_with_provider: true,
  }),
  baby_gear_19: before(-45, "Pump accessories once the pump is set.", {
    start: -90,
    timing_flexibility: "optional",
  }),
  baby_gear_20: before(-21, "Formula backup if desired — avoid overbuying early.", {
    start: -45,
    timing_flexibility: "optional",
  }),
  baby_gear_21: before(-30, "Pacifiers are optional.", {
    start: -60,
    timing_flexibility: "optional",
  }),
  baby_gear_22: before(-30, "Swaddles for early sleep.", {
    start: -60,
  }),
  baby_gear_23: before(-30, "Sleep sacks as baby outgrows swaddles.", {
    start: -60,
    timing_flexibility: "optional",
  }),

  // Paperwork
  paperwork_1: before(-120, "Parental leave discussions need employer lead time.", {
    start: -180,
    confirm_with_provider: true,
  }),
  paperwork_2: before(-90, "FMLA paperwork often needs weeks of processing.", {
    start: -150,
    confirm_with_provider: true,
  }),
  paperwork_3: after(14, "Add baby to insurance after birth once documentation is available."),
  paperwork_4: before(-90, "Life insurance review is better done with buffer.", {
    start: -150,
    timing_flexibility: "optional",
  }),
  paperwork_5: before(-90, "Update beneficiaries with insurance changes.", {
    start: -150,
  }),
  paperwork_6: before(-120, "Wills and guardianship need thoughtful discussion.", {
    start: -180,
  }),
  paperwork_7: before(-45, "Emergency contacts before the final month.", {
    start: -90,
  }),
  paperwork_8: before(-120, "Choosing guardians deserves unhurried conversation.", {
    start: -180,
  }),
  paperwork_9: before(-60, "Hospital pre-registration aligns with hospital paperwork.", {
    start: -90,
    confirm_with_provider: true,
  }),

  // Financial
  financial_1: before(-90, "A rough first-year budget reduces late surprises.", {
    start: -150,
    timing_flexibility: "optional",
  }),
  financial_2: before(-60, "Optional savings account setup.", {
    start: -120,
    timing_flexibility: "optional",
  }),
  financial_3: before(-90, "Emergency fund goals are flexible.", {
    start: -150,
    timing_flexibility: "optional",
  }),
  financial_4: before(-30, "Finish remaining purchases before the final weeks.", {
    start: -60,
  }),
  financial_5: before(-90, "Childcare cost research helps decisions.", {
    start: -150,
    timing_flexibility: "optional",
  }),

  // Relationship
  relationship_1: before(-28, "Meal strategy pairs with freezing meals.", {
    start: -45,
  }),
  relationship_2: before(-45, "Overnight roles are easier to discuss before exhaustion.", {
    start: -90,
  }),
  relationship_3: before(-45, "Visitor expectations before family travel plans lock in.", {
    start: -90,
  }),
  relationship_4: before(-21, "Schedule a date before the final week gets busy.", {
    start: -45,
    timing_flexibility: "optional",
  }),
  relationship_5: before(-45, "Stress-night communication plans help early nights.", {
    start: -90,
  }),

  // Pets
  pets_1: before(-45, "Give Lulu time to adjust to gear and routines.", {
    start: -90,
  }),
  pets_2: before(-30, "Practice stroller walks before baby arrives.", {
    start: -60,
  }),
  pets_3: before(-30, "Delivery-day dog care plan before the final week.", {
    start: -60,
  }),
  pets_4: before(-30, "Backup sitter confirmed before the final week.", {
    start: -60,
  }),

  // Final week
  final_week_1: finalWeek(-5, "Charge cameras in the final week."),
  final_week_2: finalWeek(-5, "Charge phones in the final week."),
  final_week_3: finalWeek(-3, "Fuel the car a few days before the due date."),
  final_week_4: finalWeek(-7, "Confirm car seat install in the final week."),
  final_week_5: finalWeek(-5, "Hospital bags go in the car late."),
  final_week_6: finalWeek(-7, "Finish laundry before the final stretch."),
  final_week_7: finalWeek(-7, "A light house reset is enough."),
  final_week_8: finalWeek(-5, "Stock the fridge for the first days home."),
  final_week_9: finalWeek(-7, "Confirm pediatrician contact one last time."),
  final_week_10: finalWeek(-3, "Protect rest time near the due date."),
};

const SECTION_DEFAULTS: Record<string, TaskTimingDef> = {
  hospital_birth: before(-45, "Hospital and birth prep usually lands in the mid-to-late third trimester.", {
    start: -90,
    confirm_with_provider: true,
  }),
  medical: before(-60, "Medical tasks benefit from provider lead time.", {
    start: -120,
    confirm_with_provider: true,
  }),
  home: before(-30, "Home setup fits the month before arrival.", { start: -60 }),
  baby_gear: before(-45, "Gear shopping works best with shipping buffer.", { start: -90 }),
  paperwork: before(-90, "Paperwork needs employer and insurer lead time.", {
    start: -150,
    confirm_with_provider: true,
  }),
  financial: before(-60, "Financial prep is flexible.", {
    start: -120,
    timing_flexibility: "optional",
  }),
  relationship: before(-45, "Relationship conversations before the final month.", {
    start: -90,
  }),
  pets: before(-30, "Pet prep before the final week.", { start: -60 }),
  final_week: finalWeek(-7, "Final-week tasks stay close to the due date."),
  custom: {
    recommended_start_offset_days: null,
    recommended_due_offset_days: null,
    hard_deadline_offset_days: null,
    timing_reason: "No automatic date — set timing manually if useful.",
    timing_flexibility: "optional",
    timing_type: "no_date",
  },
};

export function getDefaultTimingForTask(
  templateSlug: string | null | undefined,
  category?: string,
): TaskTimingDef {
  if (templateSlug && BEFORE_BABY_TASK_TIMING[templateSlug]) {
    return BEFORE_BABY_TASK_TIMING[templateSlug];
  }
  if (category && SECTION_DEFAULTS[category]) {
    return SECTION_DEFAULTS[category];
  }
  return SECTION_DEFAULTS.custom;
}
