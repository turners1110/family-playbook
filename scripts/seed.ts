import { promises as fs } from "fs";
import path from "path";
import { clearMemoryStore, ensureDataDir, writeStore, nowIso } from "@/lib/db/local-json-store";
import type { AppStore, Outcome, Question } from "@/lib/types/models";
import { LIFE_STAGE_LABELS, LIFE_STAGES, OUTCOME_DOMAIN_LABELS, OUTCOME_DOMAINS } from "@/lib/constants/enums";
import { questionSeedSchema } from "@/lib/validation/schemas";

const FAMILY_ID = "family_turner";
const SAM_USER = "user_sam";
const MICHELLE_USER = "user_michelle";
const SAM_MEMBER = "member_sam";
const MICHELLE_MEMBER = "member_michelle";

const CATEGORY_DEFS: { slug: string; label: string }[] = [
  ["family_identity", "Family identity"],
  ["family_mission", "Family mission"],
  ["core_values", "Core values"],
  ["desired_adult_outcomes", "Desired adult outcomes"],
  ["parent_partnership", "Parent partnership"],
  ["division_of_labor", "Division of labor"],
  ["conflict_between_parents", "Conflict between parents"],
  ["extended_family", "Extended family"],
  ["grandparents", "Grandparents"],
  ["family_boundaries", "Family boundaries"],
  ["pregnancy", "Pregnancy"],
  ["birth", "Birth"],
  ["postpartum_recovery", "Postpartum recovery"],
  ["newborn_care", "Newborn care"],
  ["feeding", "Feeding"],
  ["breastfeeding", "Breastfeeding"],
  ["formula", "Formula"],
  ["nutrition", "Nutrition"],
  ["food_culture", "Food culture"],
  ["sleep", "Sleep"],
  ["crying", "Crying"],
  ["soothing", "Soothing"],
  ["attachment", "Attachment"],
  ["emotional_development", "Emotional development"],
  ["discipline", "Discipline"],
  ["boundaries", "Boundaries"],
  ["tantrums", "Tantrums"],
  ["independence", "Independence"],
  ["responsibility", "Responsibility"],
  ["chores", "Chores"],
  ["allowance", "Allowance"],
  ["financial_education", "Financial education"],
  ["family_finances", "Family finances"],
  ["education", "Education"],
  ["daycare", "Daycare"],
  ["preschool", "Preschool"],
  ["school_choice", "School choice"],
  ["learning", "Learning"],
  ["reading", "Reading"],
  ["creativity", "Creativity"],
  ["play", "Play"],
  ["childcare", "Childcare"],
  ["technology", "Technology"],
  ["screens", "Screens"],
  ["internet", "Internet"],
  ["social_media", "Social media"],
  ["health", "Health"],
  ["mental_health", "Mental health"],
  ["safety", "Safety"],
  ["medical_decisions", "Medical decisions"],
  ["faith", "Faith"],
  ["culture", "Culture"],
  ["holidays", "Holidays"],
  ["traditions", "Traditions"],
  ["privacy", "Privacy"],
  ["praise", "Praise"],
  ["failure", "Failure"],
  ["competition", "Competition"],
  ["achievement", "Achievement"],
  ["kindness", "Kindness"],
  ["gratitude", "Gratitude"],
  ["resilience", "Resilience"],
  ["honesty", "Honesty"],
  ["consumerism", "Consumerism"],
  ["service", "Service"],
  ["future_siblings", "Future siblings"],
  ["crisis_planning", "Crisis planning"],
  ["work_and_leave", "Work and parental leave"],
  ["marriage", "Marriage"],
  ["family_routines", "Family routines"],
].map(([slug, label]) => ({ slug, label }));

