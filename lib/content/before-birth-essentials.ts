/**
 * Curated Before Birth Essentials path (~30 primary screens).
 * Full 430-question library remains available outside this path.
 */
export const BEFORE_BIRTH_ESSENTIALS_VERSION = "before-birth-essentials-v1";

export type EssentialsModule = {
  id: string;
  title: string;
  description: string;
  /** Prefer exact slug fragments / distinctive phrases. */
  questionMatchers: string[];
  maxPrimary: number;
};

export const BEFORE_BIRTH_ESSENTIAL_MODULES: EssentialsModule[] = [
  {
    id: "birth_and_medical",
    title: "Birth and medical",
    description: "Labor preferences, visitors, urgent decisions, and medical choices.",
    maxPrimary: 5,
    questionMatchers: [
      "during labor and delivery",
      "birth plan",
      "present during labor",
      "visitor",
      "pain management",
      "cord blood",
      "circumcision",
    ],
  },
  {
    id: "feeding_and_sleep",
    title: "Feeding and sleep",
    description: "Initial feeding goals, overnight duties, and safe sleep.",
    maxPrimary: 5,
    questionMatchers: [
      "feeding goals",
      "feeding responsibilities",
      "overnight",
      "safe sleep",
      "sleep plan",
    ],
  },
  {
    id: "postpartum_recovery",
    title: "Postpartum recovery",
    description: "Recovery needs, household support, and warning signs.",
    maxPrimary: 4,
    questionMatchers: [
      "recovery",
      "postpartum",
      "warning signs",
      "unwanted advice",
    ],
  },
  {
    id: "parent_partnership",
    title: "Parent partnership",
    description: "Decisions while exhausted, fairness, and conflict repair.",
    maxPrimary: 4,
    questionMatchers: [
      "exhausted",
      "disagreement",
      "resentment",
      "protect time for our marriage",
      "household work",
    ],
  },
  {
    id: "family_and_visitors",
    title: "Family and visitors",
    description: "Visitor rules, photos, grandparents, and health boundaries.",
    maxPrimary: 4,
    questionMatchers: [
      "visitor rules",
      "first two weeks",
      "grandparents",
      "photo",
      "social-media rules",
    ],
  },
  {
    id: "work_money_legal",
    title: "Work, money and legal",
    description: "Leave, return-to-work, childcare, insurance, and guardians.",
    maxPrimary: 5,
    questionMatchers: [
      "leave plan",
      "return to work",
      "return-to-work",
      "childcare",
      "guardian",
      "beneficiar",
      "529",
    ],
  },
  {
    id: "home_and_lulu",
    title: "Home and Lulu",
    description: "Dog care during labor, boundaries, and home readiness.",
    maxPrimary: 3,
    questionMatchers: ["lulu", "dog sitter", "pet boundar", "stroller walk"],
  },
];

/** Stages that should stay out of pregnancy / newborn interview queues. */
export const FUTURE_STAGE_MARKERS = [
  "driving",
  "substance use",
  "college savings",
  "teen independence",
  "puberty",
  "social media account",
  "dating",
  "adult child",
  "young adult transition",
];

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

export function selectEssentialPrimaryQuestions<T extends {
  id: string;
  slug: string;
  short_title: string;
  text: string;
  logical_order: number;
  active: boolean;
}>(questions: T[]): T[] {
  const selected: T[] = [];
  for (const mod of BEFORE_BIRTH_ESSENTIAL_MODULES) {
    const hits = questions
      .filter((q) => q.active)
      .filter((q) => matchEssentialQuestion(q)?.moduleId === mod.id)
      .sort((a, b) => a.logical_order - b.logical_order)
      .slice(0, mod.maxPrimary);
    selected.push(...hits);
  }
  // Deduplicate by id while preserving order
  const seen = new Set<string>();
  return selected.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

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
