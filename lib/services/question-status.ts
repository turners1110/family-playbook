/**
 * Shared question answer-status helpers.
 * Build an index once per request — never N store reads per question.
 */

import type {
  Answer,
  AnswerPayload,
  AppStore,
  Decision,
  Question,
} from "@/lib/types/models";

export const QUESTION_STATUS_LABELS = {
  unanswered: "Unanswered",
  sam_answered: "Sam answered",
  michelle_answered: "Michelle answered",
  both_answered: "Both answered",
  shared_answer_saved: "Shared answer saved",
  undecided: "Undecided",
  needs_review: "Needs review",
  cooling_off: "Cooling off",
  answer_changed: "Answer changed",
} as const;

export type QuestionStatusKey = keyof typeof QUESTION_STATUS_LABELS;

export type PersonAnswerState = "unanswered" | "answered" | "draft";

export type QuestionAnswerStatus = {
  questionId: string;
  primary: QuestionStatusKey;
  label: string;
  sam: PersonAnswerState;
  michelle: PersonAnswerState;
  shared: PersonAnswerState;
  sharedDecisionStatus: string | null;
  sharedDecisionLabel: string;
  lastUpdatedAt: string | null;
  confidence: number | null;
  reviewDate: string | null;
  reviewDue: boolean;
  coolingOff: boolean;
  answerChanged: boolean;
  undecided: boolean;
  fullyAnswered: boolean;
  partiallyAnswered: boolean;
  /** Eligible for interview skip when fully answered and not needing attention */
  skipByDefault: boolean;
};

export type QuestionStatusFilter =
  | "all"
  | "unanswered"
  | "partial"
  | "both"
  | "shared_complete"
  | "undecided"
  | "needs_review"
  | "cooling_off";

export type QuestionStatusSort =
  | "unanswered_first"
  | "updated"
  | "needs_review_first"
  | "category"
  | "life_stage"
  | "logical";

const PRIMARY_PRIORITY: QuestionStatusKey[] = [
  "cooling_off",
  "needs_review",
  "answer_changed",
  "undecided",
  "shared_answer_saved",
  "both_answered",
  "sam_answered",
  "michelle_answered",
  "unanswered",
];

export function hasAnswerContent(payload: AnswerPayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.text?.trim()) return true;
  if (payload.quick?.trim()) return true;
  if (typeof payload.scale === "number") return true;
  if (Array.isArray(payload.ranking) && payload.ranking.length > 0) return true;
  if (Array.isArray(payload.choice) && payload.choice.length > 0) return true;
  if (typeof payload.choice === "string" && payload.choice.trim()) return true;
  // Notes-only is treated as a blank draft, not answered.
  return false;
}

export function isTestQuestion(question: Question): boolean {
  if (!question.active) return true;
  const hay = `${question.id} ${question.slug}`.toLowerCase();
  return /(^|[_-])test([_-]|$)/.test(hay) || hay.startsWith("q_test");
}

export function isProgressEligibleQuestion(question: Question): boolean {
  return question.active && !isTestQuestion(question);
}

function personState(answer: Answer | undefined): PersonAnswerState {
  if (!answer) return "unanswered";
  if (!hasAnswerContent(answer.payload)) return "draft";
  return "answered";
}

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function pickPrimary(flags: {
  coolingOff: boolean;
  reviewDue: boolean;
  answerChanged: boolean;
  undecided: boolean;
  sharedSaved: boolean;
  bothAnswered: boolean;
  samOnly: boolean;
  michelleOnly: boolean;
}): QuestionStatusKey {
  const present = new Set<QuestionStatusKey>();
  if (flags.coolingOff) present.add("cooling_off");
  if (flags.reviewDue) present.add("needs_review");
  if (flags.answerChanged) present.add("answer_changed");
  if (flags.undecided) present.add("undecided");
  if (flags.sharedSaved) present.add("shared_answer_saved");
  if (flags.bothAnswered) present.add("both_answered");
  if (flags.samOnly) present.add("sam_answered");
  if (flags.michelleOnly) present.add("michelle_answered");
  if (present.size === 0) present.add("unanswered");
  return PRIMARY_PRIORITY.find((key) => present.has(key)) ?? "unanswered";
}

function decisionLabel(status: string | null): string {
  if (!status) return "None";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function linkedDecision(store: AppStore, questionId: string): Decision | null {
  const decisions = store.decisions.filter((d) =>
    d.source_question_ids.includes(questionId),
  );
  if (!decisions.length) return null;
  return [...decisions].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];
}

