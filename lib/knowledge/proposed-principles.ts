/**
 * Propose Family Principles from clusters of answered questions.
 * Drafts are answer-specific; generic filler is never used as a substitute.
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
import {
  craftPrincipleStatement,
  explainPrincipleGaps,
  extractAnswerThemes,
  mergeThemes,
} from "@/lib/knowledge/principle-synthesis";

export type PrincipleProposalFeedbackStatus =
  | "accepted"
  | "rejected"
  | "edited"
  | "deferred";

export type PrincipleProposalFeedback = {
  topic_slug: string;
  status: PrincipleProposalFeedbackStatus;
  decision_id?: string | null;
  statement?: string | null;
  updated_at: string;
};

export type ProposedPrincipleSourceAnswer = {
  questionId: string;
  questionSlug: string;
  questionText: string;
  preview: string;
  isShared: boolean;
  samPreview: string | null;
  michellePreview: string | null;
  agrees: boolean;
  specificity: number;
};

export type ProposedPrinciple = {
  id: string;
  topicSlug: string;
  title: string;
  /** Null when not enough useful information to draft. */
  statement: string | null;
  readyToDraft: boolean;
  sourceAnswers: ProposedPrincipleSourceAnswer[];
  agreements: string[];
  disagreements: string[];
  samThemes: string[];
  michelleThemes: string[];
  usedSpecifics: string[];
  confidence: 1 | 2 | 3 | 4 | 5;
  confidencePercent: number;
  missingExplanation: string | null;
  questionsBeforeFinalizing: Array<{
    id: string;
    slug: string;
    text: string;
    reason: string;
    impact: number;
  }>;
  answeredCount: number;
  importantTotal: number;
  importantAnswered: number;
  minAnswersRequired: number;
};

export type PrincipleTopicDef = {
  slug: string;
  title: string;
  keywords: string[];
  categories: string[];
  /** Friendly label for “draft a principle on X”. */
  shortLabel?: string;
};

export const PRINCIPLE_TOPICS: PrincipleTopicDef[] = [
  ...DECISION_TOPIC_SEEDS.map((t) => ({
    ...t,
    shortLabel: t.title,
  })),
  {
    slug: "partnership",
    title: "Partnership under stress",
    shortLabel: "Partnership",
    keywords: [
      "resentment",
      "exhausted",
      "disagreement",
      "check in",
      "relief",
      "fairness",
      "overload",
    ],
    categories: ["partnership", "relationship"],
  },
  {
    slug: "allowance",
    title: "Allowance and earning",
    shortLabel: "Allowance",
    keywords: ["allowance", "chore", "earn", "spending money", "save"],
    categories: ["money"],
  },
];

const MIN_ANSWERS_DEFAULT = 2;
const MIN_AVG_SPECIFICITY_TO_DRAFT = 3.5;

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
  return text.trim().length > 220 ? `${text.trim().slice(0, 217)}…` : text.trim();
}

export function questionMatchesTopic(
  question: Question,
  topic: Pick<PrincipleTopicDef, "keywords" | "categories">,
): boolean {
  const hay = [
    question.text,
    question.short_title,
    ...question.categories,
    ...question.subcategories,
  ]
    .join(" ")
    .toLowerCase();
  if (
    topic.categories.some((c) =>
      question.categories.map((x) => x.toLowerCase()).includes(c.toLowerCase()),
    )
  ) {
    return true;
  }
  return topic.keywords.some((k) => hay.includes(k.toLowerCase()));
}

function isImportantQuestion(q: Question): boolean {
  return (
    q.priority === "essential_before_birth" ||
    q.priority === "high" ||
    Boolean(q.babymoon_priority) ||
    Boolean(q.required_before_birth)
  );
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
    (d) =>
      (d.slug ?? "").toLowerCase() === topicSlug.toLowerCase() ||
      (d.slug ?? "").toLowerCase() === `principle-${topicSlug}`.toLowerCase(),
  );
  if (slugMatch) return slugMatch;
  return (
    store.decisions.find((d) =>
      d.title.toLowerCase().includes(title.toLowerCase().slice(0, 18)),
    ) ?? null
  );
}

function confidenceMetrics(input: {
  sources: ProposedPrincipleSourceAnswer[];
  importantAnswered: number;
  importantTotal: number;
  disagreementCount: number;
  readyToDraft: boolean;
}): { confidence: 1 | 2 | 3 | 4 | 5; percent: number } {
  const n = input.sources.length;
  const avgSpec =
    input.sources.reduce((s, x) => s + x.specificity, 0) / Math.max(n, 1);
  const coverage =
    input.importantTotal > 0
      ? input.importantAnswered / input.importantTotal
      : Math.min(1, n / 4);
  const agreeRate =
    input.sources.filter((s) => s.agrees || s.isShared).length / Math.max(n, 1);

  let percent = Math.round(
    coverage * 40 +
      Math.min(1, avgSpec / 8) * 25 +
      agreeRate * 25 +
      Math.min(1, n / 5) * 10,
  );
  if (input.disagreementCount > 0) percent -= input.disagreementCount * 8;
  if (!input.readyToDraft) percent = Math.min(percent, 55);
  percent = Math.max(5, Math.min(95, percent));

  const confidence = (
    percent >= 80 ? 5 : percent >= 65 ? 4 : percent >= 45 ? 3 : percent >= 25 ? 2 : 1
  ) as 1 | 2 | 3 | 4 | 5;
  return { confidence, percent };
}