const OUTCOMES_BY_DOMAIN: Record<string, string[]> = {
  character: [
    "Integrity",
    "Honesty",
    "Responsibility",
    "Humility",
    "Courage",
    "Gratitude",
    "Kindness",
    "Fairness",
    "Reliability",
    "Work ethic",
    "Self-respect",
    "Respect for others",
  ],
  emotional_development: [
    "Emotional regulation",
    "Resilience",
    "Confidence",
    "Patience",
    "Self-awareness",
    "Self-control",
    "Healthy optimism",
    "Ability to handle frustration",
    "Ability to ask for help",
    "Comfort with failure",
    "Healthy independence",
    "Secure attachment",
  ],
  thinking_and_learning: [
    "Curiosity",
    "Critical thinking",
    "Love of learning",
    "Creativity",
    "Focus",
    "Problem solving",
    "Sound judgment",
    "Adaptability",
    "Intellectual humility",
    "Media literacy",
    "Ability to change one’s mind",
    "Decision-making ability",
  ],
  relationships: [
    "Empathy",
    "Communication",
    "Conflict resolution",
    "Friendship skills",
    "Teamwork",
    "Leadership",
    "Listening",
    "Healthy boundaries",
    "Trustworthiness",
    "Ability to apologize",
    "Ability to forgive",
    "Ability to choose healthy partners",
  ],
  independence_and_life_skills: [
    "Independence",
    "Time management",
    "Organization",
    "Planning",
    "Cooking",
    "Cleaning",
    "Personal hygiene",
    "Basic home care",
    "Transportation skills",
    "Safety awareness",
    "Self-advocacy",
    "Ability to manage responsibilities",
  ],
  financial_skills: [
    "Delayed gratification",
    "Saving",
    "Budgeting",
    "Investing",
    "Understanding debt",
    "Consumer awareness",
    "Negotiation",
    "Earning",
    "Giving",
    "Risk assessment",
    "Understanding taxes",
    "Long-term planning",
    "Avoiding status spending",
    "Learning from small financial mistakes",
  ],
  health: [
    "Healthy eating",
    "Exercise habits",
    "Sleep habits",
    "Stress management",
    "Body awareness",
    "Preventive care",
    "Healthy relationship with food",
    "Healthy relationship with appearance",
    "Substance awareness",
    "Sexual health knowledge",
    "Digital wellness",
  ],
  citizenship_and_community: [
    "Service",
    "Civic awareness",
    "Respect for differences",
    "Community responsibility",
    "Environmental responsibility",
    "Appreciation for family history",
    "Cultural awareness",
    "Ethical use of influence",
  ],
};

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildOutcomes(): Outcome[] {
  const outcomes: Outcome[] = [];
  let order = 0;
  for (const domain of OUTCOME_DOMAINS) {
    for (const label of OUTCOMES_BY_DOMAIN[domain]) {
      order += 1;
      const slug = slugify(label);
      outcomes.push({
        id: `outcome_${slug}`,
        slug,
        domain_slug: domain,
        label,
        definition: `${label} is the capacity to practice this trait consistently in age-appropriate ways.`,
        why_it_matters: `${label} supports long-term wellbeing, relationships, and the adult your child becomes.`,
        healthy_development: `Healthy development of ${label.toLowerCase()} looks like gradual growth, repair after setbacks, and encouragement without shame.`,
        sort_order: order,
      });
    }
  }
  return outcomes;
}

async function loadQuestions(): Promise<Question[]> {
  const file = path.join(process.cwd(), "data", "seed", "questions.json");
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const ts = nowIso();
  return (raw as unknown[]).map((item) => {
    const parsed = questionSeedSchema.parse(item);
    return {
      ...parsed,
      created_at: ts,
      updated_at: ts,
    };
  });
}