export function getQuestionAnswerStatus(
  questionId: string,
  store: AppStore,
  now = new Date(),
): QuestionAnswerStatus {
  const samMember = store.members.find((m) => m.display_name === "Sam");
  const michelleMember = store.members.find((m) => m.display_name === "Michelle");
  const answers = store.answers.filter((a) => a.question_id === questionId);

  const samAnswer = answers.find(
    (a) => !a.is_shared && a.member_id === samMember?.id,
  );
  const michelleAnswer = answers.find(
    (a) => !a.is_shared && a.member_id === michelleMember?.id,
  );
  const sharedAnswer = answers.find((a) => a.is_shared);

  const sam = personState(samAnswer);
  const michelle = personState(michelleAnswer);
  const shared = personState(sharedAnswer);

  const coolingOff = store.cooling_off_items.some(
    (item) => item.active && item.question_id === questionId,
  );

  const reviewCandidates = [
    samAnswer?.review_date,
    michelleAnswer?.review_date,
    sharedAnswer?.review_date,
    ...store.reviews
      .filter(
        (r) =>
          !r.completed &&
          ((r.entity_type === "question" && r.entity_id === questionId) ||
            (r.entity_type === "answer" &&
              answers.some((a) => a.id === r.entity_id))),
      )
      .map((r) => r.review_date),
  ].filter(Boolean) as string[];

  const reviewDate =
    reviewCandidates.sort((a, b) => a.localeCompare(b))[0] ?? null;
  const reviewDue = Boolean(reviewDate && reviewDate <= todayKey(now));

  const decision = linkedDecision(store, questionId);
  const sharedDecisionStatus = decision?.status ?? sharedAnswer?.status ?? null;
  const undecided =
    sharedDecisionStatus === "undecided" ||
    sharedAnswer?.status === "undecided" ||
    samAnswer?.status === "undecided" ||
    michelleAnswer?.status === "undecided";

  let answerChanged = false;
  if (decision && answers.length) {
    const latestAnswerUpdate = answers
      .map((a) => a.updated_at)
      .sort((a, b) => b.localeCompare(a))[0];
    if (latestAnswerUpdate && latestAnswerUpdate > decision.updated_at) {
      answerChanged = true;
    }
  }

  const sharedSaved = shared === "answered";
  const bothAnswered = sam === "answered" && michelle === "answered";
  const samOnly = sam === "answered" && michelle !== "answered" && !sharedSaved;
  const michelleOnly =
    michelle === "answered" && sam !== "answered" && !sharedSaved;

  const primary = pickPrimary({
    coolingOff,
    reviewDue,
    answerChanged,
    undecided: undecided && !coolingOff,
    sharedSaved,
    bothAnswered,
    samOnly,
    michelleOnly,
  });

  const timestamps = answers.map((a) => a.updated_at);
  if (decision) timestamps.push(decision.updated_at);
  const lastUpdatedAt =
    timestamps.sort((a, b) => b.localeCompare(a))[0] ?? null;

  const confidence =
    sharedAnswer?.confidence ??
    samAnswer?.confidence ??
    michelleAnswer?.confidence ??
    null;

  const fullyAnswered =
    sharedSaved || bothAnswered;
  const partiallyAnswered =
    !fullyAnswered &&
    (sam === "answered" || michelle === "answered" || sharedSaved);

  const skipByDefault =
    fullyAnswered && !coolingOff && !reviewDue && !answerChanged && !undecided;

  return {
    questionId,
    primary,
    label: QUESTION_STATUS_LABELS[primary],
    sam,
    michelle,
    shared,
    sharedDecisionStatus,
    sharedDecisionLabel: decisionLabel(sharedDecisionStatus),
    lastUpdatedAt,
    confidence,
    reviewDate,
    reviewDue,
    coolingOff,
    answerChanged,
    undecided,
    fullyAnswered,
    partiallyAnswered,
    skipByDefault,
  };
}

export function buildQuestionStatusIndex(
  store: AppStore,
  now = new Date(),
): Map<string, QuestionAnswerStatus> {
  const index = new Map<string, QuestionAnswerStatus>();
  for (const question of store.questions) {
    index.set(question.id, getQuestionAnswerStatus(question.id, store, now));
  }
  return index;
}

export function personStateLabel(state: PersonAnswerState): string {
  if (state === "answered") return "Answered";
  if (state === "draft") return "Draft";
  return "Unanswered";
}

