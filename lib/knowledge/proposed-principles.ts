/**
 * Propose Family Principles from clusters of answered questions.
 * Deterministic foundation — no LLM required. Accept creates a Decision.
 */
import type {
  Answer,
  AppStore,
  Decision,
  Question,
} from "@/lib/types/models";
import { DECISION_TOPIC_SEEDS } from "@/lib/knowledge/family-decisions";
import { questionIdsRelated } from "@/lib/conversations/deep-link";
import { previewLibraryAnswerText } from "@/lib/services/previously-answered";

export type PrincipleProposalFeedbackStatus =
  | "accepted"
  | "rejected"
  | "edited";

export type PrincipleProposalFeedback = {
  topic_slug: string;
  status: PrincipleProposalFeedbackStatus;
  decision_id?: string | null;
  statement?: string | null;
  updated_at: string;
};

export type ProposedPrincipleSourceAnswer = {
  questionId: string;
  questionText: string;
  preview: string;
  isShared: boolean;
  samPreview: string | null;
  michellePreview: string | null;
  agrees: boolean;
};

export type ProposedPrinciple = {
  id: string;
  topicSlug: string;
  title: string;
  statement: string;
  sourceAnswers: ProposedPrincipleSourceAnswer[];
  agreements: string[];
  disagreements: string[];
  confidence: 1 | 2 | 3 | 4 | 5;
  questionsBeforeFinalizing: Array<{
    id: string;
    slug: string;
    text: string;
    reason: string;
  }>;
  answeredCount: number;
  minAnswersRequired: number;
};

const MIN_ANSWERS_DEFAULT = 2;

/** Curated seed statements used when answer text is thin. */
const TOPIC_SEED_STATEMENTS: Record<string, string> = {
  money:
    "We want our children to learn that money comes from effort, choices have tradeoffs, and saving should happen before spending.",
  sleep:
    "We protect sleep as a family resource—safe sleep first, then fair overnight relief so neither parent burns out alone.",
  feeding:
    "Fed is the goal: we support our chosen feeding plan, approve backups without shame, and revisit when health or sanity needs it.",
  "visitors-after-birth":
    "Early visitors serve recovery and bonding—short, planned, helpful visits over drop-ins, with one of us owning the boundary.",
  "birth-plan":
    "We prepare preferences and an advocate role, stay flexible when medical needs change, and decide urgent calls with a shared script.",
  partnership:
    "We treat parenting as a same-team project: ask for relief early, repair after conflict, and check in before resentment hardens.",
  childcare:
    "Care arrangements should fit our values and logistics; we name owners, backups, and a review date before return-to-work pressure peaks.",
  screens:
    "Screens are a tool with limits—we decide age, content, and context together, and revisit when habits drift.",
  discipline:
    "We guide behavior with connection and clear limits, agree on consequences ahead of hard moments, and repair after we miss the mark.",
  "religion-values":
    "We name the values we want lived at home—and how we will talk about faith, difference, and belonging as our child grows.",
};

function answerPreview(answer: Answer | undefined): string | null {
  if (!answer) return null;
  const text =
    answer.payload.text ||
    answer.payload.quick ||
    (Array.isArray(answer.payload.choice)
      ? answer.payload.choice.join(", ")
      : typeof answer.payload.choice === "string"
        ? answer.payload.choice
        : null) ||
    null;
  if (!text?.trim()) return null;
  return text.trim().length > 180 ? `${text.trim().slice(0, 177)}…` : text.trim();
}

