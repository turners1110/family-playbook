/**
 * Generates ≥300 high-quality seed questions across requested category targets.
 * Run: pnpm generate:questions
 */
import { promises as fs } from "fs";
import path from "path";
import type { QuestionSeed } from "@/lib/validation/schemas";
import type { LifeStage, QuestionPriority, QuestionType, ResearchMode } from "@/lib/constants/enums";

type Draft = Omit<QuestionSeed, "id" | "slug" | "logical_order" | "created_at" | "updated_at"> & {
  categoryBucket: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const EARLY: LifeStage[] = [
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
];

function q(
  text: string,
  opts: {
    category: string;
    categories?: string[];
    stages?: LifeStage[];
    outcomes?: string[];
    priority?: QuestionPriority;
    type?: QuestionType;
    separate?: boolean;
    cooling?: boolean;
    babymoon?: boolean;
    beforeBirth?: boolean;
    research?: ResearchMode;
    minutes?: number;
    why?: string;
    guidance?: string;
    tip?: string | null;
    evidence?: string | null;
    prompts?: string[];
    weight?: number;
    childDependent?: boolean;
  },
): Draft {
  const short = text.length > 60 ? text.slice(0, 57) + "…" : text;
  return {
    categoryBucket: opts.category,
    text,
    short_title: short,
    why_it_matters:
      opts.why ??
      "This choice shapes daily family life and the adult your child becomes. Discussing it early reduces stress when the moment arrives.",
    discussion_guidance:
      opts.guidance ??
      "Share instincts first, then note where evidence or experience might change your view. Record disagreement without forcing resolution.",
    question_type: opts.type ?? "joint_discussion",
    response_schema: { mode: "open_or_policy" },
    life_stages: opts.stages ?? ["all_stages"],
    categories: opts.categories ?? [opts.category],
    subcategories: [],
    outcomes: opts.outcomes ?? [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    priority: opts.priority ?? "medium",
    estimated_minutes: opts.minutes ?? 8,
    emotional_weight: opts.weight ?? 3,
    evidence_needed: opts.research === "strongly_recommended" || opts.research === "professional_guidance_needed",
    evidence_available: Boolean(opts.evidence),
    evidence_summary: opts.evidence ?? null,
    practical_tip: opts.tip ?? null,
    separate_answers_recommended: opts.separate ?? false,
    cooling_off_recommended: opts.cooling ?? false,
    follow_up_prompts: opts.prompts ?? [
      "What would make us revisit this?",
      "What does success look like in practice?",
    ],
    review_recommendation: null,
    child_dependent: opts.childDependent ?? false,
    required_before_birth: opts.beforeBirth ?? false,
    babymoon_priority: opts.babymoon ?? opts.beforeBirth ?? false,
    research_mode: opts.research ?? "optional_background",
    active: true,
  };
}

function buildQuestions(): Draft[] {
  const items: Draft[] = [];

  // Family identity and values (~30)
  items.push(
    q("What does success as parents mean to us?", {
      category: "family_identity",
      categories: ["family_identity", "core_values"],
      outcomes: ["self_respect", "kindness", "responsibility"],
      priority: "essential_before_birth",
      babymoon: true,
      beforeBirth: true,
      separate: true,
      type: "values_clarification",
      minutes: 12,
    }),
    q("What traits do we most hope our child develops?", {
      category: "desired_adult_outcomes",
      categories: ["desired_adult_outcomes", "core_values"],
      outcomes: ["integrity", "empathy", "curiosity"],
      priority: "essential_before_birth",
      babymoon: true,
      beforeBirth: true,
      type: "ranking",
      minutes: 15,
    }),
    q("What kind of relationship do we hope to have with our adult child?", {
      category: "family_identity",
      outcomes: ["trustworthiness", "communication", "empathy"],
      priority: "high",
      babymoon: true,
      separate: true,
    }),
    q("Which values are non-negotiable in our family?", {
      category: "core_values",
      outcomes: ["integrity", "honesty", "fairness"],
      priority: "essential_before_birth",
      babymoon: true,
      beforeBirth: true,
      separate: true,
      cooling: true,
    }),
    q("What does a loving home look and feel like to us?", {
      category: "family_identity",
      outcomes: ["secure_attachment", "kindness"],
      priority: "high",
      babymoon: true,
      beforeBirth: true,
    }),
    q("What parts of our own childhoods do we hope to repeat?", {
      category: "family_identity",
      categories: ["family_identity", "family_mission"],
      priority: "high",
      babymoon: true,
      separate: true,
      type: "reflection",
    }),
    q("What parts of our childhoods do we hope to change?", {
      category: "family_identity",
      priority: "high",
      babymoon: true,
      separate: true,
      type: "reflection",
      weight: 4,
    }),
    q("When values conflict, how should we choose between them?", {
      category: "core_values",
      outcomes: ["sound_judgment", "fairness"],
      priority: "high",
      babymoon: true,
      cooling: true,
      type: "tradeoff",
    }),
    q("How much should achievement matter in our family?", {
      category: "core_values",
      categories: ["core_values", "achievement"],
      outcomes: ["work_ethic", "healthy_optimism", "self_respect"],
      priority: "high",
      separate: true,
    }),
    q("How do we want our child to understand failure?", {
      category: "failure",
      categories: ["failure", "resilience", "core_values"],
      outcomes: ["comfort_with_failure", "resilience", "growth"],
      priority: "high",
      babymoon: true,
    }),
    q("What does our family mission statement sound like in one paragraph?", {
      category: "family_mission",
      priority: "high",
      babymoon: true,
      beforeBirth: true,
      type: "values_clarification",
    }),
    q("How should our child understand the purpose of family?", {
      category: "family_identity",
      outcomes: ["empathy", "gratitude"],
      priority: "medium",
    }),
    q("What stories from our families do we want to pass on?", {
      category: "traditions",
      categories: ["traditions", "culture", "family_identity"],
      outcomes: ["appreciation_for_family_history"],
      priority: "medium",
    }),
    q("How should we talk about money, status, and enough?", {
      category: "consumerism",
      categories: ["consumerism", "core_values", "family_finances"],
      outcomes: ["delayed_gratification", "avoiding_status_spending"],
      priority: "medium",
    }),
    q("What role should faith or spirituality play in our home, if any?", {
      category: "faith",
      categories: ["faith", "culture", "core_values"],
      priority: "high",
      separate: true,
      cooling: true,
      babymoon: true,
    }),
    q("How should we celebrate milestones without creating performance pressure?", {
      category: "achievement",
      categories: ["achievement", "praise"],
      outcomes: ["self_respect", "healthy_optimism"],
      priority: "medium",
    }),
    q("What does respect look like between parents and children at different ages?", {
      category: "core_values",
      outcomes: ["respect_for_others", "self_respect"],
      stages: EARLY,
      priority: "high",
    }),
    q("How should we define fairness when children have different needs?", {
      category: "fairness",
      categories: ["core_values", "future_siblings"],
      outcomes: ["fairness", "empathy"],
      priority: "medium",
      childDependent: true,
    }),
    q("What boundaries should protect our family’s private life?", {
      category: "privacy",
      categories: ["privacy", "family_identity"],
      priority: "high",
      babymoon: true,
      beforeBirth: true,
    }),
    q("How should we respond when relatives criticize our parenting choices?", {
      category: "extended_family",
      categories: ["extended_family", "family_boundaries"],
      priority: "essential_before_birth",
      babymoon: true,
      beforeBirth: true,
      separate: true,
    }),
    q("What traditions feel essential to preserve, and which can evolve?", {
      category: "traditions",
      categories: ["traditions", "culture", "holidays"],
      priority: "medium",
      separate: true,
    }),
    q("How should kindness and honesty interact when they conflict?", {
      category: "core_values",
      outcomes: ["kindness", "honesty"],
      priority: "high",
      type: "tradeoff",
    }),
    q("What does gratitude practice look like without forced performance?", {
      category: "gratitude",
      outcomes: ["gratitude"],
      priority: "medium",
    }),
    q("How much structure versus spontaneity do we want in family life?", {
      category: "family_routines",
      type: "scale",
      priority: "high",
      babymoon: true,
      separate: true,
    }),
    q("What does a calm evening at home look like for us?", {
      category: "family_routines",
      stages: EARLY,
      priority: "medium",
      babymoon: true,
    }),
    q("How should we define generosity in our family?", {
      category: "service",
      categories: ["service", "core_values"],
      outcomes: ["giving", "service"],
      priority: "medium",
    }),
    q("What cultural practices do we want our child to experience regularly?", {
      category: "culture",
      outcomes: ["cultural_awareness"],
      priority: "medium",
      separate: true,
    }),
    q("How should we handle holidays that create stress or conflict?", {
      category: "holidays",
      categories: ["holidays", "extended_family"],
      priority: "medium",
      cooling: true,
    }),
    q("What does integrity look like in everyday family decisions?", {
      category: "core_values",
      outcomes: ["integrity"],
      priority: "high",
      babymoon: true,
    }),
    q("How should we teach our child to apologize and repair?", {
      category: "kindness",
      categories: ["kindness", "emotional_development"],
      outcomes: ["ability_to_apologize", "empathy"],
      stages: EARLY,
      priority: "high",
    }),
  );

  // Parent partnership (~30)
  const partnership = [
    "How should we handle parenting disagreements in front of our child?",
    "What topics deserve private discussion before either parent acts?",
    "How should night duties be divided during the newborn stage?",
    "How should we respond when one parent feels overloaded?",
    "What should happen when one parent strongly disagrees with a settled decision?",
    "How should we protect time for our marriage after the baby arrives?",
    "How should we divide invisible household and parenting work?",
    "What does a fair division of labor mean when work schedules differ?",
    "How should we repair after speaking sharply to each other?",
    "Which decisions should trigger a cooling-off period?",
    "How will we check in weekly about parenting stress?",
    "What support do we each need during postpartum recovery?",
    "How should we communicate when we are too tired to discuss well?",
    "Who owns which recurring household tasks in the first three months?",
    "How should we handle advice from one parent’s family versus the other?",
    "What does backup look like when one parent is sick?",
    "How should we decide who stays home for sick days later on?",
    "What boundaries protect our couple time once extended family visits begin?",
    "How should we share emotional labor around planning and remembering?",
    "What words or tones are off-limits during parenting conflict?",
    "How should we handle one parent wanting more visitors than the other?",
    "How will we revisit division of labor after parental leave ends?",
    "What does mutual respect look like when we disagree about sleep?",
    "How should we support each other’s mental health after birth?",
    "When should we invite outside help rather than push through alone?",
    "How should we talk about resentment before it grows?",
    "What does a fair weekend look like with a newborn?",
    "How should we handle different risk tolerances around safety?",
    "How will we document decisions so we do not re-argue the same ground?",
    "What does repair look like after we undermine each other in front of others?",
  ];
  partnership.forEach((text, i) => {
    items.push(
      q(text, {
        category: "parent_partnership",
        categories: ["parent_partnership", i < 8 ? "division_of_labor" : "conflict_between_parents"],
        stages: i < 10 ? ["pregnancy", "first_week", "newborn_0_3"] : EARLY,
        outcomes: ["communication", "conflict_resolution", "trustworthiness"],
        priority: i < 12 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 12,
        separate: true,
        cooling: i % 4 === 0,
        minutes: 10,
        weight: 4,
      }),
    );
  });

  // Pregnancy and birth (~35)
  const pregnancy = [
    ["Who should attend the birth?", true],
    ["What role should each parent have during labor?", true],
    ["How should family members receive updates during labor and birth?", true],
    ["What visitor limits should apply after birth?", true],
    ["Which birth preferences matter most to us?", true],
    ["How should we respond when the birth plan changes?", true],
    ["What decisions should be delegated to medical professionals?", true],
    ["What support will Michelle need during recovery?", true],
    ["What responsibilities should Sam own during the first two weeks?", true],
    ["How should we protect rest after birth?", true],
    ["What pain management preferences do we want discussed with our care team?", true],
    ["How should we prepare for an unexpected C-section?", true],
    ["Who is our designated decision partner if Michelle cannot speak for herself?", true],
    ["What postpartum mental health signs should trigger immediate help?", true],
    ["How do we want to handle photos and social media after birth?", true],
    ["What hospital bag items matter most to each of us?", false],
    ["How should we prepare siblings or pets, if relevant, for the baby’s arrival?", false],
    ["What prenatal classes or education feel worthwhile?", false],
    ["How involved should we be in choosing a pediatrician before birth?", true],
    ["What is our plan for cord blood, delayed clamping, and related choices?", true],
    ["How should we approach genetic testing and screening decisions?", true],
    ["What birth environment preferences matter if we have options?", false],
    ["How will we handle conflicting medical advice from different clinicians?", true],
    ["What does advocacy look like in the delivery room?", true],
    ["How should we plan meals and household support for the first two weeks?", true],
    ["What boundaries apply to overnight guests after birth?", true],
    ["How should we communicate feeding plans to hospital staff?", true],
    ["What is our approach to delayed bathing and skin-to-skin contact?", false],
    ["How will we handle work leave logistics and income during leave?", true],
    ["What contingency plan do we have if recovery takes longer than expected?", true],
    ["How should we prepare for breastfeeding support or lactation consults?", true],
    ["What does a calm postpartum home environment require from visitors?", true],
    ["How will we share the birth story, and with whom?", false],
    ["What packing and logistics plan reduces day-of stress?", false],
    ["How should we decide whether to hire a doula or postpartum support?", true],
  ] as const;
  pregnancy.forEach(([text, essential], i) => {
    items.push(
      q(text, {
        category: "pregnancy",
        categories: i < 10 ? ["pregnancy", "birth"] : ["pregnancy", "postpartum_recovery"],
        stages: ["pregnancy", "labor_and_birth", "first_week"],
        priority: essential ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: essential,
        separate: i % 3 === 0,
        research: i % 5 === 0 ? "helpful_before_decision" : "optional_background",
        minutes: 8,
      }),
    );
  });

  // Postpartum and first weeks (~30)
  const postpartum = [
    "How should we divide overnight care in the first weeks?",
    "How will we protect Michelle’s recovery while keeping Sam involved?",
    "What is our plan for accepting or declining visitors in week one?",
    "How should we handle unsolicited parenting advice?",
    "What signs should trigger a call to the pediatrician?",
    "How should we handle visitors who ignore boundaries?",
    "What information should caregivers receive about our routines?",
    "How much structure do we want during the first three months?",
    "How should we decide when a routine is not working?",
    "How should we support secure attachment from the start?",
    "How should we protect each parent’s mental health postpartum?",
    "What does a sustainable feeding night look like for both of us?",
    "How will we track appointments, vaccines, and follow-ups?",
    "What household tasks can wait, and which cannot?",
    "How should we handle family members who want to hold the baby constantly?",
    "What is our plan for postpartum body image conversations?",
    "How will we notice and respond to signs of postpartum depression or anxiety?",
    "What support network can we activate in the first month?",
    "How should we approach bathing, diapering, and care confidence together?",
    "What does a good day look like when both parents are exhausted?",
    "How should we communicate needs without keeping score?",
    "What is our plan for pet care and home logistics after birth?",
    "How will we handle photos of the baby shared by relatives?",
    "What recovery markers mean Michelle needs more help immediately?",
    "How should we schedule check-ins about whether our plan is working?",
    "What does ‘good enough’ parenting look like in week one?",
    "How will we protect sleep for the parent who is not on overnight duty?",
    "How should we introduce the baby to extended family over time?",
    "What emergency contacts and medical info should be posted at home?",
    "How will we celebrate small wins without pretending it is easy?",
  ];
  postpartum.forEach((text, i) => {
    items.push(
      q(text, {
        category: "postpartum_recovery",
        categories: ["postpartum_recovery", "newborn_care"],
        stages: ["first_week", "newborn_0_3"],
        outcomes: ["secure_attachment", "stress_management", "healthy_independence"],
        priority: i < 15 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 15,
        separate: i % 2 === 0,
        research: i === 4 || i === 16 ? "professional_guidance_needed" : "optional_background",
        evidence:
          i === 4
            ? "Sample content: Pediatric guidance commonly urges contacting a clinician for fever in young infants, poor feeding, or unusual lethargy. Confirm with your care team."
            : null,
      }),
    );
  });

  // Newborn care (~40)
  const newborn = [
    "What is our approach to feeding in the newborn stage?",
    "How should we respond to conflicting advice about pacifiers?",
    "How will we share daytime baby care during leave?",
    "What soothing methods do we want to try first?",
    "How should we handle prolonged crying when we feel overwhelmed?",
    "What is our plan for tummy time and early movement?",
    "How should we decide on swaddling and safe sleep setup?",
    "What clothing and temperature practices feel right for our home?",
    "How will we track wet diapers, feeds, and concerns without obsession?",
    "What does responsive care mean to us in practice?",
    "How should we introduce the baby to different caregivers?",
    "What hygiene practices matter most for newborn care?",
    "How should we handle nail care, cord care, and skin concerns?",
    "What is our approach to white noise and the sleep environment?",
    "How will we know if our soothing strategy needs a change?",
    "What role should babywearing play, if any?",
    "How should we approach early reading and talking to the baby?",
    "What does overstimulation look like, and how will we respond?",
    "How should we handle cluster feeding nights emotionally?",
    "What boundaries protect feeding time from interruptions?",
    "How will we divide laundry, bottles, and pump parts if used?",
    "What is our plan for the first pediatric visits together?",
    "How should we respond if growth or feeding concerns arise?",
    "What does a calm bedtime wind-down look like for a newborn?",
    "How should we handle differing advice about schedules versus cues?",
    "What safety checks will we complete before the baby arrives?",
    "How will we practice putting the baby down drowsy but safe?",
    "What is our approach to outdoor time in the early weeks?",
    "How should we handle visitors during feeding and naps?",
    "What does teamwork look like during a difficult evening?",
    "How will we support the non-birthing parent’s bonding?",
    "What signs suggest we need more professional lactation or feeding help?",
    "How should we approach early screen exposure for adults around the baby?",
    "What is our plan for car seat safety and travel in the first months?",
    "How will we handle illness in the household with a newborn?",
    "What does a weekly reset ritual look like for both parents?",
    "How should we document memories without living behind a camera?",
    "What support do we want from friends versus family?",
    "How will we decide when to leave the house for longer outings?",
    "What does success look like at the end of month one?",
  ];
  newborn.forEach((text, i) => {
    items.push(
      q(text, {
        category: "newborn_care",
        stages: ["newborn_0_3"],
        outcomes: ["secure_attachment", "safety_awareness"],
        priority: i < 20 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 12,
        separate: i % 3 === 0,
        research: i % 6 === 0 ? "helpful_before_decision" : "optional_background",
        tip: i === 6 ? "Safe sleep guidance emphasizes a firm flat surface, no soft bedding, and placing baby on their back. Verify current guidance with your pediatrician." : undefined,
      }),
    );
  });

  // Sleep (~25)
  const sleep = [
    "What are our goals for sleep during the first year?",
    "How do we weigh parental sleep against preferred sleep methods?",
    "Which sleep practices require professional guidance?",
    "How long should we try a sleep approach before reviewing it?",
    "What level of crying feels acceptable to us during sleep learning?",
    "How should we respond if we strongly disagree about sleep training?",
    "What bedtime habits do we want to establish?",
    "How should travel affect sleep routines?",
    "How flexible should bedtime be?",
    "Which sleep decisions depend on the child’s temperament?",
    "Where should the baby sleep in the first six months?",
    "How should we handle night wakings after the newborn stage?",
    "What role should dream feeds or night nursing play, if any?",
    "How will we protect each other’s sleep shifts fairly?",
    "What does a sustainable 3 a.m. plan look like?",
    "How should naps be handled on weekends versus weekdays later on?",
    "When, if ever, would we consider a sleep consultant?",
    "How should we respond to family pressure about sleep methods?",
    "What signs suggest our sleep approach is not working?",
    "How will we revisit sleep decisions at three, six, and twelve months?",
    "What bedtime boundaries apply once a toddler can leave the crib or bed?",
    "How should illness change our sleep rules temporarily?",
    "What is our stance on bedsharing, roomsharing, and safety tradeoffs?",
    "How should we talk about sleep struggles without blame?",
    "What does ‘good enough sleep’ mean for our family in year one?",
  ];
  sleep.forEach((text, i) => {
    items.push(
      q(text, {
        category: "sleep",
        stages: ["newborn_0_3", "infant_3_12", "young_toddler_1_2"],
        outcomes: ["stress_management", "emotional_regulation"],
        priority: i < 10 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 8,
        separate: true,
        cooling: i === 5 || i === 22,
        research: i < 6 ? "helpful_before_decision" : "optional_background",
        childDependent: true,
        weight: 5,
        evidence:
          i === 2
            ? "Sample content: Evidence on sleep training methods is mixed by method and age; safety guidance around sleep environment is clearer. Separate values from safety constraints."
            : null,
      }),
    );
  });

  // Feeding (~25)
  const feeding = [
    "What does feeding success mean to us?",
    "How should we respond if breastfeeding is difficult?",
    "How should we avoid creating pressure around food?",
    "Will we require tasting unfamiliar foods?",
    "Will we prepare separate meals for a child who refuses dinner?",
    "How should dessert be treated?",
    "How should we talk about body size and weight?",
    "How should we teach healthy food choices?",
    "What role should family meals play?",
    "How should we respond to picky eating?",
    "What is our plan for formula, combination feeding, or bottle logistics?",
    "How will we introduce solids and allergens thoughtfully?",
    "What foods are never used as rewards or punishment?",
    "How should we handle food from grandparents that conflicts with our approach?",
    "What does a peaceful mealtime look like with a toddler?",
    "How should we talk about hunger, fullness, and stopping when satisfied?",
    "What is our approach to juice, snacks, and grazing?",
    "How will we handle food allergies or intolerances if they arise?",
    "What grocery and cooking division of labor supports family meals?",
    "How should cultural foods and family recipes be included?",
    "What is our stance on organic, processed foods, and practicality?",
    "How should we respond if one parent is more anxious about nutrition?",
    "What does feeding look like away from home—restaurants, travel, parties?",
    "How will we revisit feeding decisions as the child grows?",
    "How should we model our own relationship with food?",
  ];
  feeding.forEach((text, i) => {
    items.push(
      q(text, {
        category: "feeding",
        categories: i < 12 ? ["feeding", "breastfeeding", "nutrition"] : ["nutrition", "food_culture"],
        stages: EARLY,
        outcomes: ["healthy_eating", "healthy_relationship_with_food", "body_awareness"],
        priority: i < 10 ? "essential_before_birth" : "high",
        babymoon: i < 15,
        beforeBirth: i < 8,
        separate: i % 2 === 0,
        research: i === 11 ? "strongly_recommended" : "optional_background",
      }),
    );
  });

  // Health and safety (~30)
  const health = [
    "How will we make routine medical decisions together?",
    "What is our approach to vaccines and how will we stay informed?",
    "How should we decide when to go to urgent care versus wait?",
    "What safety proofing priorities matter before crawling?",
    "How will we handle medication dosing and tracking?",
    "What is our approach to screenings and developmental checkups?",
    "How should we talk about bodies, privacy, and consent from early ages?",
    "What first-aid skills should both parents have before birth?",
    "How will we handle fever, colds, and common infant illnesses?",
    "What is our plan for dental care as teeth appear?",
    "How should we approach sun safety, insects, and outdoor hazards?",
    "What water safety rules will we set for baths and later swimming?",
    "How will we choose and use car seats correctly over time?",
    "What household chemicals and medications storage standards do we need?",
    "How should we respond to minor injuries without panic or dismissal?",
    "What is our approach to antibiotics and over-the-counter medicines?",
    "How will we handle differing risk tolerance about playgrounds and climbing?",
    "What mental health support options should we know before we need them?",
    "How should we approach sleep safety if relatives care for the baby?",
    "What emergency plan do we have for fire, weather, or evacuation?",
    "How will we keep medical records organized and accessible?",
    "What is our stance on alternative remedies versus evidence-based care?",
    "How should we handle illness when both parents work?",
    "What does body autonomy teaching look like before age five?",
    "How will we talk about doctors so visits feel safer, not scary?",
    "What safety rules apply to pets and the baby?",
    "How should we approach choking hazards and food safety?",
    "What is our plan for CPR and infant first-aid training?",
    "How will we decide about circumcision or other elective procedures, if relevant?",
    "How should we revisit health decisions annually?",
  ];
  health.forEach((text, i) => {
    items.push(
      q(text, {
        category: "health",
        categories: i % 2 === 0 ? ["health", "safety"] : ["health", "medical_decisions"],
        stages: EARLY,
        outcomes: ["preventive_care", "safety_awareness", "body_awareness"],
        priority: i < 12 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 10,
        research: i === 1 || i === 27 ? "professional_guidance_needed" : "helpful_before_decision",
        separate: i % 4 === 0,
        cooling: i === 1 || i === 28,
      }),
    );
  });

  // Emotional development (~25)
  const emotional = [
    "How should we support secure attachment in daily routines?",
    "How much frustration should we allow before helping?",
    "How should we help our child name and regulate emotions?",
    "What does co-regulation look like when we are exhausted?",
    "How should we respond to big feelings without dismissing them?",
    "How will we teach asking for help as a strength?",
    "What does healthy independence look like at each early stage?",
    "How should we respond to separation anxiety?",
    "How will we model repairing after we lose our patience?",
    "What role should comfort objects play?",
    "How should we talk about fear without amplifying it?",
    "How will we help our child recover from disappointment?",
    "What does emotional honesty look like from parents?",
    "How should we handle clinginess versus forced independence?",
    "How will we notice if our child needs more support than usual?",
    "What practices build patience without shame?",
    "How should we respond when our child hurts someone?",
    "What does comfort look like after a scare or injury?",
    "How will we teach self-soothing without emotional abandonment?",
    "How should we celebrate courage in small everyday moments?",
    "What boundaries protect a child’s dignity during hard moments?",
    "How will we talk about our own emotions in age-appropriate ways?",
    "How should we handle jealousy if a sibling arrives later?",
    "What does secure attachment look like with multiple caregivers?",
    "How will we revisit emotional goals at each birthday?",
  ];
  emotional.forEach((text, i) => {
    items.push(
      q(text, {
        category: "emotional_development",
        categories: ["emotional_development", "attachment"],
        stages: EARLY,
        outcomes: [
          "emotional_regulation",
          "secure_attachment",
          "resilience",
          "ability_to_ask_for_help",
        ],
        priority: i < 10 ? "high" : "medium",
        babymoon: i < 12,
        separate: i % 3 === 0,
        type: i === 1 ? "scale" : "joint_discussion",
      }),
    );
  });

  // Discipline (~30)
  const discipline = [
    "What is the purpose of discipline in our family?",
    "Which forms of discipline are unacceptable to us?",
    "How should consequences relate to behavior?",
    "How should we handle lying?",
    "How should we respond to hitting?",
    "How should we handle public tantrums?",
    "What should happen when we lose our patience?",
    "When should a parent apologize to a child?",
    "How should we balance consistency and flexibility?",
    "What behaviors need firm limits?",
    "How should we avoid using shame?",
    "How should we handle disagreement about consequences?",
    "What role should time-ins or time-outs play, if any?",
    "How will we respond to defiance in the toddler years?",
    "What does natural consequence mean in our home?",
    "How should praise be used without creating people-pleasing?",
    "How will we teach repair after harm?",
    "What words are banned during correction?",
    "How should we handle sibling conflict later on?",
    "What is our approach to rewards and sticker charts?",
    "How will we stay aligned in public when one parent disagrees?",
    "What does respectful firmness sound like in our voices?",
    "How should we respond to whining versus clear requests?",
    "What limits apply around property damage and toys?",
    "How will we teach honesty after a mistake without fear of crushing punishment?",
    "What is our plan for biting in toddlerhood?",
    "How should we handle aggression that may signal unmet needs?",
    "When do we seek professional guidance about behavior?",
    "How will we review discipline approaches as language develops?",
    "What does accountability look like for parents and children?",
  ];
  discipline.forEach((text, i) => {
    items.push(
      q(text, {
        category: "discipline",
        categories: ["discipline", "boundaries", "tantrums"],
        stages: ["young_toddler_1_2", "older_toddler_2_3", "preschool_3_5", "early_elementary_5_8"],
        outcomes: ["self_control", "responsibility", "empathy", "fairness"],
        priority: i < 12 ? "high" : "medium",
        babymoon: i < 15,
        separate: true,
        cooling: i === 1 || i === 11,
        weight: 5,
      }),
    );
  });

  // Learning and play (~20)
  const learning = [
    "How should play factor into a typical day?",
    "What is our approach to early academics versus play-based learning?",
    "How will we build a reading ritual?",
    "How should we respond to messy creative play?",
    "What role should structured activities play before age five?",
    "How will we protect unstructured time?",
    "How should we talk about intelligence and effort?",
    "What does curiosity encouragement look like day to day?",
    "How will we handle boredom—as a problem or a skill builder?",
    "What is our approach to competitive sports later on?",
    "How should screens relate to learning, if at all, in early years?",
    "What toys and materials do we want to prioritize?",
    "How will we support creativity without constant products and crafts?",
    "What outdoor play norms do we want?",
    "How should we handle early interest in letters and numbers?",
    "What does a learning-rich home look like without pressure?",
    "How will we choose books and stories that match our values?",
    "How should we respond if our child learns differently than we expect?",
    "What is our stance on tutoring or enrichment before age eight?",
    "How will we celebrate learning without turning it into performance?",
  ];
  learning.forEach((text, i) => {
    items.push(
      q(text, {
        category: "learning",
        categories: ["learning", "play", "reading", "creativity"],
        stages: ["infant_3_12", "young_toddler_1_2", "preschool_3_5", "early_elementary_5_8"],
        outcomes: ["curiosity", "love_of_learning", "creativity", "focus"],
        priority: "medium",
        babymoon: i < 8,
      }),
    );
  });

  // Childcare and education (~20)
  const childcare = [
    "What childcare options are acceptable to us in the first years?",
    "How will we evaluate daycare or preschool quality?",
    "What values should a caregiver share with us?",
    "How should we handle guilt about using childcare?",
    "What information must caregivers know about our routines and limits?",
    "How will we decide on preschool timing?",
    "What is our early thinking about school choice?",
    "How should we partner with teachers later on?",
    "What does a good babysitter relationship require?",
    "How will we handle differences between home rules and childcare rules?",
    "What backup childcare plan do we need?",
    "How should grandparents provide childcare, if at all?",
    "What vaccination or health requirements matter for caregivers?",
    "How will we afford childcare, and what tradeoffs are acceptable?",
    "What does a transition plan into daycare look like?",
    "How should we respond if our child struggles with separation at care?",
    "What educational philosophies interest us, and why?",
    "How will we revisit school decisions as we learn our child’s needs?",
    "What role should standardized testing play in our thinking later?",
    "How should we talk about school with our child as they grow?",
  ];
  childcare.forEach((text, i) => {
    items.push(
      q(text, {
        category: "childcare",
        categories: ["childcare", "daycare", "preschool", "education", "school_choice"],
        stages: ["infant_3_12", "young_toddler_1_2", "preschool_3_5", "early_elementary_5_8"],
        outcomes: ["adaptability", "friendship_skills", "love_of_learning"],
        priority: i < 8 ? "high" : "medium",
        babymoon: i < 6,
        separate: i % 2 === 0,
        cooling: i === 6,
      }),
    );
  });

  // Family and grandparents (~20)
  const family = [
    "What role do we want grandparents to play?",
    "What boundaries apply to unsolicited advice from family?",
    "How often should extended family visit in the first months?",
    "How should we handle unequal involvement from different grandparents?",
    "What holidays will we prioritize, and with whom?",
    "How will we communicate birth announcements and updates?",
    "What caregiving roles are grandparents invited into?",
    "How should we handle gifts that conflict with our values?",
    "What does respect for elders look like alongside our parental authority?",
    "How will we protect our child from family conflict?",
    "What information about the baby is private versus shareable?",
    "How should we respond to favoritism or comparison?",
    "What travel expectations exist for seeing family?",
    "How will we handle religious or cultural pressure from relatives?",
    "What names, nicknames, and titles do we want used?",
    "How should we repair after a boundary conflict with family?",
    "What support do we welcome from family versus prefer to hire?",
    "How will we talk to our child about extended family relationships?",
    "What does a healthy relationship with in-laws require from each of us?",
    "How should we revisit family boundaries after the first year?",
  ];
  family.forEach((text, i) => {
    items.push(
      q(text, {
        category: "extended_family",
        categories: ["extended_family", "grandparents", "family_boundaries"],
        stages: ["pregnancy", "first_week", "newborn_0_3", "all_stages"],
        outcomes: ["healthy_boundaries", "communication", "respect_for_others"],
        priority: i < 10 ? "essential_before_birth" : "high",
        babymoon: true,
        beforeBirth: i < 8,
        separate: true,
        cooling: i % 5 === 0,
      }),
    );
  });

  // Technology (~15)
  const tech = [
    "What is our philosophy on screens in the early years?",
    "When, if ever, should a child have a personal device?",
    "How should we model our own phone use around children?",
    "What rules will govern TV or streaming before age five?",
    "How will we handle video calls with family?",
    "What is our approach to photos of our child online?",
    "How should we teach media literacy later?",
    "What boundaries apply to screens during meals?",
    "How will we handle social media when our child is older?",
    "What does digital wellness look like for parents?",
    "How should we respond to educational app pressure?",
    "What is our plan for internet safety education over time?",
    "How will we decide about gaming?",
    "What tech-free family rituals do we want?",
    "How should we revisit technology rules each year?",
  ];
  tech.forEach((text, i) => {
    items.push(
      q(text, {
        category: "technology",
        categories: ["technology", "screens", "internet", "social_media"],
        stages: EARLY.concat(["later_elementary_8_11", "preteen", "teen"]),
        outcomes: ["media_literacy", "digital_wellness", "focus"],
        priority: i < 6 ? "high" : "medium",
        babymoon: i < 5,
        separate: true,
      }),
    );
  });

  // Money, chores, responsibility (~20)
  const money = [
    "Should our child receive an allowance?",
    "Should allowance be tied to chores?",
    "Which chores should be expected as a family contribution?",
    "When should our child open a savings account?",
    "Should we match savings?",
    "When should we introduce investing concepts?",
    "How transparent should we be about family income?",
    "How should we teach the difference between cost and value?",
    "How should we teach delayed gratification with money and treats?",
    "Should our child be allowed to make small financial mistakes?",
    "How should gifts and spending money be handled?",
    "How should we discuss debt?",
    "How should we discuss giving and charity?",
    "How should we prevent status spending?",
    "What financial skills should be learned before adulthood?",
    "How will we divide financial roles as parents?",
    "What is our approach to college saving, if any?",
    "How should we talk about work and earning?",
    "What money lessons belong before age eight?",
    "How will we handle grandparents giving money or expensive gifts?",
  ];
  money.forEach((text, i) => {
    items.push(
      q(text, {
        category: "family_finances",
        categories: ["family_finances", "allowance", "chores", "financial_education"],
        stages: ["preschool_3_5", "early_elementary_5_8", "later_elementary_8_11", "teen", "young_adult"],
        outcomes: [
          "delayed_gratification",
          "saving",
          "budgeting",
          "responsibility",
          "avoiding_status_spending",
        ],
        priority: i < 8 ? "medium" : "low",
        babymoon: i < 5,
        separate: i % 2 === 0,
        type: i < 2 ? "yes_or_no" : "practical_planning",
      }),
    );
  });

  // Traditions, culture, faith (~15)
  const traditions = [
    "Which holidays will we actively celebrate?",
    "How should we blend traditions from both sides of the family?",
    "What weekly rituals do we want to create?",
    "How will faith practices, if any, appear in daily life?",
    "What cultural languages, foods, or stories should be present?",
    "How should we handle holidays that conflict with our energy or values?",
    "What birthday traditions matter most?",
    "How will we mark the changing seasons as a family?",
    "What service or community traditions do we want?",
    "How should we talk about cultural differences with respect?",
    "What does a meaningful Sunday—or shared weekly pause—look like?",
    "How will we create new traditions unique to our family?",
    "What role should music, art, or storytelling play in family culture?",
    "How should we handle religious education decisions?",
    "How will we revisit traditions as our child forms opinions?",
  ];
  traditions.forEach((text, i) => {
    items.push(
      q(text, {
        category: "traditions",
        categories: ["traditions", "culture", "faith", "holidays"],
        outcomes: ["cultural_awareness", "gratitude", "community_responsibility"],
        priority: "medium",
        babymoon: i < 6,
        separate: true,
        cooling: i === 13,
      }),
    );
  });

  // Future stages and long-term philosophy (~20)
  const future = [
    "Which five adult traits matter most to us?",
    "Which financial skills should our child learn before high school?",
    "How should we teach delayed gratification across childhood?",
    "How should we help our child learn from small mistakes?",
    "How should we teach responsibility without creating shame?",
    "How should we teach our child to question information?",
    "How should we teach our child to change their mind when evidence changes?",
    "What does healthy independence look like in the teen years?",
    "How should we approach dating and relationships later?",
    "What does preparation for adulthood include beyond academics?",
    "How will we talk about college, trades, and multiple good paths?",
    "What is our philosophy on competition?",
    "How should we handle achievement pressure from schools or peers?",
    "What does civic responsibility look like in our family?",
    "How will we teach apology, forgiveness, and boundary setting over time?",
    "What risks are worth allowing for growth?",
    "How should we prepare for the possibility of special needs or unexpected challenges?",
    "What crisis plans should we document for caregivers?",
    "How should we think about future siblings?",
    "What annual review ritual will keep our parenting aligned?",
  ];
  future.forEach((text, i) => {
    items.push(
      q(text, {
        category: "desired_adult_outcomes",
        categories: ["desired_adult_outcomes", "independence", "core_values"],
        stages: ["all_stages", "teen", "young_adult"],
        outcomes: ["sound_judgment", "independence", "critical_thinking", "integrity"],
        priority: i < 8 ? "high" : "future",
        babymoon: i < 7,
        beforeBirth: i < 5,
        separate: true,
        type: i === 0 ? "ranking" : "values_clarification",
      }),
    );
  });

  return items;
}

async function main() {
  const drafts = buildQuestions();
  const usedSlugs = new Set<string>();
  const questions: QuestionSeed[] = drafts.map((draft, index) => {
    let slug = slugify(draft.short_title);
    if (usedSlugs.has(slug)) slug = `${slug}-${index}`;
    usedSlugs.add(slug);
    const { categoryBucket: _c, ...rest } = draft;
    return {
      ...rest,
      id: `q_${slug.replace(/-/g, "_")}`.slice(0, 64),
      slug,
      logical_order: (index + 1) * 10,
    };
  });

  // Related question links: link neighbors in same primary category
  const byCat = new Map<string, string[]>();
  for (const question of questions) {
    const cat = question.categories[0];
    const list = byCat.get(cat) ?? [];
    list.push(question.id);
    byCat.set(cat, list);
  }
  for (const question of questions) {
    const cat = question.categories[0];
    const peers = byCat.get(cat) ?? [];
    const idx = peers.indexOf(question.id);
    const related = [peers[idx - 1], peers[idx + 1], peers[idx + 2]].filter(
      Boolean,
    ) as string[];
    question.related_questions = related;
  }

  const outDir = path.join(process.cwd(), "data", "seed");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "questions.json"),
    JSON.stringify(questions, null, 2),
  );

  const counts = drafts.reduce<Record<string, number>>((acc, d) => {
    acc[d.categoryBucket] = (acc[d.categoryBucket] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${questions.length} questions`);
  console.log(counts);
  if (questions.length < 300) {
    throw new Error(`Expected at least 300 questions, got ${questions.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
