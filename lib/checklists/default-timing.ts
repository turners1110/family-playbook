/**
 * Default relative timing for Before Baby template tasks.
 * Offsets are days relative to expected_due_date:
 *   negative = before birth, positive = after birth.
 * Avoid false precision — ranges and flexible timing where practical.
 */

import type {
  ChecklistTaskTag,
  ChecklistTimingFlexibility,
  ChecklistTimingType,
  ChecklistTimingWindowLabel,
} from "@/lib/types/models";

export type TaskTimingDef = {
  recommended_start_offset_days: number | null;
  recommended_due_offset_days: number | null;
  hard_deadline_offset_days: number | null;
  timing_reason: string;
  timing_flexibility: ChecklistTimingFlexibility;
  timing_type: ChecklistTimingType;
  confirm_with_provider?: boolean;
  timing_window_label?: ChecklistTimingWindowLabel;
  task_tags?: ChecklistTaskTag[];
};

/** Tags that must not target the final two weeks (−14…0) unless overridden. */
export const HEAVY_SETUP_TAGS: ChecklistTaskTag[] = [
  "setup",
  "assembly",
  "purchase",
  "legal",
  "insurance",
  "provider_selection",
  "training",
];

export const FINAL_TWO_WEEKS_START_OFFSET = -14;

const PROVIDER =
  "Confirm timing with your provider (OB, hospital, pediatrician, insurer, or employer).";

export function windowLabelForOffset(
  dueOffset: number | null,
  timingType: ChecklistTimingType,
): ChecklistTimingWindowLabel {
  if (timingType === "after_birth") return "after_birth";
  if (dueOffset == null) return "unscheduled";
  if (dueOffset <= -140) return "second_trimester";
  if (dueOffset <= -84) return "early_third_trimester";
  if (dueOffset <= -70) return "by_30_weeks";
  if (dueOffset <= -56) return "by_32_weeks";
  if (dueOffset <= -42) return "by_34_weeks";
  if (dueOffset <= -28) return "by_36_weeks";
  if (dueOffset <= -14) return "final_two_weeks";
  if (dueOffset <= 0) return "final_week";
  return "triggered_after_birth";
}

function before(
  due: number,
  reason: string,
  opts?: Partial<TaskTimingDef> & { start?: number; hard?: number },
): TaskTimingDef {
  const timing_type: ChecklistTimingType = "before_birth";
  return {
    recommended_start_offset_days: opts?.start ?? null,
    recommended_due_offset_days: due,
    hard_deadline_offset_days: opts?.hard ?? null,
    timing_reason: opts?.confirm_with_provider
      ? `${reason} ${PROVIDER}`
      : reason,
    timing_flexibility: opts?.timing_flexibility ?? "flexible",
    timing_type,
    confirm_with_provider: opts?.confirm_with_provider,
    timing_window_label:
      opts?.timing_window_label ?? windowLabelForOffset(due, timing_type),
    task_tags: opts?.task_tags,
  };
}

function after(
  due: number,
  reason: string,
  flexibility: ChecklistTimingFlexibility = "flexible",
  opts?: Partial<TaskTimingDef> & { start?: number },
): TaskTimingDef {
  return {
    recommended_start_offset_days: opts?.start ?? null,
    recommended_due_offset_days: due,
    hard_deadline_offset_days: null,
    timing_reason: `${reason} Mark as post-birth — do not place before delivery. ${PROVIDER}`,
    timing_flexibility: flexibility,
    timing_type: "after_birth",
    confirm_with_provider: true,
    timing_window_label: "after_birth",
    task_tags: opts?.task_tags,
  };
}

function finalCheck(due: number, reason: string): TaskTimingDef {
  return before(due, reason, {
    timing_flexibility: "fixed",
    timing_window_label: due >= -7 ? "final_week" : "final_two_weeks",
    task_tags: ["final_check"],
  });
}

