/**
 * Before Birth Essentials pathway — curated babymoon discussion path.
 * References existing question IDs; answer records stay on those IDs.
 */

export const BEFORE_BIRTH_PATHWAY_VERSION = "before-birth-pathway-v1";
export const BEFORE_BIRTH_PATHWAY_SLUG = "before-birth-essentials";

export type EssentialsResponseType =
  | "multi_select"
  | "single_choice"
  | "ranking"
  | "scale"
  | "policy_builder"
  | "responsibility_matrix"
  | "scenario_plan"
  | "named_people"
  | "separate_then_shared"
  | "paired_text"
  | "open_with_prompts";

export type EssentialsModuleDef = {
  id: string;
  slug: string;
  title: string;
  description: string;
  display_order: number;
  estimated_minutes: number;
};

export type ConditionalRule = {
  /** Screen id whose shared answer is checked. */
  source_screen_id: string;
  /** If source choice equals / contains any of these, show this screen. */
  show_when_choice_includes?: string[];
  /** Hide when choice includes any of these. */
  hide_when_choice_includes?: string[];
  /** Hide when source status is not_relevant. */
  hide_when_not_relevant?: boolean;
};

export type TaskSuggestionTemplate = {
  id: string;
  title: string;
  category: string;
  category_label: string;
  reason: string;
  timing_hint: "before_birth" | "after_birth";
};

export type EssentialsScreenDef = {
  id: string;
  module_id: string;
  /** Primary question ID for answer storage. */
  question_id: string;
  /** Extra question IDs rendered on the same screen (grouped; answers stay separate). */
  paired_question_ids?: string[];
  display_order: number;
  is_primary: boolean;
  optional?: boolean;
  title: string;
  purpose: string;
  helper: string;
  prompts: string[];
  response_type: EssentialsResponseType;
  options?: string[];
  matrix_rows?: string[];
  matrix_owners?: Array<"sam" | "michelle" | "both" | "other" | "undecided">;
  policy_fields?: string[];
  separate_answers?: boolean;
  timing_reason: string;
  review_trigger: string;
  conditional?: ConditionalRule;
  related_task_slugs?: string[];
  task_suggestions?: TaskSuggestionTemplate[];
  provider_label?: string;
};

export const ESSENTIALS_MODULES: EssentialsModuleDef[] = [
  {
    id: "foundation",
    slug: "foundation",
    title: "Our Family Foundation",
    description: "What success, home, and childhood mean for your family.",
    display_order: 0,
    estimated_minutes: 20,
  },
  {
    id: "birth_medical",
    slug: "birth-and-medical",
    title: "Birth and Medical Decisions",
    description: "Labor priorities, visitors, pain preferences, and urgent decisions.",
    display_order: 1,
    estimated_minutes: 35,
  },
  {
    id: "feeding_sleep",
    slug: "feeding-and-sleep",
    title: "Feeding and Sleep",
    description: "Initial feeding goals, overnight roles, and safe sleep.",
    display_order: 2,
    estimated_minutes: 30,
  },
  {
    id: "postpartum",
    slug: "postpartum-recovery",
    title: "Postpartum Recovery",
    description: "Recovery needs, household support, and warning signs.",
    display_order: 3,
    estimated_minutes: 25,
  },
  {
    id: "partnership",
    slug: "parent-partnership",
    title: "Parent Partnership",
    description: "Decisions while exhausted, fairness, relief, and check-ins.",
    display_order: 4,
    estimated_minutes: 25,
  },
  {
    id: "visitors",
    slug: "visitors-and-family",
    title: "Visitors and Extended Family",
    description: "Home visitors, photos, grandparents, and health boundaries.",
    display_order: 5,
    estimated_minutes: 25,
  },
  {
    id: "work_legal",
    slug: "work-money-legal",
    title: "Work, Money, Legal, and Childcare",
    description: "Leave, return-to-work, childcare, and legal readiness.",
    display_order: 6,
    estimated_minutes: 30,
  },
  {
    id: "home_lulu",
    slug: "home-and-lulu",
    title: "Home, Logistics, and Lulu",
    description: "Pet care during labor, boundaries, introduction, and home setup.",
    display_order: 7,
    estimated_minutes: 20,
  },
];

