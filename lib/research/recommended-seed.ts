/**
 * Built-in Recommended Library catalog (metadata only).
 * Canonical seed used by local mode and mirrored in 0007_seed_recommended_library.sql.
 * Does not include copyrighted text, summaries, findings, or citations.
 */
import type {
  ResearchEvidenceBasis,
  ResearchEvidenceRating,
  ResearchOwnershipStatus,
  ResearchSourceType,
} from "@/lib/research/types";

export type RecommendedCatalogKind = "book" | "organization";

export type RecommendedCatalogEntry = {
  slug: string;
  kind: RecommendedCatalogKind;
  title: string;
  author_text: string | null;
  organization: string | null;
  source_type: ResearchSourceType;
  publication_year: number | null;
  description: string;
  topics: string[];
  life_stages: string[];
  evidence_basis: ResearchEvidenceBasis | null;
  evidence_rating: ResearchEvidenceRating | null;
  ownership_status: ResearchOwnershipStatus | null;
};

export const RECOMMENDED_LIBRARY_SEED: RecommendedCatalogEntry[] = [
  // Pregnancy
  {
    slug: "expecting-better-emily-oster",
    kind: "book",
    title: "Expecting Better",
    author_text: "Emily Oster",
    organization: null,
    source_type: "book",
    publication_year: 2013,
    description:
      "Data-oriented guide to pregnancy decisions. Metadata recommendation only — we do not host book content.",
    topics: ["pregnancy", "health_and_safety"],
    life_stages: ["pre_birth_planning", "pregnancy"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  {
    slug: "cribsheet-emily-oster",
    kind: "book",
    title: "Cribsheet",
    author_text: "Emily Oster",
    organization: null,
    source_type: "book",
    publication_year: 2019,
    description:
      "Evidence-focused look at early parenting choices. Metadata recommendation only — we do not host book content.",
    topics: ["newborn", "infant", "sleep", "nutrition"],
    life_stages: ["newborn_0_3", "infant_3_12", "young_toddler_1_2"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  // Sleep
  {
    slug: "precious-little-sleep-alexis-dubief",
    kind: "book",
    title: "Precious Little Sleep",
    author_text: "Alexis Dubief",
    organization: null,
    source_type: "book",
    publication_year: 2017,
    description:
      "Practical infant and toddler sleep strategies. Metadata recommendation only — we do not host book content.",
    topics: ["sleep", "infant", "toddler"],
    life_stages: ["newborn_0_3", "infant_3_12", "young_toddler_1_2", "older_toddler_2_3"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "healthy-sleep-habits-happy-child-weissbluth",
    kind: "book",
    title: "Healthy Sleep Habits, Happy Child",
    author_text: "Marc Weissbluth",
    organization: null,
    source_type: "book",
    publication_year: 2015,
    description:
      "Pediatric sleep guidance across early childhood. Metadata recommendation only — we do not host book content.",
    topics: ["sleep", "infant", "toddler", "preschool"],
    life_stages: [
      "newborn_0_3",
      "infant_3_12",
      "young_toddler_1_2",
      "older_toddler_2_3",
      "preschool_3_5",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  // Parenting
  {
    slug: "good-inside-becky-kennedy",
    kind: "book",
    title: "Good Inside",
    author_text: "Becky Kennedy",
    organization: null,
    source_type: "book",
    publication_year: 2022,
    description:
      "Connection-focused parenting framework. Metadata recommendation only — we do not host book content.",
    topics: ["emotional_development", "discipline", "family_systems"],
    life_stages: [
      "young_toddler_1_2",
      "older_toddler_2_3",
      "preschool_3_5",
      "early_elementary_5_8",
      "later_elementary_8_11",
      "all_stages",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "raising-good-humans-hunter-clarke-fields",
    kind: "book",
    title: "Raising Good Humans",
    author_text: "Hunter Clarke-Fields",
    organization: null,
    source_type: "book",
    publication_year: 2019,
    description:
      "Mindful approaches to parenting stress and reactivity. Metadata recommendation only — we do not host book content.",
    topics: ["emotional_development", "parent_relationship", "discipline"],
    life_stages: ["all_stages"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "the-whole-brain-child-siegel-bryson",
    kind: "book",
    title: "The Whole-Brain Child",
    author_text: "Daniel J. Siegel & Tina Payne Bryson",
    organization: null,
    source_type: "book",
    publication_year: 2011,
    description:
      "Brain-informed strategies for everyday parenting moments. Metadata recommendation only — we do not host book content.",
    topics: ["emotional_development", "discipline", "toddler", "preschool"],
    life_stages: [
      "young_toddler_1_2",
      "older_toddler_2_3",
      "preschool_3_5",
      "early_elementary_5_8",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  {
    slug: "no-drama-discipline-siegel-bryson",
    kind: "book",
    title: "No-Drama Discipline",
    author_text: "Daniel J. Siegel & Tina Payne Bryson",
    organization: null,
    source_type: "book",
    publication_year: 2014,
    description:
      "Discipline approaches that connect before correcting. Metadata recommendation only — we do not host book content.",
    topics: ["discipline", "emotional_development"],
    life_stages: [
      "older_toddler_2_3",
      "preschool_3_5",
      "early_elementary_5_8",
      "later_elementary_8_11",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  {
    slug: "how-to-talk-so-little-kids-will-listen-faber-king",
    kind: "book",
    title: "How to Talk So Little Kids Will Listen",
    author_text: "Joanna Faber & Julie King",
    organization: null,
    source_type: "book",
    publication_year: 2017,
    description:
      "Communication tools for young children. Metadata recommendation only — we do not host book content.",
    topics: ["emotional_development", "discipline", "toddler", "preschool"],
    life_stages: ["young_toddler_1_2", "older_toddler_2_3", "preschool_3_5"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "hunt-gather-parent-michaeleen-doucleff",
    kind: "book",
    title: "Hunt, Gather, Parent",
    author_text: "Michaeleen Doucleff",
    organization: null,
    source_type: "book",
    publication_year: 2021,
    description:
      "Cross-cultural parenting practices reported for modern families. Metadata recommendation only — we do not host book content.",
    topics: ["family_systems", "emotional_development", "discipline"],
    life_stages: ["all_stages"],
    evidence_basis: "journalistic_source",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  // Montessori
  {
    slug: "the-montessori-baby-davies-uzodike",
    kind: "book",
    title: "The Montessori Baby",
    author_text: "Simone Davies & Junnifa Uzodike",
    organization: null,
    source_type: "book",
    publication_year: 2021,
    description:
      "Montessori-inspired care for babies. Metadata recommendation only — we do not host book content.",
    topics: ["education", "newborn", "infant"],
    life_stages: ["newborn_0_3", "infant_3_12"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "the-montessori-toddler-simone-davies",
    kind: "book",
    title: "The Montessori Toddler",
    author_text: "Simone Davies",
    organization: null,
    source_type: "book",
    publication_year: 2019,
    description:
      "Montessori-inspired approaches for toddlers. Metadata recommendation only — we do not host book content.",
    topics: ["education", "toddler", "emotional_development"],
    life_stages: ["young_toddler_1_2", "older_toddler_2_3"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  // Habits
  {
    slug: "atomic-habits-james-clear",
    kind: "book",
    title: "Atomic Habits",
    author_text: "James Clear",
    organization: null,
    source_type: "book",
    publication_year: 2018,
    description:
      "Habit formation frameworks useful for household systems. Metadata recommendation only — we do not host book content.",
    topics: ["family_systems", "parent_relationship"],
    life_stages: ["all_stages"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "tiny-habits-bj-fogg",
    kind: "book",
    title: "Tiny Habits",
    author_text: "BJ Fogg",
    organization: null,
    source_type: "book",
    publication_year: 2019,
    description:
      "Behavior-design approach to small sustainable changes. Metadata recommendation only — we do not host book content.",
    topics: ["family_systems", "parent_relationship"],
    life_stages: ["all_stages"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  // Marriage
  {
    slug: "fair-play-eve-rodsky",
    kind: "book",
    title: "Fair Play",
    author_text: "Eve Rodsky",
    organization: null,
    source_type: "book",
    publication_year: 2019,
    description:
      "Domestic workload and partnership systems. Metadata recommendation only — we do not host book content.",
    topics: ["parent_relationship", "family_systems"],
    life_stages: ["all_stages"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "seven-principles-making-marriage-work-gottman-silver",
    kind: "book",
    title: "The Seven Principles for Making Marriage Work",
    author_text: "John Gottman & Nan Silver",
    organization: null,
    source_type: "book",
    publication_year: 2015,
    description:
      "Research-informed relationship practices for couples. Metadata recommendation only — we do not host book content.",
    topics: ["parent_relationship", "family_systems"],
    life_stages: ["all_stages"],
    evidence_basis: "expert_authored_book",
    evidence_rating: "moderate",
    ownership_status: null,
  },
  // Finance
  {
    slug: "the-opposite-of-spoiled-ron-lieber",
    kind: "book",
    title: "The Opposite of Spoiled",
    author_text: "Ron Lieber",
    organization: null,
    source_type: "book",
    publication_year: 2015,
    description:
      "Raising money-smart kids. Metadata recommendation only — we do not host book content.",
    topics: ["financial_skills", "family_systems"],
    life_stages: [
      "preschool_3_5",
      "early_elementary_5_8",
      "later_elementary_8_11",
      "preteen",
      "teen",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  {
    slug: "smart-money-smart-kids-ramsey-cruze",
    kind: "book",
    title: "Smart Money Smart Kids",
    author_text: "Dave Ramsey & Rachel Cruze",
    organization: null,
    source_type: "book",
    publication_year: 2014,
    description:
      "Family money conversations and habits. Metadata recommendation only — we do not host book content.",
    topics: ["financial_skills", "family_systems"],
    life_stages: [
      "early_elementary_5_8",
      "later_elementary_8_11",
      "preteen",
      "teen",
    ],
    evidence_basis: "expert_authored_book",
    evidence_rating: "expert_opinion",
    ownership_status: null,
  },
  // Trusted organizations
  {
    slug: "org-american-academy-of-pediatrics",
    kind: "organization",
    title: "American Academy of Pediatrics",
    author_text: null,
    organization: "American Academy of Pediatrics",
    source_type: "professional_org_guidance",
    publication_year: null,
    description:
      "Trusted pediatric professional organization. Reference metadata only — link to official publications as needed; we do not host their content.",
    topics: ["health_and_safety", "newborn", "infant", "toddler"],
    life_stages: ["all_stages"],
    evidence_basis: "professional_consensus",
    evidence_rating: "high",
    ownership_status: "reference_only",
  },
  {
    slug: "org-cdc",
    kind: "organization",
    title: "CDC",
    author_text: null,
    organization: "Centers for Disease Control and Prevention",
    source_type: "government_guidance",
    publication_year: null,
    description:
      "U.S. public health guidance. Reference metadata only — consult official CDC materials; we do not host their content.",
    topics: ["health_and_safety", "pregnancy", "nutrition"],
    life_stages: ["all_stages"],
    evidence_basis: "government_guidance",
    evidence_rating: "high",
    ownership_status: "reference_only",
  },
  {
    slug: "org-acog",
    kind: "organization",
    title: "ACOG",
    author_text: null,
    organization: "American College of Obstetricians and Gynecologists",
    source_type: "professional_org_guidance",
    publication_year: null,
    description:
      "Obstetric and gynecologic professional guidance. Reference metadata only — we do not host their content.",
    topics: ["pregnancy", "birth", "health_and_safety"],
    life_stages: ["pre_birth_planning", "pregnancy", "labor_and_birth"],
    evidence_basis: "clinical_guideline",
    evidence_rating: "high",
    ownership_status: "reference_only",
  },
  {
    slug: "org-who",
    kind: "organization",
    title: "WHO",
    author_text: null,
    organization: "World Health Organization",
    source_type: "government_guidance",
    publication_year: null,
    description:
      "International public health guidance. Reference metadata only — consult official WHO materials; we do not host their content.",
    topics: ["health_and_safety", "nutrition", "pregnancy"],
    life_stages: ["all_stages"],
    evidence_basis: "government_guidance",
    evidence_rating: "high",
    ownership_status: "reference_only",
  },
  {
    slug: "org-nih",
    kind: "organization",
    title: "NIH",
    author_text: null,
    organization: "National Institutes of Health",
    source_type: "government_guidance",
    publication_year: null,
    description:
      "U.S. biomedical research agency. Reference metadata only — consult official NIH materials; we do not host their content.",
    topics: ["health_and_safety"],
    life_stages: ["all_stages"],
    evidence_basis: "government_guidance",
    evidence_rating: "high",
    ownership_status: "reference_only",
  },
  {
    slug: "org-zero-to-three",
    kind: "organization",
    title: "Zero to Three",
    author_text: null,
    organization: "Zero to Three",
    source_type: "professional_org_guidance",
    publication_year: null,
    description:
      "Early childhood development organization. Reference metadata only — we do not host their content.",
    topics: ["infant", "toddler", "emotional_development", "education"],
    life_stages: ["newborn_0_3", "infant_3_12", "young_toddler_1_2", "older_toddler_2_3"],
    evidence_basis: "professional_consensus",
    evidence_rating: "moderate",
    ownership_status: "reference_only",
  },
];

export const RECOMMENDED_LIBRARY: RecommendedCatalogEntry[] = RECOMMENDED_LIBRARY_SEED;

export function getRecommendedBySlug(slug: string) {
  return RECOMMENDED_LIBRARY.find((e) => e.slug === slug) ?? null;
}