/** Explicit overrides keyed by template task slug. */
export const BEFORE_BABY_TASK_TIMING: Record<string, TaskTimingDef> = {
  // Hospital & Birth
  hospital_birth_1: before(-120, "Choosing a hospital early leaves time for registration and tours.", {
    start: -180,
    confirm_with_provider: true,
    task_tags: ["provider_selection"],
  }),
  hospital_birth_2: before(-90, "Hospital registration usually needs lead time before delivery.", {
    start: -140,
    confirm_with_provider: true,
    task_tags: ["provider_selection"],
  }),
  hospital_birth_3: before(-100, "Confirm insurance coverage before final hospital paperwork.", {
    start: -160,
    confirm_with_provider: true,
    task_tags: ["insurance"],
  }),
  hospital_birth_4: before(-45, "A hospital tour is useful once registration is underway.", {
    start: -75,
    confirm_with_provider: true,
  }),
  hospital_birth_5: before(-35, "Install the car seat with enough time for inspection.", {
    start: -56,
    hard: -14,
    task_tags: ["setup", "assembly"],
  }),
  hospital_birth_6: before(-28, "Inspection catches install issues before the final two weeks.", {
    start: -42,
    task_tags: ["setup"],
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
  medical_1: before(-90, "Completing this early leaves time to interview another pediatrician.", {
    start: -150,
    confirm_with_provider: true,
    task_tags: ["provider_selection"],
  }),
  medical_2: before(-42, "Schedule the first pediatrician visit once a practice is chosen.", {
    start: -75,
    confirm_with_provider: true,
    task_tags: ["provider_selection"],
  }),
  medical_3: before(-45, "Review the vaccine schedule with your pediatrician.", {
    start: -90,
    confirm_with_provider: true,
  }),
  medical_4: before(-90, "Prenatal classes fill up; book with buffer.", {
    start: -150,
    confirm_with_provider: true,
    task_tags: ["training"],
  }),
  medical_5: before(-70, "Infant CPR is most useful before the final month.", {
    start: -120,
    task_tags: ["training"],
  }),
  medical_6: before(-70, "Pair choking response training with CPR.", {
    start: -120,
    task_tags: ["training"],
  }),
  medical_7: before(-21, "Know after-hours pediatric contact before the final week.", {
    start: -45,
    confirm_with_provider: true,
  }),

  // Home
  home_1: before(-56, "Assemble the crib with time to replace missing parts.", {
    start: -100,
    task_tags: ["assembly", "setup"],
  }),
  home_2: before(-56, "Bassinet setup pairs with sleep-station prep.", {
    start: -90,
    task_tags: ["assembly", "setup"],
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
  home_12: before(-28, "Freeze meals while energy is still decent.", {
    start: -45,
  }),
  home_13: before(-21, "Stock pantry staples before the final two weeks.", {
    start: -35,
  }),
  home_14: before(-21, "Night lights are a quick finish.", {
    start: -35,
    timing_flexibility: "optional",
  }),

  // Baby gear — mostly flexible shopping windows
  baby_gear_1: before(-70, "Car seat purchase should leave install/inspection time.", {
    start: -140,
    task_tags: ["purchase"],
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
  paperwork_1: before(-140, "Parental leave discussions need employer lead time.", {
    start: -200,
    confirm_with_provider: true,
  }),
  paperwork_2: before(-120, "FMLA paperwork often needs weeks of processing.", {
    start: -180,
    confirm_with_provider: true,
  }),
  paperwork_3: after(14, "Add baby to insurance after birth once documentation is available.", "fixed", {
    task_tags: ["insurance"],
  }),
  paperwork_4: before(-120, "Life insurance review is better done with buffer.", {
    start: -180,
    timing_flexibility: "optional",
    task_tags: ["insurance", "legal"],
  }),
  paperwork_5: before(-100, "Update beneficiaries after reviewing designations.", {
    start: -160,
    task_tags: ["legal", "insurance"],
  }),
  paperwork_6: before(-140, "Wills and guardianship need thoughtful discussion.", {
    start: -200,
    task_tags: ["legal"],
  }),
  paperwork_7: before(-56, "Emergency contacts before the final month.", {
    start: -100,
  }),
  paperwork_8: before(-140, "Choosing guardians deserves unhurried conversation.", {
    start: -200,
    task_tags: ["legal"],
  }),
  paperwork_9: before(-90, "Hospital pre-registration aligns with hospital paperwork.", {
    start: -130,
    confirm_with_provider: true,
    task_tags: ["provider_selection"],
  }),

  // Financial
  financial_1: before(-120, "A rough first-year budget reduces late surprises.", {
    start: -180,
    timing_flexibility: "optional",
  }),
  financial_2: before(-90, "Optional savings account setup.", {
    start: -150,
    timing_flexibility: "optional",
  }),
  financial_3: before(-120, "Emergency fund goals are flexible.", {
    start: -180,
    timing_flexibility: "optional",
  }),
  financial_4: before(-35, "Finish remaining purchases before the final two weeks.", {
    start: -70,
    task_tags: ["purchase"],
  }),
  financial_5: before(-120, "Childcare cost research helps decisions.", {
    start: -180,
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
  pets_1: before(-56, "Give Lulu time to adjust to gear and routines.", {
    start: -100,
  }),
  pets_2: before(-35, "Practice stroller walks before baby arrives.", {
    start: -70,
  }),
  pets_3: before(-42, "Delivery-day dog care plan before the final two weeks.", {
    start: -75,
  }),
  pets_4: before(-42, "Backup sitter confirmed before the final two weeks.", {
    start: -75,
  }),

  // Work & leave
  work_leave_1: before(-70, "Document Sam’s work handoff before leave starts.", {
    start: -120,
  }),
  work_leave_2: before(-70, "Document Michelle’s work handoff if applicable.", {
    start: -120,
  }),
  work_leave_3: before(-100, "Confirm leave dates with employers early.", {
    start: -160,
    confirm_with_provider: true,
  }),
  work_leave_4: before(-90, "Submit employer paperwork with buffer.", {
    start: -140,
    confirm_with_provider: true,
  }),
  work_leave_5: before(-28, "Set a return-to-work reminder before the final stretch.", {
    start: -60,
  }),
  work_leave_6: before(-70, "Confirm childcare start date once leave is known.", {
    start: -120,
  }),
  work_leave_7: before(-56, "Confirm drop-off and pickup logistics.", {
    start: -90,
  }),
  work_leave_8: before(-56, "Create a backup childcare plan.", {
    start: -90,
  }),

  // Postpartum prep
  postpartum_prep_1: before(-42, "Save labor and delivery triage number.", {
    start: -75,
    confirm_with_provider: true,
    task_tags: ["confirm_with_provider"],
  }),
  postpartum_prep_2: before(-42, "Save OB urgent contact instructions.", {
    start: -75,
    confirm_with_provider: true,
    task_tags: ["confirm_with_provider"],
  }),
  postpartum_prep_3: before(-35, "Prepare postpartum recovery supplies.", {
    start: -60,
    task_tags: ["setup"],
  }),
  postpartum_prep_4: before(-42, "Confirm postpartum follow-up process.", {
    start: -75,
    confirm_with_provider: true,
    task_tags: ["confirm_with_provider"],
  }),
  postpartum_prep_5: before(-42, "Identify lactation support if relevant.", {
    start: -75,
    confirm_with_provider: true,
    timing_flexibility: "optional",
  }),
  postpartum_prep_6: before(-35, "Create medication and allergy list for hospital.", {
    start: -60,
  }),
  postpartum_prep_7: before(-45, "Create emergency contact list.", {
    start: -75,
  }),

  // Legal extras
  legal_extra_1: before(-120, "Review beneficiary designations across accounts.", {
    start: -180,
    task_tags: ["legal", "insurance"],
  }),
  legal_extra_2: before(-90, "Store legal documents securely.", {
    start: -140,
    task_tags: ["legal"],
  }),
  legal_extra_3: before(-90, "Tell a trusted person where documents are stored.", {
    start: -140,
    task_tags: ["legal"],
  }),
  legal_extra_4: before(-100, "Decide education savings approach before birth.", {
    start: -160,
    timing_flexibility: "optional",
  }),
  legal_extra_5: before(-28, "Create a post-birth education-savings follow-up if chosen.", {
    start: -60,
    timing_flexibility: "optional",
  }),
  legal_extra_6: before(-90, "Update beneficiary designations where needed.", {
    start: -140,
    task_tags: ["legal", "insurance"],
  }),

  // Lulu details
  lulu_extra_1: before(-70, "Confirm primary sitter before the final month.", {
    start: -120,
  }),
  lulu_extra_2: before(-56, "Confirm backup sitter.", {
    start: -100,
  }),
  lulu_extra_3: before(-42, "Share written care instructions.", {
    start: -75,
  }),
  lulu_extra_4: before(-35, "Practice baby-area boundaries with Lulu.", {
    start: -70,
  }),
  lulu_extra_5: before(-28, "Prepare first introduction plan.", {
    start: -56,
  }),
  lulu_extra_6: before(-21, "Confirm Lulu labor plan once sitters and instructions are ready.", {
    start: -42,
  }),

  // Home extras
  home_extra_1: before(-35, "Remove unsafe items from the sleep space.", {
    start: -56,
    task_tags: ["setup"],
  }),
  home_extra_2: before(-28, "Final safe-sleep check after assembly and clearing.", {
    start: -42,
    task_tags: ["setup"],
  }),
  home_extra_3: before(-10, "Complete final house reset (dishes, trash, laundry, sheets, supplies, groceries).", {
    start: -14,
    timing_window_label: "final_two_weeks",
    task_tags: ["final_check"],
  }),

  // Final week / final two weeks — low-effort checks only
  final_week_1: finalCheck(-5, "Charge cameras in the final week."),
  final_week_2: finalCheck(-5, "Charge phones in the final week."),
  final_week_3: finalCheck(-3, "Fuel the car a few days before the due date."),
  final_week_4: finalCheck(-7, "Confirm car seat is installed in the vehicle."),
  final_week_5: finalCheck(-5, "Hospital bags go near the door or in the car."),
  final_week_6: finalCheck(-7, "Confirm laundry and sheets reset."),
  final_week_7: finalCheck(-7, "Light house reset check only."),
  final_week_8: finalCheck(-5, "Refresh groceries for the first days home."),
  final_week_9: finalCheck(-7, "Confirm pediatrician contact one last time."),
  final_week_10: finalCheck(-3, "Rest and reduce workload near the due date."),
  final_week_11: finalCheck(-5, "Reconfirm dog sitter for labor day."),
  final_week_12: finalCheck(-5, "Confirm hospital route one last time."),

  // After-birth / First Month
  first_72h_1: after(1, "Confirm baby is on hospital records."),
  first_72h_2: after(2, "Start birth certificate paperwork."),
  first_72h_3: after(2, "Start Social Security process."),
  first_72h_4: after(1, "Contact pediatrician.", "fixed"),
  first_72h_5: after(2, "Confirm first pediatrician visit timing."),
  first_72h_6: after(2, "Review feeding questions for the pediatrician."),
  first_72h_7: after(1, "Review postpartum medications with provider guidance."),
  first_72h_8: after(1, "Confirm safe sleep setup at home."),
  first_72h_9: after(2, "Confirm Lulu introduction plan."),
  first_72h_10: after(1, "Confirm meal and household support."),
  first_week_1: after(5, "Add baby to health insurance.", "fixed", { task_tags: ["insurance"] }),
  first_week_2: after(5, "Attend first pediatrician visit.", "fixed"),
  first_week_3: after(7, "Review feeding plan together."),
  first_week_4: after(7, "Review overnight roles."),
  first_week_5: after(7, "Review visitor boundaries."),
  first_week_6: after(6, "Check postpartum recovery supplies."),
  first_week_7: after(5, "Review urgent contact instructions."),
  first_week_8: after(7, "Review household task division."),
  first_week_9: after(7, "Check Lulu stress and behavior."),
  week_two_1: after(14, "Parent stress check-in."),
  week_two_2: after(14, "Review feeding workload."),
  week_two_3: after(14, "Review sleep workload."),
  week_two_4: after(14, "Review visitor plan."),
  week_two_5: after(14, "Review meal and laundry support."),
  week_two_6: after(14, "Review pediatrician follow-up needs."),
  week_two_7: after(14, "Review postpartum emotional health support."),
  week_two_8: after(14, "Review partner resentment or overload."),
  weeks_3_4_1: after(24, "Review return-to-work plan."),
  weeks_3_4_2: after(24, "Review childcare timing."),
  weeks_3_4_3: after(28, "Review family budget."),
  weeks_3_4_4: after(30, "Open 529 if chosen and required information exists.", "optional"),
  weeks_3_4_5: after(30, "Update beneficiaries if needed.", "optional", { task_tags: ["legal"] }),
  weeks_3_4_6: after(28, "Review date and connection plan."),
  weeks_3_4_7: after(28, "Review recurring household duties."),
  weeks_3_4_8: after(28, "Review Lulu and baby boundaries."),
  six_week_1: after(42, "Family systems review."),
  six_week_2: after(42, "Parent partnership review."),
  six_week_3: after(42, "Feeding and sleep review."),
  six_week_4: after(42, "Childcare and work review."),
  six_week_5: after(42, "Budget review."),
  six_week_6: after(42, "Support-network review."),
  six_week_7: after(42, "Update Before Baby plan into First Year plan."),
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
  final_week: finalCheck(-7, "Final-week tasks stay close to the due date."),
  work_leave: before(-70, "Leave and childcare logistics need employer lead time.", {
    start: -120,
    confirm_with_provider: true,
  }),
  postpartum_prep: before(-42, "Postpartum prep before the final two weeks.", {
    start: -75,
    confirm_with_provider: true,
  }),
  legal_extra: before(-100, "Legal document work belongs earlier in pregnancy.", {
    start: -160,
    task_tags: ["legal"],
  }),
  lulu_extra: before(-42, "Lulu logistics before the final two weeks.", { start: -75 }),
  home_extra: before(-28, "Home readiness before the final stretch.", { start: -56 }),
  first_72h: after(2, "First 72 hours planning reminders."),
  first_week: after(7, "First-week planning reminders."),
  week_two: after(14, "Week-two family check-ins."),
  weeks_3_4: after(28, "Weeks three and four planning."),
  six_week: after(42, "Six-week family systems review."),
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

/** Reject heavy setup tasks scheduled inside the final two weeks. */
export function validateFinalTwoWeekTiming(
  timingBySlug: Record<string, TaskTimingDef> = BEFORE_BABY_TASK_TIMING,
): Array<{ slug: string; message: string }> {
  const issues: Array<{ slug: string; message: string }> = [];
  for (const [slug, timing] of Object.entries(timingBySlug)) {
    if (timing.timing_type !== "before_birth") continue;
    const due = timing.recommended_due_offset_days;
    if (due == null || due < FINAL_TWO_WEEKS_START_OFFSET) continue;
    const tags = timing.task_tags ?? [];
    const heavy = tags.filter((t) => HEAVY_SETUP_TAGS.includes(t));
    if (heavy.length && !(timing.task_tags ?? []).includes("final_check")) {
      issues.push({
        slug,
        message: `${slug} has heavy tags (${heavy.join(", ")}) targeting final two weeks (offset ${due}).`,
      });
    }
  }
  return issues;
}