function rankGapQuestions(
  unanswered: Question[],
  topic: PrincipleTopicDef,
): ProposedPrinciple["questionsBeforeFinalizing"] {
  return unanswered
    .map((q) => {
      let impact = 1;
      const reasons: string[] = [];
      if (q.priority === "essential_before_birth") {
        impact += 4;
        reasons.push("Essential before birth");
      } else if (q.priority === "high") {
        impact += 3;
        reasons.push("High importance");
      }
      if (q.babymoon_priority) {
        impact += 2;
        reasons.push("Babymoon priority");
      }
      if (topic.keywords.some((k) => q.text.toLowerCase().includes(k))) {
        impact += 2;
        reasons.push("Directly on-topic");
      }
      return {
        id: q.id,
        slug: q.slug,
        text: q.short_title || q.text,
        reason: reasons[0] ?? "Would strengthen this principle",
        impact,
      };
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
}

function buildProposalForTopic(
  store: AppStore,
  topic: PrincipleTopicDef,
): ProposedPrinciple | null {
  const fb = feedbackFor(store, topic.slug);
  if (fb?.status === "rejected" || fb?.status === "accepted") return null;
  if (existingDecisionForTopic(store, topic.slug, topic.title)) return null;

  const sam = store.members.find((m) => m.display_name === "Sam");
  const michelle = store.members.find((m) => m.display_name === "Michelle");

  const matchedQuestions = store.questions.filter((q) =>
    questionMatchesTopic(q, topic),
  );
  if (!matchedQuestions.length) return null;

  const important = matchedQuestions.filter(isImportantQuestion);
  const importantTotal = Math.max(important.length, matchedQuestions.length);
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

    const themeInputs = [sharedPrev, samPrev, michellePrev].filter(
      (t): t is string => Boolean(t?.trim()),
    );
    const themes = mergeThemes(themeInputs.map((t) => extractAnswerThemes(t)));
    const agrees = Boolean(
      shared ||
        (samPrev &&
          michellePrev &&
          samPrev.toLowerCase() === michellePrev.toLowerCase()),
    );
    sources.push({
      questionId: q.id,
      questionSlug: q.slug,
      questionText: q.short_title || q.text,
      preview: sharedPrev || samPrev || michellePrev || "",
      isShared: Boolean(shared),
      samPreview: samPrev,
      michellePreview: michellePrev,
      agrees,
      specificity: themes.specificity,
    });
  }

  const importantAnswered = important.filter((q) =>
    sources.some((s) => s.questionId === q.id),
  ).length;

  if (sources.length < MIN_ANSWERS_DEFAULT) return null;

  const avgSpecificity =
    sources.reduce((s, x) => s + x.specificity, 0) / sources.length;

  const agreements = sources
    .filter((s) => s.agrees || s.isShared)
    .map((s) => `${s.questionText}: ${s.preview}`);
  const disagreementRows = sources
    .filter((s) => !s.agrees && !s.isShared && s.samPreview && s.michellePreview)
    .map((s) => ({
      question: s.questionText,
      sam: s.samPreview!,
      michelle: s.michellePreview!,
    }));
  const disagreements = disagreementRows.map(
    (d) => `${d.question}: Sam — ${d.sam}; Michelle — ${d.michelle}`,
  );

  const samThemesMerged = mergeThemes(
    sources.map((s) => extractAnswerThemes(s.samPreview)),
  );
  const michelleThemesMerged = mergeThemes(
    sources.map((s) => extractAnswerThemes(s.michellePreview)),
  );
  const sharedThemesMerged = mergeThemes(
    sources
      .filter((s) => s.isShared || s.agrees)
      .map((s) => extractAnswerThemes(s.preview)),
  );

  const crafted =
    fb?.status === "edited" && fb.statement?.trim()
      ? { statement: fb.statement.trim(), usedSpecifics: ["edited by you"] }
      : craftPrincipleStatement({
          topicTitle: topic.shortLabel ?? topic.title,
          sharedPreviews: sources
            .filter((s) => s.isShared || s.agrees)
            .map((s) => s.preview),
          samThemes: samThemesMerged,
          michelleThemes: michelleThemesMerged,
          sharedThemes: sharedThemesMerged,
          disagreements: disagreementRows,
        });

  const readyToDraft = Boolean(
    crafted &&
      avgSpecificity >= MIN_AVG_SPECIFICITY_TO_DRAFT &&
      sources.length >= MIN_ANSWERS_DEFAULT &&
      (importantAnswered >= 2 || sources.length >= 3),
  );

  const unanswered = matchedQuestions.filter(
    (q) => !sources.some((s) => s.questionId === q.id),
  );
  const gaps = rankGapQuestions(
    unanswered.filter(isImportantQuestion).length
      ? unanswered.filter(isImportantQuestion)
      : unanswered,
    topic,
  );

  const { confidence, percent } = confidenceMetrics({
    sources,
    importantAnswered,
    importantTotal,
    disagreementCount: disagreementRows.length,
    readyToDraft,
  });

  const missingExplanation = readyToDraft
    ? percent < 70
      ? explainPrincipleGaps({
          answeredCount: sources.length,
          importantUnanswered: gaps.length,
          disagreementCount: disagreementRows.length,
          avgSpecificity,
          hasShared: sources.some((s) => s.isShared || s.agrees),
        })
      : null
    : explainPrincipleGaps({
        answeredCount: sources.length,
        importantUnanswered: Math.max(
          0,
          importantTotal - importantAnswered,
        ),
        disagreementCount: disagreementRows.length,
        avgSpecificity,
        hasShared: sources.some((s) => s.isShared || s.agrees),
      });

  // Surface clusters that are close even if not fully ready — but only with statement when crafted.
  if (!readyToDraft && !crafted && sources.length < 3) return null;

  return {
    id: `pp_${topic.slug}`,
    topicSlug: topic.slug,
    title: topic.title,
    statement: crafted?.statement ?? null,
    readyToDraft: Boolean(readyToDraft && crafted?.statement),
    sourceAnswers: sources.slice(0, 10),
    agreements,
    disagreements,
    samThemes: [
      ...samThemesMerged.ages,
      ...samThemesMerged.rules,
      ...samThemesMerged.choices.slice(0, 3),
    ].slice(0, 6),
    michelleThemes: [
      ...michelleThemesMerged.ages,
      ...michelleThemesMerged.rules,
      ...michelleThemesMerged.choices.slice(0, 3),
    ].slice(0, 6),
    usedSpecifics: crafted?.usedSpecifics ?? [],
    confidence,
    confidencePercent: percent,
    missingExplanation,
    questionsBeforeFinalizing: gaps,
    answeredCount: sources.length,
    importantTotal,
    importantAnswered,
    minAnswersRequired: MIN_ANSWERS_DEFAULT,
  };
}

/**
 * Open proposals — includes ready drafts and near-ready clusters that need gaps filled.
 */
export function listProposedPrinciples(store: AppStore): ProposedPrinciple[] {
  const proposals: ProposedPrinciple[] = [];
  for (const topic of PRINCIPLE_TOPICS) {
    const p = buildProposalForTopic(store, topic);
    if (p) proposals.push(p);
  }
  return proposals.sort(
    (a, b) =>
      Number(b.readyToDraft) - Number(a.readyToDraft) ||
      b.confidencePercent - a.confidencePercent ||
      b.answeredCount - a.answeredCount,
  );
}

export function listReadyPrincipleProposals(
  store: AppStore,
): ProposedPrinciple[] {
  return listProposedPrinciples(store).filter((p) => {
    if (!p.readyToDraft || !p.statement) return false;
    const fb = feedbackFor(store, p.topicSlug);
    return fb?.status !== "deferred";
  });
}

export function getProposedPrinciple(
  store: AppStore,
  topicSlug: string,
): ProposedPrinciple | null {
  return buildProposalForTopic(
    store,
    PRINCIPLE_TOPICS.find((t) => t.slug === topicSlug) ?? {
      slug: topicSlug,
      title: topicSlug,
      keywords: [topicSlug],
      categories: [],
    },
  );
}

/** Topics touched by a set of question ids (session / module completion). */
export function topicsTouchedByQuestionIds(
  store: AppStore,
  questionIds: string[],
): PrincipleTopicDef[] {
  if (!questionIds.length) return [];
  const matched = new Set<string>();
  for (const topic of PRINCIPLE_TOPICS) {
    for (const q of store.questions) {
      if (
        questionIds.some(
          (id) => q.id === id || questionIdsRelated(q.id, id),
        ) &&
        questionMatchesTopic(q, topic)
      ) {
        matched.add(topic.slug);
      }
    }
  }
  return PRINCIPLE_TOPICS.filter((t) => matched.has(t.slug));
}

export function readyProposalsForQuestionIds(
  store: AppStore,
  questionIds: string[],
): ProposedPrinciple[] {
  const touched = new Set(
    topicsTouchedByQuestionIds(store, questionIds).map((t) => t.slug),
  );
  if (!touched.size) return [];
  return listReadyPrincipleProposals(store).filter((p) =>
    touched.has(p.topicSlug),
  );
}