export function formatStatusTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type QuestionProgressSummary = {
  total: number;
  fullyAnswered: number;
  partiallyAnswered: number;
  unanswered: number;
  undecided: number;
  needsReview: number;
  coolingOff: number;
  both: number;
  sharedComplete: number;
};

export function summarizeQuestionProgress(
  store: AppStore,
  index?: Map<string, QuestionAnswerStatus>,
): QuestionProgressSummary {
  const statusIndex = index ?? buildQuestionStatusIndex(store);
  const eligible = store.questions.filter(isProgressEligibleQuestion);

  const summary: QuestionProgressSummary = {
    total: eligible.length,
    fullyAnswered: 0,
    partiallyAnswered: 0,
    unanswered: 0,
    undecided: 0,
    needsReview: 0,
    coolingOff: 0,
    both: 0,
    sharedComplete: 0,
  };

  for (const question of eligible) {
    const status = statusIndex.get(question.id);
    if (!status) continue;
    if (status.fullyAnswered) summary.fullyAnswered += 1;
    else if (status.partiallyAnswered) summary.partiallyAnswered += 1;
    else summary.unanswered += 1;
    if (status.undecided) summary.undecided += 1;
    if (status.reviewDue || status.primary === "needs_review") {
      summary.needsReview += 1;
    }
    if (status.coolingOff) summary.coolingOff += 1;
    if (status.sam === "answered" && status.michelle === "answered") {
      summary.both += 1;
    }
    if (status.shared === "answered") summary.sharedComplete += 1;
  }

  return summary;
}

export function matchesStatusFilter(
  status: QuestionAnswerStatus,
  filter: QuestionStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unanswered":
      return (
        !status.fullyAnswered &&
        !status.partiallyAnswered &&
        status.primary === "unanswered"
      );
    case "partial":
      return status.partiallyAnswered;
    case "both":
      return status.sam === "answered" && status.michelle === "answered";
    case "shared_complete":
      return status.shared === "answered";
    case "undecided":
      return status.undecided || status.primary === "undecided";
    case "needs_review":
      return status.reviewDue || status.primary === "needs_review";
    case "cooling_off":
      return status.coolingOff || status.primary === "cooling_off";
    default:
      return true;
  }
}

export function sortQuestionsByStatus(
  questions: Question[],
  index: Map<string, QuestionAnswerStatus>,
  sort: QuestionStatusSort,
): Question[] {
  const list = [...questions];
  const unansweredRank = (q: Question) => {
    const status = index.get(q.id);
    if (!status || status.primary === "unanswered") return 0;
    if (status.partiallyAnswered) return 1;
    return 2;
  };

  list.sort((a, b) => {
    if (sort === "unanswered_first") {
      return unansweredRank(a) - unansweredRank(b) || a.logical_order - b.logical_order;
    }
    if (sort === "updated") {
      const au = index.get(a.id)?.lastUpdatedAt ?? "";
      const bu = index.get(b.id)?.lastUpdatedAt ?? "";
      return bu.localeCompare(au) || a.logical_order - b.logical_order;
    }
    if (sort === "needs_review_first") {
      const ar = index.get(a.id)?.reviewDue || index.get(a.id)?.primary === "needs_review" ? 0 : 1;
      const br = index.get(b.id)?.reviewDue || index.get(b.id)?.primary === "needs_review" ? 0 : 1;
      return ar - br || a.logical_order - b.logical_order;
    }
    if (sort === "category") {
      const ac = a.categories[0] ?? "";
      const bc = b.categories[0] ?? "";
      return ac.localeCompare(bc) || a.logical_order - b.logical_order;
    }
    if (sort === "life_stage") {
      const as = a.life_stages[0] ?? "";
      const bs = b.life_stages[0] ?? "";
      return as.localeCompare(bs) || a.logical_order - b.logical_order;
    }
    return a.logical_order - b.logical_order;
  });
  return list;
}

export function filterCounts(
  questions: Question[],
  index: Map<string, QuestionAnswerStatus>,
): Record<QuestionStatusFilter, number> {
  const counts: Record<QuestionStatusFilter, number> = {
    all: questions.length,
    unanswered: 0,
    partial: 0,
    both: 0,
    shared_complete: 0,
    undecided: 0,
    needs_review: 0,
    cooling_off: 0,
  };
  for (const question of questions) {
    const status = index.get(question.id);
    if (!status) continue;
    (Object.keys(counts) as QuestionStatusFilter[]).forEach((key) => {
      if (key === "all") return;
      if (matchesStatusFilter(status, key)) counts[key] += 1;
    });
  }
  return counts;
}
