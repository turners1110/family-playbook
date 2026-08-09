/**
 * Workshop-style context for Before Birth Essentials screens.
 * Pathway keeps purpose/helper/prompts; this layer adds explanation,
 * sample answers, research blurbs, and light prioritization metadata.
 */
import {
  getEssentialsScreenByQuestionId,
  type EssentialsScreenDef,
} from "@/lib/essentials/pathway";
import type { Question } from "@/lib/types/models";

export type SampleAnswer = {
  /** Short parenting-style label, e.g. "Connection-first" */
  style: string;
  text: string;
};

export type Score1to5 = 1 | 2 | 3 | 4 | 5;

export type EssentialsScreenEnrichment = {
  /** What later decisions / policies this shapes. */
  explanation: string;
  /** One or two sample answers from different styles. */
  examples: SampleAnswer[];
  /** Optional expert/evidence guidance (not medical advice). */
  related_research?: string;
  importance: Score1to5;
  /** How relevant this is before birth / early postpartum. */
  relevance_now: Score1to5;
  /** How much couples typically need to discuss. */
  difficulty: Score1to5;
  estimated_minutes: number;
  /** Screen ids that help to answer first (soft deps). */
  depends_on?: string[];
};

export type EssentialsWorkshopContext = {
  purpose: string | null;
  howTo: string | null;
  /** Null when enrichment is missing — never invent filler. */
  explanation: string | null;
  examples: SampleAnswer[];
  prompts: string[];
  relatedResearch: string | null;
  importance: Score1to5 | null;
  relevanceNow: Score1to5 | null;
  difficulty: Score1to5 | null;
  estimatedMinutes: number | null;
  dependsOn: string[];
};

const SCORE_LABELS: Record<Score1to5, string> = {
  1: "Low",
  2: "Mild",
  3: "Moderate",
  4: "High",
  5: "Critical",
};

export function scoreLabel(score: Score1to5): string {
  return SCORE_LABELS[score];
}