export const ESSENTIALS_SCREENS: EssentialsScreenDef[] = [
  // —— Foundation (3) ——
  {
    id: "f1_success",
    module_id: "foundation",
    question_id: "q_what_does_success_as_parents_mean_to_us",
    display_order: 1,
    is_primary: true,
    title: "What does success as parents mean to us?",
    purpose: "Name the indicators that would tell you parenting is going well.",
    helper:
      "Answer separately first if you need to, then choose shared indicators. These guide later tradeoffs.",
    prompts: [
      "What would make either of you feel we are succeeding?",
      "What would not be enough, even if it looks good from outside?",
      "Which indicators matter most in the first year?",
    ],
    response_type: "multi_select",
    options: [
      "Child feels safe and loved",
      "Strong parent-child relationship",
      "Child becomes independent",
      "Child develops sound judgment",
      "Child is kind",
      "Child is resilient",
      "Child takes responsibility",
      "Child feels comfortable being themselves",
      "Family remains connected",
      "Parents maintain their relationship",
      "Other",
    ],
    separate_answers: true,
    timing_reason: "Foundation for babymoon priorities.",
    review_trigger: "Annually or after a major family change",
  },
  {
    id: "f2_loving_home",
    module_id: "foundation",
    question_id: "q_what_does_a_loving_home_look_and_feel_like_to_us",
    display_order: 2,
    is_primary: true,
    title: "What does a loving home look and feel like to us?",
    purpose: "Choose the qualities you want daily life to have.",
    helper:
      "Pick the qualities you both want to protect. Note where you differ without forcing a single word.",
    prompts: [
      "Which three qualities matter most on hard days?",
      "Which quality do we under-invest in today?",
    ],
    response_type: "multi_select",
    options: [
      "Calm",
      "Warm",
      "Playful",
      "Structured",
      "Honest",
      "Respectful",
      "Affectionate",
      "Curious",
      "Safe for mistakes",
      "Connected",
      "Private",
      "Welcoming",
      "Other",
    ],
    separate_answers: true,
    timing_reason: "Sets tone for visitor, sleep, and conflict rules.",
    review_trigger: "When home routines feel off",
  },
  {
    id: "f3_childhood",
    module_id: "foundation",
    question_id: "q_what_parts_of_our_own_childhoods_do_we_hope_to_repeat",
    paired_question_ids: [
      "q_what_parts_of_our_childhoods_do_we_hope_to_change",
    ],
    display_order: 3,
    is_primary: true,
    title: "What do we want to repeat or change from our childhoods?",
    purpose: "Hold both prompts together so patterns are easier to see.",
    helper:
      "Write briefly under Repeat and Change. Leave Unsure if you need more time. Answers save to both original questions.",
    prompts: [
      "What felt safe or loving that we want again?",
      "What do we want our child to experience differently?",
      "Where might our stories pull in opposite directions?",
    ],
    response_type: "paired_text",
    separate_answers: true,
    timing_reason: "Surfaces inherited patterns before practical policies.",
    review_trigger: "When old family patterns show up under stress",
  },

  // —— Birth & Medical (6) ——
  {
    id: "b1_labor_priorities",
    module_id: "birth_medical",
    question_id: "q_what_role_should_each_parent_have_during_labor",
    display_order: 10,
    is_primary: true,
    title: "What matters most to us during labor and delivery?",
    purpose: "Identify top priorities for labor, including each parent's role.",
    helper:
      "Select up to three priorities. Record partner roles in notes. Preferences are not a contract with the care team.",
    prompts: [
      "What does each parent most want protected?",
      "What should the partner advocate for if plans change?",
    ],
    response_type: "multi_select",
    options: [
      "Healthy parent and baby",
      "Clear communication",
      "Pain control",
      "Mobility during labor",
      "Minimal intervention where safe",
      "Support for vaginal delivery",
      "Openness to medical intervention",
      "Calm environment",
      "Immediate skin-to-skin where possible",
      "Feeding support",
      "Partner involvement",
      "Privacy",
      "Other",
    ],
    separate_answers: true,
    timing_reason: "Clarify priorities before the hospital bag is packed.",
    review_trigger: "After a prenatal visit that changes options",
    related_task_slugs: ["hospital_birth_14", "hospital_birth_7"],
    task_suggestions: [
      {
        id: "ts_birth_plan_doc",
        title: "Draft birth preferences document from essentials answers",
        category: "hospital_birth",
        category_label: "Hospital & Birth",
        reason: "Capture labor priorities for the care team.",
        timing_hint: "before_birth",
      },
    ],
  },
  {
    id: "b2_flexible",
    module_id: "birth_medical",
    question_id: "q_how_should_we_respond_when_the_birth_plan_changes",
    display_order: 11,
    is_primary: true,
    title: "Where are we flexible if the birth plan changes?",
    purpose: "Separate strong preferences from flexible ones.",
    helper:
      "Name what each option protects and what you would revisit with the provider. Do not treat this as medical advice.",
    prompts: [
      "Which preferences are strong but flexible?",
      "Which preferences require provider discussion?",
      "Who speaks up if either parent feels unheard?",
    ],
    response_type: "separate_then_shared",
    timing_reason: "Reduces conflict when labor does not follow the plan.",
    review_trigger: "If a prenatal complication changes options",
    provider_label: "Confirm with provider",
  },
  {
    id: "b3_present_and_hospital_visitors",
    module_id: "birth_medical",
    question_id: "q_how_should_family_members_receive_updates_during_labor_and_bir",
    display_order: 12,
    is_primary: true,
    title: "Who should be present during labor, and what hospital visitor rules apply?",
    purpose: "Decide presence, updates, and hospital visitor boundaries together.",
    helper:
      "Agree on a rule you are both willing to enforce. Decide who communicates it and what happens when someone pushes back.",
    prompts: [
      "Who may be in the room?",
      "When may others visit after birth?",
      "How will we communicate the boundary?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "Who may be present during labor",
      "Who may visit at the hospital",
      "When visits begin",
      "Maximum visit length",
      "Health rules",
      "Photo rules",
      "Either parent may pause visits",
      "Who communicates the boundary",
    ],
    options: [
      "Partner only during labor",
      "Doula welcome",
      "Parent or family member welcome",
      "No visitors at hospital",
      "Limited visitors after birth",
      "Undecided",
    ],
    timing_reason: "Boundaries are harder to invent under pressure.",
    review_trigger: "If family travel plans change",
    related_task_slugs: ["hospital_birth_16"],
    task_suggestions: [
      {
        id: "ts_hospital_visitor_policy",
        title: "Share hospital visitor expectations with family",
        category: "relationship",
        category_label: "Relationship",
        reason: "Communicate labor/hospital boundaries before arrival.",
        timing_hint: "before_birth",
      },
    ],
  },
  {
    id: "b4_pain",
    module_id: "birth_medical",
    question_id: "q_what_pain_management_preferences_do_we_want_discussed_with_our",
    display_order: 13,
    is_primary: true,
    title: "What pain-management preferences should we discuss with the care team?",
    purpose: "Record preferences and questions for the provider—not medical advice.",
    helper:
      "Record preferences, questions for the provider, and which parts depend on medical advice.",
    prompts: [
      "What do we want explained before labor?",
      "What should the partner advocate for?",
    ],
    response_type: "single_choice",
    options: [
      "Prefer unmedicated if feasible",
      "Open to medication",
      "Prefer epidural",
      "Decide during labor",
      "Need provider discussion",
      "Undecided",
    ],
    timing_reason: "Easier to discuss before labor begins.",
    review_trigger: "After a pain-management prenatal conversation",
    provider_label: "Confirm with provider",
  },
  {
    id: "b5_urgent",
    module_id: "birth_medical",
    question_id: "q_how_will_we_make_routine_medical_decisions_together",
    display_order: 14,
    is_primary: true,
    title: "How should urgent medical decisions be handled if the plan changes?",
    purpose: "Agree how to ask questions and advocate under time pressure.",
    helper:
      "Focus on roles: who asks questions, who updates family, and how to handle disagreement quickly.",
    prompts: [
      "Who asks clarifying questions?",
      "How much explanation do we want in the moment?",
      "When should the partner advocate?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "Who asks questions",
      "Who communicates with family",
      "How much explanation is wanted",
      "When the partner should advocate",
      "Trust in clinician recommendation",
      "How to handle disagreement under time pressure",
    ],
    timing_reason: "Reduces freeze when decisions move fast.",
    review_trigger: "After any unexpected medical recommendation",
    provider_label: "Confirm with provider",
  },
  {
    id: "b6_cord_circumcision",
    module_id: "birth_medical",
    question_id: "q_what_is_our_plan_for_cord_blood_delayed_clamping_and_related_c",
    paired_question_ids: [
      "q_how_will_we_decide_about_circumcision_or_other_elective_proced",
    ],
    display_order: 15,
    is_primary: true,
    title: "Cord blood banking and circumcision (if applicable)",
    purpose: "Capture elective decisions or mark not applicable / needs research.",
    helper:
      "Answer cord blood here, then circumcision if relevant. Use Not applicable when it does not apply. Confirm timing with your provider.",
    prompts: [
      "Do we need more research before deciding?",
      "Should this wait for a prenatal visit?",
    ],
    response_type: "paired_text",
    options: [
      "Public donation if available",
      "Private banking",
      "Do not bank",
      "Need more research",
      "Ask provider",
      "Undecided",
      "Yes",
      "No",
      "Not applicable",
    ],
    timing_reason: "Some choices need paperwork lead time.",
    review_trigger: "After provider counseling",
    provider_label: "Confirm with provider",
    related_task_slugs: ["hospital_birth_17", "hospital_birth_18"],
  },

  // —— Feeding & Sleep (5) ——
  {
    id: "fs1_feeding_goals",
    module_id: "feeding_sleep",
    question_id: "q_what_is_our_approach_to_feeding_in_the_newborn_stage",
    display_order: 20,
    is_primary: true,
    title: "What are our initial feeding goals?",
    purpose: "Record preferences without treating them as promises.",
    helper:
      "Record preferences without treating them as promises. Recovery, supply, the baby’s health, and medical advice might change the plan.",
    prompts: [
      "What feels like a good starting plan?",
      "What would make us revisit early?",
    ],
    response_type: "multi_select",
    options: [
      "Direct nursing",
      "Pumping",
      "Bottle feeding expressed milk",
      "Combination feeding",
      "Formula feeding",
      "Flexible based on recovery and supply",
      "No fixed goal",
      "Need provider guidance",
    ],
    separate_answers: true,
    timing_reason: "Shapes gear, hospital requests, and overnight roles.",
    review_trigger: "First pediatrician visit or supply concerns",
    provider_label: "Confirm with provider",
    related_task_slugs: ["home_11", "baby_gear_18"],
  },
  {
    id: "fs2_backup",
    module_id: "feeding_sleep",
    question_id: "q_what_is_our_plan_for_formula_combination_feeding_or_bottle_log",
    display_order: 21,
    is_primary: true,
    title: "What backup feeding options feel acceptable?",
    purpose: "Decide what support is available if the first plan is hard.",
    helper:
      "Name backups you are both willing to use. Keeping formula available is not a failure of a nursing goal.",
    prompts: [
      "What should be stocked at home?",
      "Who prepares bottles if needed?",
    ],
    response_type: "multi_select",
    options: [
      "Formula available at home",
      "Pumping",
      "Donor milk through approved source",
      "Lactation support",
      "Pediatrician guidance",
      "Decide only if needed",
    ],
    conditional: {
      source_screen_id: "fs1_feeding_goals",
      show_when_choice_includes: [
        "Direct nursing",
        "Pumping",
        "Bottle feeding expressed milk",
        "Combination feeding",
        "Flexible based on recovery and supply",
        "Formula feeding",
        "Need provider guidance",
        "No fixed goal",
      ],
    },
    timing_reason: "Avoids crisis shopping after birth.",
    review_trigger: "If feeding plan changes in week one",
    related_task_slugs: ["baby_gear_20", "baby_gear_15"],
  },
  {
    id: "fs3_overnight",
    module_id: "feeding_sleep",
    question_id: "q_how_should_we_divide_overnight_care_in_the_first_weeks",
    paired_question_ids: [
      "q_how_will_we_protect_sleep_for_the_parent_who_is_not_on_overnig",
    ],
    display_order: 22,
    is_primary: true,
    title: "How should overnight responsibilities and protected sleep work?",
    purpose: "Build a trial overnight plan with protected sleep blocks.",
    helper:
      "Build an initial plan around recovery, feeding method, work schedules, and protected sleep. Treat the plan as a trial, not a permanent contract.",
    prompts: [
      "Who handles feeds vs diapers vs settling?",
      "What protected sleep block does each parent need?",
      "What changes on work nights?",
    ],
    response_type: "responsibility_matrix",
    matrix_rows: [
      "Feed role",
      "Diaper role",
      "Settling role",
      "Protected sleep — Sam",
      "Protected sleep — Michelle",
      "Workday adjustments",
    ],
    matrix_owners: ["sam", "michelle", "both", "undecided"],
    timing_reason: "Easier to draft before exhaustion.",
    review_trigger: "Day 7 postpartum check-in",
    task_suggestions: [
      {
        id: "ts_overnight_review",
        title: "Review overnight roles at day seven",
        category: "relationship",
        category_label: "Relationship",
        reason: "Trial overnight plan needs a scheduled revisit.",
        timing_hint: "after_birth",
      },
    ],
  },
  {
    id: "fs4_sleep_change_signs",
    module_id: "feeding_sleep",
    question_id: "q_how_should_we_handle_cluster_feeding_nights_emotionally",
    display_order: 23,
    is_primary: true,
    title: "What signs mean the current sleep plan needs to change?",
    purpose: "Agree triggers for asking for relief or changing the plan.",
    helper:
      "Name concrete signs so either parent can ask for a reset without arguing about whether it is “bad enough.”",
    prompts: [
      "What would make driving unsafe?",
      "What does asking for relief sound like?",
    ],
    response_type: "multi_select",
    options: [
      "One parent feels unsafe driving",
      "Repeated conflict",
      "Falling asleep while holding baby",
      "Recovery is worsening",
      "Work performance is unsafe",
      "Either parent asks for relief",
      "Provider concern",
      "Other",
    ],
    timing_reason: "Prevents waiting until someone breaks.",
    review_trigger: "Any night either parent feels unsafe or depleted",
    provider_label: "Contact provider if medical concerns arise",
  },
  {
    id: "fs5_safe_sleep",
    module_id: "feeding_sleep",
    question_id: "q_how_should_we_decide_on_swaddling_and_safe_sleep_setup",
    display_order: 24,
    is_primary: true,
    title: "What safe-sleep rules will we follow?",
    purpose: "Acknowledge the safe-sleep setup you intend to use.",
    helper:
      "Confirm the plan with your pediatrician. This app does not replace medical guidance.",
    prompts: [
      "Where will the baby sleep for the first weeks?",
      "What is off-limits in the sleep space?",
    ],
    response_type: "multi_select",
    options: [
      "Firm flat sleep surface",
      "Fitted sheet only",
      "No loose blankets or pillows",
      "Back sleeping",
      "Room sharing without bed sharing",
      "Need pediatrician guidance",
      "Other",
    ],
    timing_reason: "Setup should be ready before the final weeks.",
    review_trigger: "First pediatrician visit",
    provider_label: "Confirm with pediatrician",
    related_task_slugs: ["home_2", "home_extra_2"],
  },

  // —— Postpartum (4) ——
  {
    id: "p1_michelle_recovery",
    module_id: "postpartum",
    question_id: "q_what_support_will_michelle_need_during_recovery",
    display_order: 30,
    is_primary: true,
    title: "What does Michelle need protected during physical recovery?",
    purpose: "Name recovery priorities before visitors and chores compete.",
    helper:
      "Michelle can answer first. Sam captures how to protect those needs day to day.",
    prompts: [
      "What feels non-negotiable in week one?",
      "What help is hardest to ask for in the moment?",
    ],
    response_type: "multi_select",
    options: [
      "Sleep",
      "Pain management",
      "Limited visitors",
      "Meal support",
      "Reduced household work",
      "Feeding support",
      "Emotional space",
      "Privacy",
      "Help with appointments",
      "Help with Lulu",
      "Other",
    ],
    separate_answers: true,
    timing_reason: "Recovery needs are easier to honor if named early.",
    review_trigger: "First postpartum week",
    provider_label: "Confirm warning signs with OB",
  },
  {
    id: "p2_household",
    module_id: "postpartum",
    question_id: "q_how_should_we_plan_meals_and_household_support_for_the_first_t",
    paired_question_ids: [
      "q_who_owns_which_recurring_household_tasks_in_the_first_three_mo",
    ],
    display_order: 31,
    is_primary: true,
    title: "Who will handle meals, laundry, cleaning, supplies, and communication?",
    purpose: "Assign first-two-weeks ownership without pretending it is forever.",
    helper:
      "Assign a primary owner and backup for the first two weeks. Review after leave routines settle.",
    prompts: [
      "What can friends or family take off our plate?",
      "What must stay with us?",
    ],
    response_type: "responsibility_matrix",
    matrix_rows: [
      "Meals",
      "Grocery ordering",
      "Laundry",
      "Dishes",
      "Trash",
      "Cleaning",
      "Baby supplies",
      "Visitor communication",
      "Medical calls",
      "Lulu care",
    ],
    matrix_owners: ["sam", "michelle", "both", "other", "undecided"],
    timing_reason: "Reduces invisible-work arguments in week one.",
    review_trigger: "End of week two",
    related_task_slugs: ["home_12", "home_extra_3"],
  },
  {
    id: "p3_warning_signs",
    module_id: "postpartum",
    question_id: "q_what_postpartum_mental_health_signs_should_trigger_immediate_h",
    display_order: 32,
    is_primary: true,
    title: "What physical or emotional signs should prompt outside help?",
    purpose: "Plan who to contact—without diagnosing.",
    helper:
      "Confirm warning signs with your OB. This is a planning list, not a medical assessment.",
    prompts: [
      "Who do we call first overnight?",
      "Who else should know the plan?",
    ],
    response_type: "multi_select",
    options: [
      "Contact OB",
      "Contact primary doctor",
      "Contact pediatrician",
      "Contact emergency services",
      "Contact family support",
      "Contact mental-health support",
      "Need provider list written down",
    ],
    timing_reason: "Decide contacts before a crisis.",
    review_trigger: "If either parent feels unsafe or severely low",
    provider_label: "Confirm warning signs with provider",
    related_task_slugs: ["postpartum_prep_1", "postpartum_prep_2"],
  },
  {
    id: "p4_advice",
    module_id: "postpartum",
    question_id: "q_how_should_we_handle_unsolicited_parenting_advice",
    display_order: 33,
    is_primary: true,
    title: "How will we handle advice, pressure, or criticism from family?",
    purpose: "Agree who responds and which decisions stay private.",
    helper:
      "Agree on a rule you are both willing to enforce. Decide who communicates it and what happens when someone pushes back.",
    prompts: [
      "What language feels respectful but firm?",
      "When does provider guidance end the debate?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "Who responds",
      "Language to use",
      "When to end a conversation",
      "Which decisions remain private",
      "When provider guidance ends debate",
    ],
    timing_reason: "Prevents mid-visit conflict.",
    review_trigger: "After the first difficult visitor interaction",
  },

  // —— Partnership (4) ——
  {
    id: "pp1_exhausted",
    module_id: "partnership",
    question_id: "q_what_does_a_good_day_look_like_when_both_parents_are_exhausted",
    display_order: 40,
    is_primary: true,
    title: "How will we make decisions when we are exhausted?",
    purpose: "Choose default rules for non-urgent decisions on hard days.",
    helper:
      "Pick defaults that protect sleep and reduce re-arguing. Urgent medical decisions still follow the medical plan.",
    prompts: [
      "Which decisions can wait until morning?",
      "What is our default when we disagree while tired?",
    ],
    response_type: "multi_select",
    options: [
      "Pause non-urgent decisions",
      "Use the existing plan",
      "Defer to the parent handling the task",
      "Ask the provider",
      "Use a scheduled check-in",
      "Trial one option for a set period",
      "Revisit after sleep",
    ],
    timing_reason: "Write the rule before exhaustion.",
    review_trigger: "After the first week of nights",
  },
  {
    id: "pp2_disagreement",
    module_id: "partnership",
    question_id: "q_how_should_we_handle_parenting_disagreements_in_front_of_our_c",
    display_order: 41,
    is_primary: true,
    title: "How will we handle disagreement in front of the baby—and later the child?",
    purpose: "Agree how conflict and repair should look.",
    helper:
      "Discuss each person’s needs separately before agreeing on one policy. Repair matters as much as the rule.",
    prompts: [
      "May disagreement be visible?",
      "What does repair look like afterward?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "No personal attacks",
      "Pause option",
      "Repair after conflict",
      "Whether disagreement may be visible",
      "How to explain repair as the child grows",
    ],
    timing_reason: "Sets the pattern before newborn stress peaks.",
    review_trigger: "After a sharp conflict",
  },
  {
    id: "pp3_relief",
    module_id: "partnership",
    question_id: "q_how_should_we_talk_about_resentment_before_it_grows",
    display_order: 42,
    is_primary: true,
    title: "How will either parent ask for relief before resentment builds?",
    purpose: "Create a simple signal and what happens next.",
    helper:
      "Choose a short phrase and a minimum protected break. Make outside help part of the plan, not a last resort only.",
    prompts: [
      "What phrase means “I need relief now”?",
      "What is the minimum break?",
      "When do we call outside help?",
    ],
    response_type: "separate_then_shared",
    timing_reason: "Resentment grows quietly without a signal.",
    review_trigger: "Whenever the signal is used",
  },
  {
    id: "pp4_checkin",
    module_id: "partnership",
    question_id: "q_how_will_we_check_in_weekly_about_parenting_stress",
    display_order: 43,
    is_primary: true,
    title: "How often should we check in about stress, fairness, and workload?",
    purpose: "Choose a cadence and create a post-birth reminder if wanted.",
    helper:
      "Short and regular beats long and rare. You can change the cadence later.",
    prompts: [
      "What two questions belong in every check-in?",
      "When is a realistic time of day?",
    ],
    response_type: "single_choice",
    options: [
      "Daily two-minute check",
      "Twice weekly",
      "Weekly",
      "Every two weeks",
      "Other",
    ],
    timing_reason: "Creates the container for fairness conversations.",
    review_trigger: "Two weeks postpartum",
    task_suggestions: [
      {
        id: "ts_parent_checkin",
        title: "Schedule recurring parent stress check-in",
        category: "relationship",
        category_label: "Relationship",
        reason: "Selected check-in cadence needs a reminder.",
        timing_hint: "after_birth",
      },
    ],
  },

  // —— Visitors (4) ——
  {
    id: "v1_home_visitors",
    module_id: "visitors",
    question_id: "q_what_is_our_plan_for_accepting_or_declining_visitors_in_week_o",
    display_order: 50,
    is_primary: true,
    title: "What visitor rules should apply during the first two weeks at home?",
    purpose: "Set who, when, and how visits work at home.",
    helper:
      "Agree on a rule you are both willing to enforce. Either parent should be able to cancel a visit.",
    prompts: [
      "When may visits start?",
      "Do visitors help, or only visit?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "Who may visit",
      "Start date",
      "Visit length",
      "Notice required",
      "Health rules",
      "Whether visitors help",
      "Either parent may cancel",
    ],
    timing_reason: "Family often plans travel early.",
    review_trigger: "End of week two",
    related_task_slugs: ["relationship_3"],
  },
  {
    id: "v2_photos",
    module_id: "visitors",
    question_id: "q_how_do_we_want_to_handle_photos_and_social_media_after_birth",
    display_order: 51,
    is_primary: true,
    title: "What photo and social-media rules should apply?",
    purpose: "Decide posting and sharing boundaries before the first photos.",
    helper:
      "Be specific. Soft rules are hard to enforce when relatives already posted.",
    prompts: [
      "What is never okay to share?",
      "Who enforces the rule with relatives?",
    ],
    response_type: "multi_select",
    options: [
      "No public posting",
      "Ask before posting",
      "Private family sharing only",
      "No identifying details",
      "No medical information",
      "No bath or undressed photos",
      "Other",
    ],
    timing_reason: "Photos move fast in the first days.",
    review_trigger: "If a relative posts without asking",
  },
  {
    id: "v3_grandparents",
    module_id: "visitors",
    question_id: "q_what_role_do_we_want_grandparents_to_play",
    display_order: 52,
    is_primary: true,
    title: "How do we want grandparents involved?",
    purpose: "Separate hopes from boundaries.",
    helper:
      "Capture hopes and limits separately. You can love grandparents and still set clear rules.",
    prompts: [
      "What involvement would feel supportive?",
      "What involvement would feel intrusive?",
    ],
    response_type: "separate_then_shared",
    timing_reason: "Align before travel plans lock in.",
    review_trigger: "Before the first grandparent visit",
  },
  {
    id: "v4_health_and_comms",
    module_id: "visitors",
    question_id: "q_what_does_a_calm_postpartum_home_environment_require_from_visi",
    paired_question_ids: [
      "q_how_should_we_handle_visitors_who_ignore_boundaries",
    ],
    display_order: 53,
    is_primary: true,
    title: "What health boundaries apply, and who communicates them?",
    purpose: "Health rules plus ownership of boundary conversations.",
    helper:
      "Confirm medical rules with your pediatrician or OB. Assign who talks to each side of the family.",
    prompts: [
      "What illness rules apply?",
      "Who speaks to Sam’s family vs Michelle’s?",
    ],
    response_type: "policy_builder",
    policy_fields: [
      "Illness / exposure rules",
      "Hand washing",
      "Smoking",
      "Kissing baby",
      "Vaccination discussions",
      "Who communicates to Sam’s family",
      "Who communicates to Michelle’s family",
    ],
    timing_reason: "Health rules need shared language.",
    review_trigger: "Before first visit season",
    provider_label: "Confirm medical rules with pediatrician or OB",
  },

  // —— Work / legal / childcare (4) ——
  {
    id: "w1_leave",
    module_id: "work_legal",
    question_id: "q_how_will_we_handle_work_leave_logistics_and_income_during_leav",
    display_order: 60,
    is_primary: true,
    title: "What is each parent’s leave plan?",
    purpose: "Capture start/end, pay, paperwork, and unknowns separately then share.",
    helper:
      "Answer for each parent, then write a short shared summary. Unknowns are allowed.",
    prompts: [
      "What forms are still outstanding?",
      "What handoff must happen at work?",
    ],
    response_type: "separate_then_shared",
    separate_answers: true,
    timing_reason: "Employer paperwork needs lead time.",
    review_trigger: "When leave dates are confirmed",
    related_task_slugs: ["paperwork_1", "work_leave_3", "work_leave_4"],
    task_suggestions: [
      {
        id: "ts_sam_handoff",
        title: "Document Sam work handoff",
        category: "work_leave",
        category_label: "Work & Leave",
        reason: "Leave plan implies a handoff task.",
        timing_hint: "before_birth",
      },
      {
        id: "ts_michelle_handoff",
        title: "Document Michelle work handoff if applicable",
        category: "work_leave",
        category_label: "Work & Leave",
        reason: "Leave plan implies a handoff task.",
        timing_hint: "before_birth",
      },
    ],
  },
  {
    id: "w2_return_childcare",
    module_id: "work_legal",
    question_id: "q_what_childcare_options_are_acceptable_to_us_in_the_first_years",
    display_order: 61,
    is_primary: true,
    title: "What is the return-to-work and childcare plan for the first year?",
    purpose: "Choose an expected care path and note backups.",
    helper:
      "Pick the expected path. Conditional follow-ups appear for daycare-style plans. You can stay undecided.",
    prompts: [
      "When might care begin?",
      "What would trigger a change?",
    ],
    response_type: "single_choice",
    options: [
      "Daycare",
      "Nanny",
      "Family care",
      "Parent care",
      "Mixed plan",
      "Undecided",
    ],
    timing_reason: "Childcare waitlists and leave dates interact.",
    review_trigger: "When leave end dates are firm",
    related_task_slugs: ["work_leave_6", "work_leave_8", "financial_5"],
  },
  {
    id: "w3_daycare_details",
    module_id: "work_legal",
    question_id: "q_what_does_a_transition_plan_into_daycare_look_like",
    display_order: 62,
    is_primary: true,
    optional: true,
    title: "If we use daycare, what matters for the transition?",
    purpose: "Capture commute, timing, and backup needs for a daycare path.",
    helper:
      "Only answer if daycare is likely. Skip if not relevant.",
    prompts: [
      "What commute is acceptable?",
      "What is the backup if a center is closed?",
    ],
    response_type: "open_with_prompts",
    conditional: {
      source_screen_id: "w2_return_childcare",
      show_when_choice_includes: ["Daycare", "Mixed plan"],
    },
    timing_reason: "Daycare planning needs lead time.",
    review_trigger: "When touring centers",
  },
  {
    id: "w4_legal_insurance",
    module_id: "work_legal",
    question_id: "q_how_will_we_document_decisions_so_we_do_not_re_argue_the_same_",
    display_order: 63,
    is_primary: true,
    title: "What insurance and legal actions must happen before and after birth?",
    purpose: "Separate decide / complete-before / complete-after actions.",
    helper:
      "This is a readiness checklist, not legal advice. Link open items to Before Baby tasks.",
    prompts: [
      "What must be decided before birth?",
      "What can wait until after birth?",
    ],
    response_type: "multi_select",
    options: [
      "Decide: baby health insurance plan",
      "Decide: life insurance review",
      "Decide: will and guardians",
      "Decide: beneficiaries",
      "Decide: 529 / education savings approach",
      "Complete before birth: employer leave paperwork",
      "Complete after birth: add baby to insurance",
      "Complete after birth: birth certificate process",
      "Complete after birth: Social Security process",
      "Need legal advice",
      "Undecided on guardians",
    ],
    timing_reason: "Legal and insurance work belongs earlier than the final month.",
    review_trigger: "When documents are ready to sign",
    related_task_slugs: [
      "paperwork_3",
      "paperwork_4",
      "paperwork_5",
      "paperwork_6",
      "paperwork_8",
      "legal_extra_1",
    ],
    task_suggestions: [
      {
        id: "ts_guardians",
        title: "Choose guardians and update will",
        category: "paperwork",
        category_label: "Paperwork",
        reason: "Legal readiness selected in essentials.",
        timing_hint: "before_birth",
      },
      {
        id: "ts_insurance_after",
        title: "Add baby to health insurance after birth",
        category: "paperwork",
        category_label: "Paperwork",
        reason: "Post-birth insurance action flagged.",
        timing_hint: "after_birth",
      },
    ],
  },

  // —— Home & Lulu (3) ——
  {
    id: "h1_lulu_labor",
    module_id: "home_lulu",
    question_id: "q_what_is_our_plan_for_pet_care_and_home_logistics_after_birth",
    display_order: 70,
    is_primary: true,
    title: "Who handles Lulu during labor, and what is the backup plan?",
    purpose: "Assign primary and backup sitters and unexpected-labor scenarios.",
    helper:
      "Plan for labor-day care and a calm first introduction. The goal is safe supervision, predictable boundaries, and lower stress for Lulu.",
    prompts: [
      "Who is primary vs backup?",
      "What if labor starts overnight?",
      "What if the hospital stay runs long?",
    ],
    response_type: "scenario_plan",
    options: [
      "Primary sitter confirmed",
      "Backup sitter confirmed",
      "Written care instructions shared",
      "Overnight labor plan",
      "Extended stay plan",
      "Undecided",
    ],
    timing_reason: "Sitter logistics need confirmation before the final weeks.",
    review_trigger: "Final week reconfirm",
    related_task_slugs: ["lulu_extra_1", "lulu_extra_2", "lulu_extra_6", "pets_3"],
    task_suggestions: [
      {
        id: "ts_lulu_confirm",
        title: "Confirm Lulu labor plan with primary and backup sitters",
        category: "pets",
        category_label: "Pets",
        reason: "Labor-day Lulu plan from essentials.",
        timing_hint: "before_birth",
      },
    ],
  },
  {
    id: "h2_lulu_boundaries",
    module_id: "home_lulu",
    question_id: "q_what_safety_rules_apply_to_pets_and_the_baby",
    paired_question_ids: [
      "q_how_should_we_prepare_siblings_or_pets_if_relevant_for_the_bab",
    ],
    display_order: 71,
    is_primary: true,
    title: "What boundaries should Lulu follow, and how should the first introduction happen?",
    purpose: "Set baby-area rules and a first-introduction step plan.",
    helper:
      "Be concrete about rooms, furniture, and supervision. Practice before the baby arrives when you can.",
    prompts: [
      "Which areas are off limits?",
      "What does the first introduction look like?",
    ],
    response_type: "multi_select",
    options: [
      "No nursery access unsupervised",
      "No crib or bassinet area",
      "No feeding-area jumping",
      "No stroller climbing",
      "Supervised baby-gear contact only",
      "Practice with sounds and gear first",
      "Slow scent introduction",
      "Other",
    ],
    timing_reason: "Practice time helps before birth.",
    review_trigger: "After first week home",
    related_task_slugs: ["lulu_extra_4", "lulu_extra_5", "pets_2"],
  },
  {
    id: "h3_home_setup",
    module_id: "home_lulu",
    question_id: "q_how_should_we_prepare_siblings_or_pets_if_relevant_for_the_bab",
    display_order: 72,
    is_primary: true,
    title: "What home setup must be complete by 36 weeks?",
    purpose: "Confirm readiness milestones that block a calm return home.",
    helper:
      "Treat this as a readiness checklist. Incomplete items should become Before Baby tasks, not guilt.",
    prompts: [
      "What is still unordered?",
      "What needs a second adult to finish?",
    ],
    response_type: "multi_select",
    options: [
      "Safe sleep area",
      "Car seat",
      "Feeding area",
      "Changing area",
      "Hospital bags",
      "Recovery supplies",
      "Baby laundry",
      "Emergency contacts",
      "Food and household supplies",
      "Lulu plan",
    ],
    timing_reason: "Conservative readiness before possible early arrival.",
    review_trigger: "At 34 and 36 weeks",
    related_task_slugs: [
      "hospital_birth_5",
      "home_extra_2",
      "final_week_5",
      "home_extra_3",
    ],
  },
];

export function getEssentialsModule(moduleId: string) {
  return ESSENTIALS_MODULES.find((m) => m.id === moduleId) ?? null;
}

export function getEssentialsScreen(screenId: string) {
  return ESSENTIALS_SCREENS.find((s) => s.id === screenId) ?? null;
}

export function listPrimaryScreens() {
  return ESSENTIALS_SCREENS.filter((s) => s.is_primary).sort(
    (a, b) => a.display_order - b.display_order,
  );
}

export function screensForModule(moduleId: string) {
  return ESSENTIALS_SCREENS.filter((s) => s.module_id === moduleId).sort(
    (a, b) => a.display_order - b.display_order,
  );
}

export function allPathwayQuestionIds(): string[] {
  const ids = new Set<string>();
  for (const s of ESSENTIALS_SCREENS) {
    ids.add(s.question_id);
    for (const p of s.paired_question_ids ?? []) ids.add(p);
  }
  return [...ids];
}

export function estimatedMinutesRemaining(incompletePrimaryCount: number) {
  // Roughly 6–8 minutes per primary screen average.
  return Math.max(0, incompletePrimaryCount * 7);
}