function questionMatchesTopic(
  question: Question,
  keywords: string[],
  categories: string[],
): boolean {
  const hay = [
    question.text,
    question.short_title,
    ...question.categories,
    ...question.subcategories,
  ]
    .join(" ")
    .toLowerCase();
  if (categories.some((c) => question.categories.map((x) => x.toLowerCase()).includes(c.toLowerCase()))) {
    return true;
  }
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function feedbackFor(
  store: AppStore,
  topicSlug: string,
): PrincipleProposalFeedback | null {
  const list = store.principle_proposal_feedback ?? [];
  return list.find((f) => f.topic_slug === topicSlug) ?? null;
}

function existingDecisionForTopic(
  store: AppStore,
  topicSlug: string,
  title: string,
): Decision | null {
  const slugMatch = store.decisions.find(
    (d) => (d.slug ?? "").toLowerCase() === topicSlug.toLowerCase(),
  );
  if (slugMatch) return slugMatch;
  return (
    store.decisions.find((d) =>
      d.title.toLowerCase().includes(title.toLowerCase().slice(0, 18)),
    ) ?? null
  );
}

function draftStatement(
  topicSlug: string,
  sources: ProposedPrincipleSourceAnswer[],
): string {
  const seed = TOPIC_SEED_STATEMENTS[topicSlug];
  const sharedBits = sources
    .filter((s) => s.isShared || s.agrees)
    .map((s) => s.preview)
    .filter(Boolean)
    .slice(0, 3);
  if (sharedBits.length >= 2) {
    const synthesized = sharedBits
      .map((b) => b.replace(/\.$/, ""))
      .join("; ");
    return `We want our family to live by this: ${synthesized}.`;
  }
  if (seed) return seed;
  if (sharedBits[0]) {
    return `As a family, we believe: ${sharedBits[0].replace(/\.$/, "")}.`;
  }
  return "We are forming a shared family principle from recent answers—edit this into your own words.";
}

function confidenceFrom(sources: ProposedPrincipleSourceAnswer[]): 1 | 2 | 3 | 4 | 5 {
  const n = sources.length;
  const agreeRate =
    sources.filter((s) => s.agrees || s.isShared).length / Math.max(n, 1);
  const disagree = sources.filter((s) => !s.agrees && !s.isShared).length;
  let score = 2;
  if (n >= 2) score += 1;
  if (n >= 4) score += 1;
  if (agreeRate >= 0.75) score += 1;
  if (disagree > 0) score -= 1;
  return Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Build open principle proposals from the current store.
 * Skips rejected topics and topics that already have an accepted decision.
 */
export function listProposedPrinciples(store: AppStore): ProposedPrinciple[] {
  const sam = store.members.find((m) => m.display_name === "Sam");
  const michelle = store.members.find((m) => m.display_name === "Michelle");
  const proposals: ProposedPrinciple[] = [];

  // Extra partnership seed (not in DECISION_TOPIC_SEEDS with same slug)
  const topics = [
    ...DECISION_TOPIC_SEEDS,
    {
      slug: "partnership",
      title: "Partnership under stress",
      keywords: ["resentment", "exhausted", "disagreement", "check in", "relief", "fairness"],
      categories: ["partnership", "relationship"],
    },
  ];

  for (const topic of topics) {
    const fb = feedbackFor(store, topic.slug);
    if (fb?.status === "rejected" || fb?.status === "accepted") continue;
    if (existingDecisionForTopic(store, topic.slug, topic.title)) continue;

    const matchedQuestions = store.questions.filter((q) =>
      questionMatchesTopic(q, topic.keywords, topic.categories),
    );
    const sources: ProposedPrincipleSourceAnswer[] = [];

    for (const q of matchedQuestions) {
      const answers = store.answers.filter(
        (a) =>
          a.question_id === q.id || questionIdsRelated(a.question_id, q.id),
      );
      if (!answers.length) continue;
      const shared = answers.find((a) => a.is_shared);
      const samA = answers.find((a) => a.member_id === sam?.id);
      const michelleA = answers.find((a) => a.member_id === michelle?.id);
      const samPrev = answerPreview(samA);
      const michellePrev = answerPreview(michelleA);
      const sharedPrev =
        answerPreview(shared) ?? previewLibraryAnswerText(answers);
      if (!sharedPrev && !samPrev && !michellePrev) continue;
      const agrees = Boolean(
        shared ||
          (samPrev &&
            michellePrev &&
            samPrev.toLowerCase() === michellePrev.toLowerCase()),
      );
      sources.push({
        questionId: q.id,
        questionText: q.short_title || q.text,
        preview: sharedPrev || samPrev || michellePrev || "",
        isShared: Boolean(shared),
        samPreview: samPrev,
        michellePreview: michellePrev,
        agrees,
      });
    }

    if (sources.length < MIN_ANSWERS_DEFAULT) continue;

    const agreements = sources
      .filter((s) => s.agrees || s.isShared)
      .map((s) => `${s.questionText}: ${s.preview}`);
    const disagreements = sources
      .filter((s) => !s.agrees && !s.isShared && s.samPreview && s.michellePreview)
      .map(
        (s) =>
          `${s.questionText}: Sam — ${s.samPreview}; Michelle — ${s.michellePreview}`,
      );

    const unansweredRelated = matchedQuestions
      .filter((q) => !sources.some((s) => s.questionId === q.id))
      .filter((q) => q.priority === "high" || q.priority === "essential_before_birth" || q.babymoon_priority)
      .slice(0, 3)
      .map((q) => ({
        id: q.id,
        slug: q.slug,
        text: q.short_title || q.text,
        reason: "Answering this would strengthen confidence before finalizing.",
      }));

    const statement =
      fb?.status === "edited" && fb.statement?.trim()
        ? fb.statement.trim()
        : draftStatement(topic.slug, sources);

    proposals.push({
      id: `pp_${topic.slug}`,
      topicSlug: topic.slug,
      title: topic.title,
      statement,
      sourceAnswers: sources.slice(0, 8),
      agreements,
      disagreements,
      confidence: confidenceFrom(sources),
      questionsBeforeFinalizing: unansweredRelated,
      answeredCount: sources.length,
      minAnswersRequired: MIN_ANSWERS_DEFAULT,
    });
  }

  return proposals.sort(
    (a, b) =>
      b.confidence - a.confidence || b.answeredCount - a.answeredCount,
  );
}

export function getProposedPrinciple(
  store: AppStore,
  topicSlug: string,
): ProposedPrinciple | null {
  return (
    listProposedPrinciples(store).find((p) => p.topicSlug === topicSlug) ??
    null
  );
}