const ENRICHMENT: Record<string, EssentialsScreenEnrichment> = {
  f1_success: {
    explanation:
      "Your definition of success becomes the filter for later tradeoffs—sleep plans, visitor rules, work leave, and how hard you push yourselves.",
    examples: [
      {
        style: "Relationship-first",
        text: "Success means our child feels safe with both of us, and we still like each other at the end of hard weeks.",
      },
      {
        style: "Growth-first",
        text: "Success means our child becomes resilient and kind, even when that means short-term discomfort for us.",
      },
    ],
    related_research:
      "Parents who align early on values report fewer “whose rule is this?” fights in the first year. Treat this as a living definition, not a scorecard.",
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 15,
  },
  f2_loving_home: {
    explanation:
      "Home atmosphere choices shape visitor policies, conflict style, and which routines you protect when life gets loud.",
    examples: [
      {
        style: "Calm-structure",
        text: "We want calm, respectful, and safe for mistakes—even if that means fewer spontaneous guests.",
      },
      {
        style: "Warm-playful",
        text: "We want warm, playful, and welcoming—mess and noise are fine if connection stays high.",
      },
    ],
    importance: 4,
    relevance_now: 4,
    difficulty: 2,
    estimated_minutes: 10,
    depends_on: ["f1_success"],
  },
  f3_childhood: {
    explanation:
      "Naming what to repeat or change prevents inherited defaults from becoming unspoken family policy under stress.",
    examples: [
      {
        style: "Sam",
        text: "Repeat: weekend family breakfasts. Change: adults arguing without repair.",
      },
      {
        style: "Michelle",
        text: "Repeat: feeling taken seriously as a kid. Change: being told to stop crying.",
      },
    ],
    related_research:
      "Adult attachment and family-of-origin patterns often show up most during sleep deprivation. Naming them early makes repair faster later.",
    importance: 5,
    relevance_now: 4,
    difficulty: 5,
    estimated_minutes: 20,
    depends_on: ["f1_success"],
  },
  b1_labor_priorities: {
    explanation:
      "Labor priorities tell the partner and care team what to protect when plans shift—presence, advocacy, calm, and decision ownership.",
    examples: [
      {
        style: "Advocacy-focused",
        text: "Partner’s job is to ask questions, guard the birth preferences list, and speak up if Michelle feels rushed.",
      },
      {
        style: "Presence-focused",
        text: "Partner’s job is eye contact, comfort measures, and staying emotionally present; the nurse handles logistics.",
      },
    ],
    related_research:
      "Preferences help communication; they are not a contract. Flexible priorities with a clear advocate role reduce regret when plans change.",
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 15,
  },
  b2_flexible: {
    explanation:
      "Separating strong vs flexible preferences reduces conflict with providers and between partners when labor is unpredictable.",
    examples: [
      {
        style: "Strong-but-flexible",
        text: "We strongly prefer delayed cord clamping and delayed bathing, but we’ll defer if the baby needs immediate care.",
      },
      {
        style: "Non-negotiable-few",
        text: "Only two non-negotiables: continuous partner presence and clear explanation before any major intervention.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
    depends_on: ["b1_labor_priorities"],
  },
  b3_present_and_hospital_visitors: {
    explanation:
      "Presence and visitor rules protect recovery, bonding, and medical focus—and prevent awkward hallway negotiations.",
    examples: [
      {
        style: "Private labor",
        text: "Labor room is parents only; grandparents wait for a text after baby is stable and Michelle wants company.",
      },
      {
        style: "Support circle",
        text: "One support person plus partner may be present; brief hallway updates for others; no room visits until after first feed.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 4,
    estimated_minutes: 15,
    depends_on: ["b1_labor_priorities"],
  },
  b4_pain: {
    explanation:
      "Pain preferences guide partner advocacy and reduce pressure from well-meaning visitors—without locking you into one path.",
    examples: [
      {
        style: "Open to epidural",
        text: "Start with movement and comfort measures; epidural is welcome if Michelle asks—no guilt either way.",
      },
      {
        style: "Minimize meds if possible",
        text: "Prefer unmedicated if progressing well, but switch without debate if pain or exhaustion makes coping unsafe.",
      },
    ],
    related_research:
      "This is preference-setting for discussion with your care team—not medical advice. Revisit with your provider.",
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 12,
  },
  b5_urgent: {
    explanation:
      "An urgent-decision script keeps partners aligned when time is short and emotions are high.",
    examples: [
      {
        style: "Ask-then-decide",
        text: "Ask: Why now? What are options? Risks of waiting? Then Michelle decides unless she asks Sam to decide.",
      },
      {
        style: "Shared under pressure",
        text: "Either parent can pause for a 60-second private huddle before consenting to non-emergency changes.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 4,
    estimated_minutes: 12,
    depends_on: ["b1_labor_priorities", "b2_flexible"],
  },
  b6_cord_circumcision: {
    explanation:
      "Elective newborn decisions are easier before the hospital day—especially when one parent feels more strongly.",
    examples: [
      {
        style: "Defer / N/A",
        text: "Cord banking: not pursuing. Circumcision: not applicable / decide after provider counseling.",
      },
      {
        style: "Decided + researched",
        text: "We researched both; we will / will not pursue banking; circumcision decision is written and shared with the care team.",
      },
    ],
    related_research:
      "Mark needs research if you’re unsure. Elective choices can wait for clear counseling; don’t invent urgency.",
    importance: 3,
    relevance_now: 4,
    difficulty: 3,
    estimated_minutes: 10,
  },
  fs1_feeding_goals: {
    explanation:
      "Initial feeding goals set expectations for night support, visitor timing, and when to activate backup plans—without becoming a promise.",
    examples: [
      {
        style: "Breastfeeding-intent",
        text: "Goal is exclusive breastfeeding with lactation support early; formula is a tool, not a failure.",
      },
      {
        style: "Fed-is-best plan",
        text: "We will try breastfeeding, but combination feeding from day one is fine if supply, sleep, or mental health needs it.",
      },
    ],
    related_research:
      "Feeding plans often change. Couples who pre-approve backup options report less shame and faster problem-solving.",
    importance: 5,
    relevance_now: 5,
    difficulty: 4,
    estimated_minutes: 15,
  },
  fs2_backup: {
    explanation:
      "Backup feeding options remove 3 a.m. debates and clarify what help friends or grandparents can offer.",
    examples: [
      {
        style: "Prepared formula path",
        text: "Ready-to-feed formula is stocked; either parent can feed; pumping is optional, not required.",
      },
      {
        style: "Lactation-first path",
        text: "First call lactation consultant / pediatric advice; donor milk only if we both agree after counseling.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
    depends_on: ["fs1_feeding_goals"],
  },
  fs3_overnight: {
    explanation:
      "Overnight ownership and protected sleep blocks are the main defense against burnout and resentment in week one.",
    examples: [
      {
        style: "Shift system",
        text: "Michelle feeds 10pm–2am; Sam owns 2am–6am with bottle/pumped milk so Michelle gets one protected block.",
      },
      {
        style: "Same-room support",
        text: "Both wake for night feeds for two weeks; Sam handles diaper/settle while Michelle feeds, then swap who returns to sleep first.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 4,
    estimated_minutes: 15,
    depends_on: ["fs1_feeding_goals", "fs2_backup"],
  },
  fs4_sleep_change_signs: {
    explanation:
      "Pre-agreed change triggers stop you from waiting until someone breaks before asking for a new plan.",
    examples: [
      {
        style: "Symptom triggers",
        text: "If either parent has 2+ nights under 4 hours sleep, or Michelle’s mood drops for 3 days, we revise overnight roles.",
      },
      {
        style: "Calendar trigger",
        text: "We automatically review the sleep plan at day 5 and day 14, even if it “seems fine.”",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 2,
    estimated_minutes: 8,
    depends_on: ["fs3_overnight"],
  },
  fs5_safe_sleep: {
    explanation:
      "A shared safe-sleep baseline reduces middle-of-night improvisation and conflicting advice from visitors.",
    examples: [
      {
        style: "ABCs baseline",
        text: "Alone, back, crib—firm mattress, no loose bedding; bassinet in our room for the early months.",
      },
      {
        style: "Provider-guided",
        text: "We follow pediatric guidance for our situation and revisit if feeding or medical needs require exceptions.",
      },
    ],
    related_research:
      "Follow current pediatric safe-sleep guidance for your care team. This screen captures intention, not a medical protocol.",
    importance: 5,
    relevance_now: 5,
    difficulty: 2,
    estimated_minutes: 8,
  },
  p1_michelle_recovery: {
    explanation:
      "Protecting recovery needs becomes the filter for visitors, chores, and who gets to “help” in week one.",
    examples: [
      {
        style: "Rest-first",
        text: "Michelle’s non-negotiables: uninterrupted naps when baby sleeps, no hosting, meals brought to her.",
      },
      {
        style: "Mobility-first",
        text: "Short walks and shower time protected daily; visitors only if they reduce work, never increase it.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 12,
  },
  p2_household: {
    explanation:
      "Named owners for meals, laundry, cleaning, and updates prevent invisible labor from defaulting to one parent.",
    examples: [
      {
        style: "Sam ops lead",
        text: "Sam owns meals, laundry, and family updates for two weeks; cleaning is “good enough” or hired help.",
      },
      {
        style: "Split + outsorce",
        text: "Meal train + grocery delivery; Sam laundry; Michelle only baby + recovery; house tidy once midweek.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 12,
    depends_on: ["p1_michelle_recovery"],
  },
  p3_warning_signs: {
    explanation:
      "A shared help-seeking plan lowers the bar for calling a provider, friend, or emergency support.",
    examples: [
      {
        style: "Clear escalation",
        text: "Fever, heavy bleeding, thoughts of harm, or feeling unable to care for baby → call provider/urgent care immediately; Sam dials.",
      },
      {
        style: "Mood + body",
        text: "If either parent feels hopeless for more than 2 days, or Michelle’s pain worsens after day 3, we contact the care team same day.",
      },
    ],
    related_research:
      "Postpartum warning signs are time-sensitive. Use your provider’s discharge instructions as the source of truth.",
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 12,
  },
  p4_advice: {
    explanation:
      "A response script for advice and criticism protects the couple’s decisions and Michelle’s recovery energy.",
    examples: [
      {
        style: "United front",
        text: "Sam fields advice: “We’ve got a plan with our care team—thanks.” Private decisions stay private.",
      },
      {
        style: "Curious filter",
        text: "We thank people, write useful tips down, and decide together later—never in the moment under pressure.",
      },
    ],
    importance: 3,
    relevance_now: 4,
    difficulty: 3,
    estimated_minutes: 10,
  },
  pp1_exhausted: {
    explanation:
      "Exhausted-decision rules stop 2 a.m. policy fights and keep small choices from becoming relationship damage.",
    examples: [
      {
        style: "Default postpone",
        text: "Non-urgent decisions wait until both have had a nap or morning coffee. Urgent = safety/feeding only.",
      },
      {
        style: "One-owner nights",
        text: "On night shift, the awake parent decides routine baby care; big changes wait for a daytime check-in.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
  pp2_disagreement: {
    explanation:
      "Conflict and repair rules shape what the child later learns about fighting—and keep partners from scoring points while depleted.",
    examples: [
      {
        style: "Pause + repair",
        text: "No debating parenting policy in front of the baby when voices rise. Pause, care for baby, repair within 24 hours.",
      },
      {
        style: "Same team language",
        text: "We can disagree briefly, then say “same team” and pick a temporary experiment until the next check-in.",
      },
    ],
    importance: 5,
    relevance_now: 4,
    difficulty: 4,
    estimated_minutes: 15,
    depends_on: ["pp1_exhausted"],
  },
  pp3_relief: {
    explanation:
      "A relief signal prevents resentment from becoming the only communication channel.",
    examples: [
      {
        style: "Code word",
        text: "Saying “tag out” means the other parent takes the baby within 10 minutes—no explaining required.",
      },
      {
        style: "Scheduled relief",
        text: "Each parent gets a 45-minute off-duty block daily; asking for an extra one is always allowed.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 2,
    estimated_minutes: 8,
  },
  pp4_checkin: {
    explanation:
      "A standing check-in catches unfairness early and feeds the Review step of your family playbook.",
    examples: [
      {
        style: "Twice weekly",
        text: "Tue/Fri after dinner: stress 1–5, fairness 1–5, one appreciation, one ask.",
      },
      {
        style: "Weekly deep",
        text: "Sunday 20 minutes: what worked, what to change, one decision to revisit.",
      },
    ],
    importance: 4,
    relevance_now: 4,
    difficulty: 2,
    estimated_minutes: 8,
    depends_on: ["pp3_relief"],
  },
  v1_home_visitors: {
    explanation:
      "Home visitor rules protect feeding, sleep, and recovery—and give you a shared script before the first knock.",
    examples: [
      {
        style: "Quiet first two weeks",
        text: "No drop-ins. Scheduled visits ≤45 minutes. Guests help with a chore or bring food; they don’t hold baby if we’re mid-feed.",
      },
      {
        style: "Open with limits",
        text: "Close family welcome after day 3, afternoons only, hands washed, leave when we say we’re tired.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 4,
    estimated_minutes: 12,
    depends_on: ["p1_michelle_recovery"],
  },
  v2_photos: {
    explanation:
      "Photo rules prevent social-media surprises and family forwarding before you’re ready.",
    examples: [
      {
        style: "Private first month",
        text: "No public posts for 30 days. Private album only; no face photos forwarded without asking.",
      },
      {
        style: "Parents post first",
        text: "We post the first announcement; others may share after that with no location tags.",
      },
    ],
    importance: 3,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 8,
  },
  v3_grandparents: {
    explanation:
      "Grandparent hopes vs boundaries reduce loyalty conflicts and clarify childcare help later.",
    examples: [
      {
        style: "Warm with guardrails",
        text: "Weekly visits welcome after the first two weeks; overnight help later if sleep training / routines are respected.",
      },
      {
        style: "Slow ramp",
        text: "Short visits first; no unsupervised care until we both feel ready; advice goes through Sam.",
      },
    ],
    importance: 4,
    relevance_now: 4,
    difficulty: 4,
    estimated_minutes: 15,
    depends_on: ["v1_home_visitors"],
  },
  v4_health_and_comms: {
    explanation:
      "Health boundaries plus a designated communicator stop each parent from renegotiating the same rule.",
    examples: [
      {
        style: "Sam communicates",
        text: "No sick visits. Recent illness or fever in the household = reschedule. Sam sends the group text.",
      },
      {
        style: "Shared script",
        text: "Anyone visiting washes hands, no kissing baby’s face, vaccines discussed with our pediatrician’s guidance.",
      },
    ],
    related_research:
      "Align with your pediatrician’s guidance for newborn visitors; this captures your family rule and who enforces it.",
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
    depends_on: ["v1_home_visitors"],
  },
  w1_leave: {
    explanation:
      "Leave logistics (dates, pay, paperwork) determine overnight coverage and who is home for the hardest weeks.",
    examples: [
      {
        style: "Stacked leave",
        text: "Michelle: weeks 0–12. Sam: weeks 0–2 at home + weeks 8–10 solo stretch. Paperwork owners listed.",
      },
      {
        style: "Overlapping early",
        text: "Both home first 4 weeks if possible; unknowns flagged for HR follow-up this week.",
      },
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 15,
  },
  w2_return_childcare: {
    explanation:
      "Return-to-work and childcare plans drive budget, leave timing, and how soon routines need to stabilize.",
    examples: [
      {
        style: "Parent-care then daycare",
        text: "Home with parents through month 4, then daycare 3 days; one parent does drop-off.",
      },
      {
        style: "Family care",
        text: "Grandparent care 2 days + one parent WFH coverage; revisit at 6 months.",
      },
    ],
    importance: 5,
    relevance_now: 4,
    difficulty: 4,
    estimated_minutes: 20,
    depends_on: ["w1_leave"],
  },
  w3_daycare_details: {
    explanation:
      "Daycare transition details reduce last-minute stress if/when you use outside care.",
    examples: [
      {
        style: "Gradual start",
        text: "Shorter days first week; backup care listed; illness policy understood before enrollment deposit.",
      },
      {
        style: "Not using yet",
        text: "Not applicable right now—revisit if return-to-work date moves up.",
      },
    ],
    importance: 3,
    relevance_now: 3,
    difficulty: 2,
    estimated_minutes: 10,
    depends_on: ["w2_return_childcare"],
  },
  w4_legal_insurance: {
    explanation:
      "Insurance and legal tasks have deadlines; missing them creates avoidable stress after birth.",
    examples: [
      {
        style: "Checklist owners",
        text: "Sam: add baby to insurance within 30 days. Michelle: hospital pre-registration. Joint: wills/guardianship draft.",
      },
      {
        style: "Needs research",
        text: "We listed open questions for HR/benefits and a lawyer consult before 36 weeks.",
      },
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 2,
    estimated_minutes: 12,
  },
  h1_lulu_labor: {
    explanation:
      "A Lulu-during-labor plan prevents last-minute scrambling and protects focus in the hospital.",
    examples: [
      {
        style: "Primary + backup",
        text: "Friend A has Lulu from go-bag moment; Friend B is backup; crate/food ready by the door.",
      },
      {
        style: "Boarding",
        text: "Boarding reserved for estimated window; cancel policy understood; keys with neighbor.",
      },
    ],
    importance: 3,
    relevance_now: 5,
    difficulty: 2,
    estimated_minutes: 8,
  },
  h2_lulu_boundaries: {
    explanation:
      "Pet boundaries and first introduction protect the baby and reduce conflict about “where the dog can be.”",
    examples: [
      {
        style: "Supervised always",
        text: "Lulu never alone with baby; no face licking; gated out of sleep space; intro on leash with treats.",
      },
      {
        style: "Gradual access",
        text: "First week: short supervised hellos; Lulu’s bed stays in living room; training refresh before due date.",
      },
    ],
    importance: 3,
    relevance_now: 4,
    difficulty: 2,
    estimated_minutes: 8,
    depends_on: ["h1_lulu_labor"],
  },
  h3_home_setup: {
    explanation:
      "A 36-week home-setup list turns vague anxiety into finishable tasks before labor.",
    examples: [
      {
        style: "Minimum viable nest",
        text: "Bassinet ready, car seat installed/checked, go-bags packed, postpartum supplies stocked, freezer meals labeled.",
      },
      {
        style: "Done-enough list",
        text: "Skip nursery perfection; finish safety + feeding + recovery stations only.",
      },
    ],
    importance: 3,
    relevance_now: 5,
    difficulty: 1,
    estimated_minutes: 10,
  },
};

export function getEssentialsScreenEnrichment(
  screenId: string,
): EssentialsScreenEnrichment | null {
  return ENRICHMENT[screenId] ?? null;
}

export function resolveEssentialsWorkshopContext(
  screen: EssentialsScreenDef,
  question?: Question | null,
): EssentialsWorkshopContext {
  const enriched = getEssentialsScreenEnrichment(screen.id);
  const researchFromQuestion =
    question?.evidence_summary &&
    !GENERIC_EVIDENCE_MARKERS.some((m) =>
      question.evidence_summary!.includes(m),
    )
      ? question.evidence_summary
      : null;

  return {
    purpose: screen.purpose?.trim() || null,
    howTo: screen.helper?.trim() || null,
    explanation: enriched?.explanation?.trim() || null,
    examples: enriched?.examples ?? [],
    prompts: screen.prompts ?? [],
    relatedResearch: enriched?.related_research ?? researchFromQuestion,
    importance: enriched?.importance ?? null,
    relevanceNow: enriched?.relevance_now ?? null,
    difficulty: enriched?.difficulty ?? null,
    estimatedMinutes:
      enriched?.estimated_minutes ?? question?.estimated_minutes ?? null,
    dependsOn: enriched?.depends_on ?? [],
  };
}

/** Look up Essentials enrichment via linked library question id (fuzzy). */
export function getEssentialsEnrichmentForQuestionId(questionId: string) {
  const screen = getEssentialsScreenByQuestionId(questionId);
  if (!screen) return null;
  return {
    screen,
    enrichment: getEssentialsScreenEnrichment(screen.id),
  };
}

const GENERIC_EVIDENCE_MARKERS = [
  "No specific research loaded",
  "Discuss with your provider",
];

export function listEssentialsScreensMissingEnrichment(
  screens: ReadonlyArray<{ id: string }>,
): string[] {
  return screens.filter((s) => !ENRICHMENT[s.id]).map((s) => s.id);
}