async function main() {
  await ensureDataDir();
  const questionsPath = path.join(process.cwd(), "data", "seed", "questions.json");
  try {
    await fs.access(questionsPath);
  } catch {
    const { spawnSync } = await import("child_process");
    const result = spawnSync("pnpm", ["generate:questions"], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) throw new Error("Question generation failed");
  }

  const questions = await loadQuestions();
  const outcomes = buildOutcomes();
  const ts = nowIso();

  const store: AppStore = {
    demo_mode: true,
    current_user_id: SAM_USER,
    family: {
      id: FAMILY_ID,
      name: "Turner Family",
      created_at: ts,
      updated_at: ts,
    },
    users: [
      {
        id: SAM_USER,
        email: "sam@turner.family",
        display_name: "Sam Turner",
        created_at: ts,
      },
      {
        id: MICHELLE_USER,
        email: "michelle@turner.family",
        display_name: "Michelle Turner",
        created_at: ts,
      },
    ],
    members: [
      {
        id: SAM_MEMBER,
        family_id: FAMILY_ID,
        user_id: SAM_USER,
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: ts,
      },
      {
        id: MICHELLE_MEMBER,
        family_id: FAMILY_ID,
        user_id: MICHELLE_USER,
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: ts,
      },
    ],
    children: [
      {
        id: "child_expected",
        family_id: FAMILY_ID,
        display_name: "Baby Turner",
        birth_date: null,
        expected_due_date: "2026-12-15",
        notes: "Expected first child — babymoon preparation in progress.",
        created_at: ts,
      },
    ],
    life_stages: LIFE_STAGES.map((slug, index) => ({
      id: `ls_${slug}`,
      slug,
      label: LIFE_STAGE_LABELS[slug],
      sort_order: index + 1,
      babymoon_weighted: [
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
      ].includes(slug),
    })),
    categories: CATEGORY_DEFS.map((c, index) => ({
      id: `cat_${c.slug}`,
      slug: c.slug,
      label: c.label,
      parent_slug: null,
      sort_order: index + 1,
    })),
    outcome_domains: OUTCOME_DOMAINS.map((slug, index) => ({
      id: `od_${slug}`,
      slug,
      label: OUTCOME_DOMAIN_LABELS[slug],
      sort_order: index + 1,
    })),
    outcomes,
    development_maps: [
      {
        id: "odm_fin_1",
        outcome_id: "outcome_delayed_gratification",
        age_range: "Ages 2–4",
        guidance: ["Learn waiting", "Care for belongings", "Make simple choices"],
        sort_order: 1,
      },
      {
        id: "odm_fin_2",
        outcome_id: "outcome_saving",
        age_range: "Ages 5–7",
        guidance: ["Use small amounts of money", "Separate spending and saving", "Complete family responsibilities"],
        sort_order: 2,
      },
      {
        id: "odm_fin_3",
        outcome_id: "outcome_budgeting",
        age_range: "Ages 8–11",
        guidance: ["Use an allowance system", "Set savings goals", "Compare prices", "Learn tradeoffs"],
        sort_order: 3,
      },
      {
        id: "odm_fin_4",
        outcome_id: "outcome_investing",
        age_range: "Ages 12–14",
        guidance: ["Use a debit card with limits", "Build a basic budget", "Learn compound growth", "Discuss advertising and status"],
        sort_order: 4,
      },
      {
        id: "odm_fin_5",
        outcome_id: "outcome_understanding_taxes",
        age_range: "Ages 15–18",
        guidance: ["Earn income", "File a basic tax return", "Learn credit", "Invest", "Manage larger purchases", "Understand education costs"],
        sort_order: 5,
      },
    ],
    principles: [
      {
        id: "principle_adult_becomes",
        family_id: FAMILY_ID,
        slug: "optimize-for-the-adult",
        title: "Optimize for the adult the child becomes",
        statement:
          "We prioritize skills, character, judgment, emotional health, relationships, independence, and practical ability.",
        sort_order: 1,
      },
      {
        id: "principle_disagreement",
        family_id: FAMILY_ID,
        slug: "disagreement-is-information",
        title: "Disagreement is useful information",
        statement:
          "We preserve disagreements and uncertainty rather than forcing false consensus.",
        sort_order: 2,
      },
      {
        id: "principle_evidence",
        family_id: FAMILY_ID,
        slug: "evidence-and-values",
        title: "Evidence when strong, values when mixed",
        statement:
          "We use strong evidence over anecdotes, and family values when evidence is weak or mixed.",
        sort_order: 3,
      },
    ],
    questions,
    question_options: [
      {
        id: "opt_yes",
        question_id: questions.find((q) => q.question_type === "yes_or_no")?.id ?? questions[0].id,
        value: "yes",
        label: "Yes",
        sort_order: 1,
      },
      {
        id: "opt_no",
        question_id: questions.find((q) => q.question_type === "yes_or_no")?.id ?? questions[0].id,
        value: "no",
        label: "No",
        sort_order: 2,
      },
    ],
    answers: [],
    answer_versions: [],
    decisions: [],
    decision_versions: [],
    sessions: [],
    session_questions: [],
    knowledge_items: [
      {
        id: "know_safe_sleep",
        family_id: null,
        title: "Safe sleep basics (sample)",
        summary:
          "Sample content: Common pediatric guidance emphasizes a firm flat sleep surface, back sleeping, and avoiding soft bedding. Confirm current guidance with your pediatrician.",
        item_type: "safety_guidance",
        source: "Sample pediatric consensus summary",
        author: null,
        publication: "Sample content for discussion",
        publication_date: null,
        url: null,
        source_type: "expert_guidance",
        evidence_quality: "expert_consensus",
        life_stages: ["newborn_0_3", "infant_3_12"],
        categories: ["sleep", "safety"],
        related_question_ids: questions.filter((q) => q.categories.includes("sleep")).slice(0, 3).map((q) => q.id),
        related_decision_ids: [],
        related_outcome_ids: ["outcome_safety_awareness"],
        notes: "Labeled sample content — not personalized medical advice.",
        is_sample: true,
        date_added: ts,
        date_reviewed: null,
      },
      {
        id: "know_attachment",
        family_id: null,
        title: "Responsive caregiving and attachment (sample)",
        summary:
          "Sample content: Consistent, responsive caregiving is associated with secure attachment. Responsiveness does not require perfect parenting.",
        item_type: "research_summary",
        source: "Sample developmental summary",
        author: null,
        publication: "Sample content",
        publication_date: null,
        url: null,
        source_type: "research",
        evidence_quality: "moderate",
        life_stages: ["newborn_0_3", "infant_3_12"],
        categories: ["attachment", "emotional_development"],
        related_question_ids: questions.filter((q) => q.categories.includes("attachment")).slice(0, 3).map((q) => q.id),
        related_decision_ids: [],
        related_outcome_ids: ["outcome_secure_attachment"],
        notes: "Sample content for discussion.",
        is_sample: true,
        date_added: ts,
        date_reviewed: null,
      },
      {
        id: "know_open",
        family_id: FAMILY_ID,
        title: "Open research: sleep method tradeoffs",
        summary:
          "We want a clearer summary of evidence on different sleep approaches and parental wellbeing tradeoffs.",
        item_type: "open_research_question",
        source: null,
        author: "Sam & Michelle",
        publication: null,
        publication_date: null,
        url: null,
        source_type: "personal",
        evidence_quality: "unknown",
        life_stages: ["infant_3_12"],
        categories: ["sleep"],
        related_question_ids: [],
        related_decision_ids: [],
        related_outcome_ids: [],
        notes: null,
        is_sample: false,
        date_added: ts,
        date_reviewed: null,
      },
    ],
    cooling_off_items: [],
    reviews: [],
    bookmarks: [],
    activity_log: [
      {
        id: "act_seed",
        family_id: FAMILY_ID,
        actor_id: SAM_USER,
        event_type: "seed_initialized",
        entity_type: "family",
        entity_id: FAMILY_ID,
        metadata: { questions: questions.length, outcomes: outcomes.length },
        created_at: ts,
      },
    ],
    settings: {
      family_id: FAMILY_ID,
      hide_partner_answers_until_both_saved: true,
      dark_mode: "system",
      babymoon_target_date: "2026-10-15",
      babymoon_daily_questions: 10,
      include_perspective_history_in_playbook: false,
      updated_at: ts,
    },
    ai_outputs: [],
    playbook_versions: [],
    checklist_instances: [],
    checklist_tasks: [],
  };

  // Sample answers and decisions for demo realism
  const sampleQ = questions.find((q) => q.slug.includes("success-as-parents")) ?? questions[0];
  const sampleSleep = questions.find((q) => q.categories.includes("sleep")) ?? questions[1];

  store.answers.push({
    id: "answer_shared_success",
    family_id: FAMILY_ID,
    question_id: sampleQ.id,
    member_id: null,
    is_shared: true,
    payload: {
      text: "Success means raising a kind, capable adult and protecting our marriage while we do it.",
      notes: "First pass during planning weekend.",
    },
    status: "tentatively_decided",
    confidence: 4,
    bookmarked: true,
    needs_research: false,
    review_date: "2026-11-01",
    version: 1,
    created_at: ts,
    updated_at: ts,
  });
  store.answer_versions.push({
    id: "av_1",
    answer_id: "answer_shared_success",
    version: 1,
    payload: store.answers[0].payload,
    status: "tentatively_decided",
    confidence: 4,
    changed_by: SAM_USER,
    change_reason: "Initial shared answer",
    created_at: ts,
  });

  store.answers.push({
    id: "answer_sam_sleep",
    family_id: FAMILY_ID,
    question_id: sampleSleep.id,
    member_id: SAM_MEMBER,
    is_shared: false,
    payload: { text: "I want a plan that protects both of our sleep within safe practices." },
    status: "in_discussion",
    confidence: 3,
    bookmarked: false,
    needs_research: true,
    review_date: null,
    version: 1,
    created_at: ts,
    updated_at: ts,
  });
  store.answers.push({
    id: "answer_michelle_sleep",
    family_id: FAMILY_ID,
    question_id: sampleSleep.id,
    member_id: MICHELLE_MEMBER,
    is_shared: false,
    payload: { text: "I want responsiveness first, with room to adjust if exhaustion becomes unsafe." },
    status: "in_discussion",
    confidence: 3,
    bookmarked: false,
    needs_research: true,
    review_date: null,
    version: 1,
    created_at: ts,
    updated_at: ts,
  });

  store.decisions.push({
    id: "decision_visitor_limits",
    family_id: FAMILY_ID,
    title: "Visitor limits after birth",
    statement:
      "For the first two weeks, visits are by invitation only, short, and never overnight unless both parents agree.",
    problem: "Protect recovery, feeding, and bonding while staying connected to family.",
    reasoning: "Rest and boundaries matter more than pleasing relatives in the earliest days.",
    sam_perspective: "Prefer firm limits and a single update channel.",
    michelle_perspective: "Want warmth, but not open-door traffic.",
    shared_conclusion: "Invitation-only visits for two weeks; Sam coordinates messaging.",
    agreement_notes: "Both want rest protected.",
    disagreement_notes: null,
    status: "decided",
    confidence: 5,
    decision_type: "relational",
    evidence_strength: "practical_guidance",
    emotional_weight: 4,
    reversibility: "easy",
    child_dependent: false,
    life_stages: ["first_week", "newborn_0_3"],
    categories: ["extended_family", "postpartum_recovery"],
    research_notes: null,
    implementation_notes: "Text template ready for family group.",
    exceptions: "Grandparents may visit once in week one if both parents feel ready.",
    risks: "Family disappointment.",
    warning_signs: "Feeling dread before visits; missed naps; feeding disrupted.",
    reconsideration_conditions: "If either parent feels isolated or unsupported.",
    review_date: "2026-12-01",
    has_disagreement: false,
    version: 1,
    source_question_ids: questions
      .filter((q) => q.text.includes("visitor"))
      .slice(0, 2)
      .map((q) => q.id),
    outcome_ids: ["outcome_healthy_boundaries", "outcome_stress_management"],
    principle_ids: ["principle_adult_becomes"],
    created_at: ts,
    updated_at: ts,
  });
  store.decision_versions.push({
    id: "dv_1",
    decision_id: "decision_visitor_limits",
    version: 1,
    snapshot: { ...store.decisions[0] },
    changed_by: SAM_USER,
    change_reason: "Initial decision",
    created_at: ts,
  });

  store.reviews.push({
    id: "review_1",
    family_id: FAMILY_ID,
    entity_type: "decision",
    entity_id: "decision_visitor_limits",
    review_date: "2026-12-01",
    reason: "Post-birth boundary check-in",
    completed: false,
    created_at: ts,
  });

  store.cooling_off_items.push({
    id: "cool_1",
    family_id: FAMILY_ID,
    question_id: sampleSleep.id,
    decision_id: null,
    start_date: ts.slice(0, 10),
    wait_days: 7,
    reason: "High emotional weight; gather more information before locking a method.",
    revisit_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: null,
    active: true,
    created_at: ts,
  });

  clearMemoryStore();
  const { seedBeforeBabyIntoStore } = await import("@/lib/services/checklists");
  const seededTasks = seedBeforeBabyIntoStore(store);
  await writeStore(store);
  console.log(`Seeded Before Baby checklist tasks: ${seededTasks}`);

  // Also write portable seed JSON copies
  const seedDir = path.join(process.cwd(), "data", "seed");
  await fs.writeFile(path.join(seedDir, "outcomes.json"), JSON.stringify(outcomes, null, 2));
  await fs.writeFile(
    path.join(seedDir, "family.json"),
    JSON.stringify({ family: store.family, members: store.members, users: store.users }, null, 2),
  );
  await fs.writeFile(
    path.join(seedDir, "categories.json"),
    JSON.stringify(store.categories, null, 2),
  );
  await fs.writeFile(
    path.join(seedDir, "life_stages.json"),
    JSON.stringify(store.life_stages, null, 2),
  );

  console.log(`Seeded Turner Family Principles`);
  console.log(`Questions: ${questions.length}`);
  console.log(`Outcomes: ${outcomes.length}`);
  console.log(`Store: data/local-store.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
