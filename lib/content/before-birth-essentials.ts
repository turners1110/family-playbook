/**
 * Curated Before Birth Essentials path (~30 primary screens).
 * Full 430-question library remains available outside this path.
 */
export const BEFORE_BIRTH_ESSENTIALS_VERSION = "before-birth-essentials-v1";

export type EssentialsModule = {
  id: string;
  title: string;
  description: string;
  /** Match against question text / short_title / slug (case-insensitive includes). */
  questionMatchers: string[];
};

export const BEFORE_BIRTH_ESSENTIAL_MODULES: EssentialsModule[] = [
  {
    id: "birth_and_medical",
    title: "Birth and medical",
    description: "Labor preferences, visitors, urgent decisions, and medical choices.",
    questionMatchers: [
      "labor and delivery",
      "birth plan",
      "flexible if the birth",
      "present during labor",
      "visitor",
      "pain-management",
      "pain management",
      "urgent medical",
      "cord blood",
      "circumcision",
    ],
  },
  {
    id: "feeding_and_sleep",
    title: "Feeding and sleep",
    description: "Initial feeding goals, overnight duties, and safe sleep.",
    questionMatchers: [
      "feeding goals",
      "backup feeding",
      "feeding responsibilities",
      "overnight duties",
      "protected sleep",
      "sleep plan needs",
      "safe sleep",
    ],
  },
  {
    id: "postpartum_recovery",
    title: "Postpartum recovery",
    description: "Recovery needs, household support, and warning signs.",
    questionMatchers: [
      "protected during recovery",
      "meals, laundry",
      "warning signs",
      "postpartum support",
      "unwanted advice",
    ],
  },
  {
    id: "parent_partnership",
    title: "Parent partnership",
    description: "Decisions while exhausted, fairness, and conflict repair.",
    questionMatchers: [
      "decisions while exhausted",
      "disagreement in front",
      "ask for relief",
      "recurring household",
      "check in about stress",
      "protect time for our marriage",
      "relationship after the bab",
    ],
  },
  {
    id: "family_and_visitors",
    title: "Family and visitors",
    description: "Visitor rules, photos, grandparents, and health boundaries.",
    questionMatchers: [
      "visitor rules",
      "first two weeks",
      "photo and social",
      "grandparents be involved",
      "health boundaries",
      "communicates boundaries",
    ],
  },
  {
    id: "work_money_legal",
    title: "Work, money and legal",
    description: "Leave, return-to-work, childcare, insurance, and guardians.",
    questionMatchers: [
      "leave plan",
      "return-to-work",
      "return to work",
      "childcare plan",
      "insurance actions",
      "chosen guardians",
      "legal and financial",
      "will",
      "beneficiary",
      "529",
    ],
  },
  {
    id: "home_and_lulu",
    title: "Home and Lulu",
    description: "Dog care during labor, boundaries, and home readiness.",
    questionMatchers: [
      "lulu",
      "dog",
      "pet",
      "home setup",
      "36 weeks",
      "backup plan",
    ],
  },
];

/** Priority tiers after content upgrade (narrow essentials). */
export const PRIORITY_UPGRADE = {
  essential_before_birth_max: 35,
  demote_to: "high" as const,
};

export function matchEssentialQuestion(input: {
  id: string;
  slug: string;
  short_title: string;
  text: string;
}): { moduleId: string; moduleTitle: string } | null {
  const hay = `${input.slug} ${input.short_title} ${input.text}`.toLowerCase();
  for (const mod of BEFORE_BIRTH_ESSENTIAL_MODULES) {
    if (mod.questionMatchers.some((m) => hay.includes(m.toLowerCase()))) {
      return { moduleId: mod.id, moduleTitle: mod.title };
    }
  }
  return null;
}

/** Stages that should stay out of pregnancy / newborn interview queues. */
export const FUTURE_STAGE_MARKERS = [
  "driving",
  "substance",
  "college",
  "teen independence",
  "puberty",
  "social media",
  "dating",
  "adult child",
  "adult transition",
  "young adult",
];

export function looksLikeFutureStageQuestion(input: {
  short_title: string;
  text: string;
  life_stages: string[];
  priority: string;
}): boolean {
  const hay = `${input.short_title} ${input.text}`.toLowerCase();
  if (FUTURE_STAGE_MARKERS.some((m) => hay.includes(m))) return true;
  const futureStages = ["teen", "preteen", "young_adult", "adult_child"];
  const onlyFuture =
    input.life_stages.length > 0 &&
    input.life_stages.every(
      (s) => futureStages.includes(s) || s === "all_stages",
    ) &&
    !input.life_stages.includes("pre_birth_planning") &&
    !input.life_stages.includes("pregnancy") &&
    !input.life_stages.includes("newborn_0_3");
  return onlyFuture && input.priority === "essential_before_birth";
}
