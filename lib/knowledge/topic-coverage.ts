/**
 * Topic coverage + “what should we discuss next” ranking.
 */
import type { AppStore, Question } from "@/lib/types/models";
import {
  PRINCIPLE_TOPICS,
  getProposedPrinciple,
  questionMatchesTopic,
  type PrincipleTopicDef,
} from "@/lib/knowledge/proposed-principles";
import { questionIdsRelated } from "@/lib/conversations/deep-link";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
} from "@/lib/services/question-status";
import { getEssentialsEnrichmentForQuestionId } from "@/lib/essentials/screen-context";
import { getActiveQuickPrompts } from "@/lib/conversations/quick-prompts";
import { BABYMOON_INLINE_PROMPTS } from "@/lib/conversations/babymoon-set";

export type TopicCoverage = {
  topicSlug: string;
  title: string;
  shortLabel: string;
  importantTotal: number;
  importantAnswered: number;
  unresolvedDisagreements: number;
  principleConfidencePercent: number | null;
  highImpactRemaining: number;
  principleStatus:
    | "none"
    | "proposed"
    | "ready"
    | "accepted"
    | "deferred"
    | "rejected";
  principleHref: string | null;
};

export type NextQuestionRecommendation = {
  questionId: string;
  slug: string;
  text: string;
  score: number;
  reasons: string[];
  topicSlug: string | null;
  estimatedMinutes: number | null;
};

function isImportant(q: Question): boolean {
  return (
    q.priority === "essential_before_birth" ||
    q.priority === "high" ||
    Boolean(q.babymoon_priority) ||
    Boolean(q.required_before_birth)
  );
}

function feedbackStatus(store: AppStore, topicSlug: string) {
  return store.principle_proposal_feedback?.find((f) => f.topic_slug === topicSlug)
    ?.status;
}

function answersForQuestion(store: AppStore, questionId: string) {
  return store.answers.filter(
    (a) =>
      a.question_id === questionId ||
      questionIdsRelated(a.question_id, questionId),
  );
}

function hasDisagreement(
  store: AppStore,
  questionId: string,
): boolean {
  const sam = store.members.find((m) => m.display_name === "Sam");
  const michelle = store.members.find((m) => m.display_name === "Michelle");
  const answers = answersForQuestion(store, questionId);
  const shared = answers.find((a) => a.is_shared);
  if (shared) return false;
  const samA = answers.find((a) => a.member_id === sam?.id);
  const michelleA = answers.find((a) => a.member_id === michelle?.id);
  if (!samA || !michelleA) return false;
  const a =
    samA.payload.text ||
    (Array.isArray(samA.payload.choice)
      ? samA.payload.choice.join("|")
      : samA.payload.choice) ||
    samA.payload.quick ||
    "";
  const b =
    michelleA.payload.text ||
    (Array.isArray(michelleA.payload.choice)
      ? michelleA.payload.choice.join("|")
      : michelleA.payload.choice) ||
    michelleA.payload.quick ||
    "";
  return Boolean(a && b && String(a).toLowerCase() !== String(b).toLowerCase());
}

export function buildTopicCoverage(store: AppStore): TopicCoverage[] {
  const statusIndex = buildQuestionStatusIndex(store);
  const rows: TopicCoverage[] = [];

  for (const topic of PRINCIPLE_TOPICS) {
    const matched = store.questions.filter((q) => questionMatchesTopic(q, topic));
    if (!matched.length) continue;
    const important = matched.filter(isImportant);
    const pool = important.length ? important : matched;
    let answered = 0;
    let disagreements = 0;
    let highImpactRemaining = 0;

    for (const q of pool) {
      const status = statusIndex.get(q.id) ?? getQuestionAnswerStatus(q.id, store);
      const done = status.fullyAnswered || status.skipByDefault;
      if (done) answered += 1;
      else if (isImportant(q)) highImpactRemaining += 1;
      if (hasDisagreement(store, q.id)) disagreements += 1;
    }

    const fb = feedbackStatus(store, topic.slug);
    const proposal = getProposedPrinciple(store, topic.slug);
    let principleStatus: TopicCoverage["principleStatus"] = "none";
    if (fb === "accepted") principleStatus = "accepted";
    else if (fb === "rejected") principleStatus = "rejected";
    else if (fb === "deferred") principleStatus = "deferred";
    else if (proposal?.readyToDraft) principleStatus = "ready";
    else if (proposal) principleStatus = "proposed";

    rows.push({
      topicSlug: topic.slug,
      title: topic.title,
      shortLabel: topic.shortLabel ?? topic.title,
      importantTotal: pool.length,
      importantAnswered: answered,
      unresolvedDisagreements: disagreements,
      principleConfidencePercent: proposal?.confidencePercent ?? null,
      highImpactRemaining,
      principleStatus,
      principleHref:
        principleStatus === "ready" || principleStatus === "proposed"
          ? `/decisions#principle-${topic.slug}`
          : principleStatus === "accepted"
            ? `/decisions`
            : null,
    });
  }

  return rows.sort(
    (a, b) =>
      b.highImpactRemaining - a.highImpactRemaining ||
      (a.principleConfidencePercent ?? 0) - (b.principleConfidencePercent ?? 0),
  );
}

