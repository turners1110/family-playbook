export const LIFE_STAGES = [
  "pre_birth_planning",
  "pregnancy",
  "labor_and_birth",
  "first_week",
  "newborn_0_3",
  "infant_3_12",
  "young_toddler_1_2",
  "older_toddler_2_3",
  "preschool_3_5",
  "early_elementary_5_8",
  "later_elementary_8_11",
  "preteen",
  "teen",
  "young_adult",
  "adult_child",
  "all_stages",
] as const;

export type LifeStage = (typeof LIFE_STAGES)[number];

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  pre_birth_planning: "Pre-birth planning",
  pregnancy: "Pregnancy",
  labor_and_birth: "Labor and birth",
  first_week: "First week",
  newborn_0_3: "Newborn (0–3 months)",
  infant_3_12: "Infant (3–12 months)",
  young_toddler_1_2: "Young toddler (1–2 years)",
  older_toddler_2_3: "Older toddler (2–3 years)",
  preschool_3_5: "Preschool (3–5 years)",
  early_elementary_5_8: "Early elementary (5–8 years)",
  later_elementary_8_11: "Later elementary (8–11 years)",
  preteen: "Preteen",
  teen: "Teen",
  young_adult: "Young adult",
  adult_child: "Adult child",
  all_stages: "All stages",
};

export const QUESTION_PRIORITIES = [
  "essential_before_birth",
  "high",
  "medium",
  "low",
  "future",
] as const;

export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<QuestionPriority, string> = {
  essential_before_birth: "Essential before birth",
  high: "High",
  medium: "Medium",
  low: "Low",
  future: "Future",
};

export const DECISION_STATUSES = [
  "not_started",
  "in_discussion",
  "needs_research",
  "cooling_off",
  "undecided",
  "tentatively_decided",
  "decided",
  "review_scheduled",
  "superseded",
  "archived",
  "not_relevant",
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const STATUS_LABELS: Record<DecisionStatus, string> = {
  not_started: "Not started",
  in_discussion: "In discussion",
  needs_research: "Needs research",
  cooling_off: "Cooling off",
  undecided: "Undecided",
  tentatively_decided: "Tentatively decided",
  decided: "Decided",
  review_scheduled: "Review scheduled",
  superseded: "Superseded",
  archived: "Archived",
  not_relevant: "Not relevant",
};

export const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number] | null;

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Low confidence",
  2: "Some confidence",
  3: "Moderate confidence",
  4: "High confidence",
  5: "Strong confidence",
};

export const QUESTION_TYPES = [
  "open_response",
  "yes_or_no",
  "single_choice",
  "multiple_choice",
  "ranking",
  "scale",
  "scenario",
  "tradeoff",
  "reflection",
  "prediction",
  "policy_decision",
  "practical_planning",
  "research_review",
  "values_clarification",
  "separate_perspective",
  "joint_discussion",
  "follow_up",
  "annual_review",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const RESEARCH_MODES = [
  "no_research_needed",
  "optional_background",
  "helpful_before_decision",
  "strongly_recommended",
  "professional_guidance_needed",
] as const;

export type ResearchMode = (typeof RESEARCH_MODES)[number];

export const EVIDENCE_QUALITY = [
  "strong",
  "moderate",
  "limited",
  "mixed",
  "expert_consensus",
  "practical_guidance",
  "personal_experience",
  "unknown",
] as const;

export type EvidenceQuality = (typeof EVIDENCE_QUALITY)[number];

export const DECISION_TYPES = [
  "philosophical",
  "behavioral",
  "environmental",
  "relational",
  "developmental",
  "operational",
  "safety",
  "financial",
  "medical",
  "educational",
  "cultural",
  "ethical",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export const KNOWLEDGE_TYPES = [
  "research_summary",
  "book_note",
  "article_note",
  "expert_guidance",
  "practical_tip",
  "safety_guidance",
  "developmental_guidance",
  "personal_note",
  "quote",
  "open_research_question",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const OUTCOME_DOMAINS = [
  "character",
  "emotional_development",
  "thinking_and_learning",
  "relationships",
  "independence_and_life_skills",
  "financial_skills",
  "health",
  "citizenship_and_community",
] as const;

export type OutcomeDomain = (typeof OUTCOME_DOMAINS)[number];

export const OUTCOME_DOMAIN_LABELS: Record<OutcomeDomain, string> = {
  character: "Character",
  emotional_development: "Emotional Development",
  thinking_and_learning: "Thinking and Learning",
  relationships: "Relationships",
  independence_and_life_skills: "Independence and Life Skills",
  financial_skills: "Financial Skills",
  health: "Health",
  citizenship_and_community: "Citizenship and Community",
};

export const SESSION_LENGTHS = {
  quick: { min: 3, max: 5, label: "Quick (3–5 questions)" },
  standard: { min: 8, max: 12, label: "Standard (8–12 questions)" },
  deep: { min: 15, max: 25, label: "Deep (15–25 questions)" },
} as const;

export type SessionLength = keyof typeof SESSION_LENGTHS;

export const QUICK_DECISION_OPTIONS = [
  "yes",
  "no",
  "it_depends",
  "undecided",
  "not_relevant",
  "revisit_later",
] as const;

export type QuickDecisionOption = (typeof QUICK_DECISION_OPTIONS)[number];

export const PLAYBOOK_SECTIONS = [
  { slug: "family-constitution", title: "Family Constitution" },
  { slug: "parenting-goals", title: "Our Parenting Goals" },
  { slug: "skills-and-traits", title: "Skills and Traits We Hope to Build" },
  { slug: "how-we-decide", title: "How We Make Parenting Decisions" },
  { slug: "pregnancy-and-birth", title: "Pregnancy and Birth" },
  { slug: "newborn-stage", title: "Newborn Stage" },
  { slug: "infancy", title: "Infancy" },
  { slug: "toddler-years", title: "Toddler Years" },
  { slug: "early-childhood", title: "Early Childhood" },
  { slug: "health-and-safety", title: "Health and Safety" },
  { slug: "sleep", title: "Sleep" },
  { slug: "feeding-and-nutrition", title: "Feeding and Nutrition" },
  { slug: "emotional-development", title: "Emotional Development" },
  { slug: "discipline-and-boundaries", title: "Discipline and Boundaries" },
  { slug: "learning-and-education", title: "Learning and Education" },
  { slug: "technology", title: "Technology" },
  { slug: "money-and-financial-skills", title: "Money and Financial Skills" },
  { slug: "family-relationships", title: "Family Relationships" },
  { slug: "traditions-and-culture", title: "Traditions and Culture" },
  { slug: "open-questions", title: "Open Questions" },
  { slug: "decisions-to-review", title: "Decisions to Review" },
  { slug: "research-notes", title: "Research Notes" },
  { slug: "decision-history", title: "Decision History" },
] as const;

export const BABYMOON_WEIGHT_CATEGORIES = [
  "pregnancy",
  "birth",
  "postpartum_recovery",
  "newborn_care",
  "parent_partnership",
  "division_of_labor",
  "core_values",
  "family_identity",
  "health",
  "safety",
  "sleep",
  "feeding",
  "breastfeeding",
  "discipline",
  "emotional_development",
  "attachment",
  "extended_family",
] as const;

export const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/before-baby", label: "Before Baby" },
  { href: "/discuss", label: "Discuss" },
  { href: "/questions", label: "Questions" },
  { href: "/research", label: "Research & Books" },
  { href: "/decisions", label: "Decisions" },
  { href: "/outcomes", label: "Outcomes" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/playbook", label: "Playbook" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
] as const;