function conversationFollowUpFrequency(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of [...getActiveQuickPrompts(), ...BABYMOON_INLINE_PROMPTS]) {
    const id = p.follow_up_open_question_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function topicForQuestion(
  q: Question,
): PrincipleTopicDef | null {
  return PRINCIPLE_TOPICS.find((t) => questionMatchesTopic(q, t)) ?? null;
}

/**
 * Rank the most valuable unanswered questions right now.
 */
export function recommendNextQuestions(
  store: AppStore,
  limit = 5,
): NextQuestionRecommendation[] {
  const statusIndex = buildQuestionStatusIndex(store);
  const freq = conversationFollowUpFrequency();
  const coverage = buildTopicCoverage(store);
  const weakTopics = new Set(
    coverage
      .filter(
        (c) =>
          c.highImpactRemaining > 0 &&
          (c.principleConfidencePercent == null ||
            c.principleConfidencePercent < 70) &&
          c.principleStatus !== "accepted" &&
          c.principleStatus !== "rejected",
      )
      .map((c) => c.topicSlug),
  );

  const scored: NextQuestionRecommendation[] = [];

  for (const q of store.questions) {
    const status = statusIndex.get(q.id) ?? getQuestionAnswerStatus(q.id, store);
    if (status.fullyAnswered || status.skipByDefault) continue;

    const reasons: string[] = [];
    let score = 0;
    const topic = topicForQuestion(q);
    const enrichment = getEssentialsEnrichmentForQuestionId(q.id)?.enrichment;

    if (q.priority === "essential_before_birth" || q.required_before_birth) {
      score += 40;
      reasons.push("Essential before birth");
    } else if (q.priority === "high") {
      score += 28;
      reasons.push("High importance");
    } else if (q.priority === "medium") {
      score += 12;
    }

    if (q.babymoon_priority) {
      score += 18;
      reasons.push("Babymoon priority");
    }

    if (enrichment) {
      score += enrichment.importance * 4;
      score += enrichment.relevance_now * 3;
      if (enrichment.importance >= 4) reasons.push("High-impact Essentials topic");
      if (enrichment.depends_on?.length) {
        score += 6;
        reasons.push("Builds on earlier Essentials decisions");
      }
    }

    const freqHit = [...freq.entries()].find(
      ([id]) => id === q.id || questionIdsRelated(id, q.id),
    );
    if (freqHit) {
      score += 10 + freqHit[1] * 4;
      reasons.push("Often linked from Conversations");
    }

    if (topic && weakTopics.has(topic.slug)) {
      score += 22;
      reasons.push(`Fills a gap in ${topic.shortLabel ?? topic.title}`);
      const cov = coverage.find((c) => c.topicSlug === topic.slug);
      if (cov && cov.principleConfidencePercent != null && cov.principleConfidencePercent < 60) {
        score += 8;
        reasons.push("Would raise principle confidence");
      }
    }

    if (status.partiallyAnswered) {
      score += 10;
      reasons.push("Already partially answered — finish it");
    }

    if (status.undecided || status.reviewDue || status.primary === "needs_review") {
      score += 12;
      reasons.push("Needs review or decision");
    }

    if (!reasons.length) continue;

    scored.push({
      questionId: q.id,
      slug: q.slug,
      text: q.short_title || q.text,
      score,
      reasons: reasons.slice(0, 3),
      topicSlug: topic?.slug ?? null,
      estimatedMinutes:
        enrichment?.estimated_minutes ?? q.estimated_minutes ?? null,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
