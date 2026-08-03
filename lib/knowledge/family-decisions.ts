/**
 * Family knowledge layer — Phase 1.
 * Decisions are the hub. Other systems stay intact; this layer connects them.
 * Do not surface "knowledge graph" language in the UI.
 */

import type {
  Answer,
  AppStore,
  ChecklistTask,
  Decision,
  KnowledgeItem,
  Question,
} from "@/lib/types/models";
import type {
  ConfidenceLevel,
  DecisionStatus,
} from "@/lib/constants/enums";
import { hasAnswerContent } from "@/lib/services/question-status";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import {
  sessionPrimaryHref,
} from "@/lib/services/conversation-review";
import { STATUS_LABELS } from "@/lib/constants/enums";

function isQaRecord(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

export type KnowledgeEdgeType =
  | "question_to_decision"
  | "conversation_to_decision"
  | "book_to_decision"
  | "research_to_decision"
  | "checklist_to_decision"
  | "provider_to_decision"
  | "timeline_to_decision"
  | "decision_to_decision";

export type KnowledgeEdge = {
  id: string;
  type: KnowledgeEdgeType;
  fromId: string;
  toId: string;
  weight: number;
  label?: string;
};

export type DecisionHealthGrade = "excellent" | "good" | "needs_attention";

export type DecisionHealth = {
  discussionComplete: boolean;
  sharedAnswer: boolean;
  evidenceReviewed: boolean;
  booksLinked: boolean;
  providerReviewed: boolean;
  checklistComplete: boolean;
  noConflicts: boolean;
  recentlyReviewed: boolean;
  highConfidence: boolean;
  score: number;
  grade: DecisionHealthGrade;
  insights: string[];
};

export type LinkedConversationRef = {
  id: string;
  title: string;
  href: string;
  status: string;
  completedAt: string | null;
};

export type LinkedQuestionRef = {
  id: string;
  slug: string;
  title: string;
  href: string;
};

export type LinkedTaskRef = {
  id: string;
  title: string;
  href: string;
  completed: boolean;
};

export type LinkedKnowledgeRef = {
  id: string;
  title: string;
  href: string;
  itemType: string;
};

export type FamilyDecisionNode = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  currentPosition: string;
  status: DecisionStatus;
  statusLabel: string;
  confidence: ConfidenceLevel;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  lifeStages: string[];
  categories: string[];
  importance: number;
  decisionType: string;
  source: "persisted" | "synthesized";
  persistedDecisionId: string | null;
  linkedQuestionIds: string[];
  linkedConversationIds: string[];
  linkedBookIds: string[];
  linkedResearchIds: string[];
  linkedTaskIds: string[];
  linkedProviderNotes: string[];
  relatedDecisionIds: string[];
  questions: LinkedQuestionRef[];
  conversations: LinkedConversationRef[];
  tasks: LinkedTaskRef[];
  books: LinkedKnowledgeRef[];
  research: LinkedKnowledgeRef[];
  health: DecisionHealth;
};

export type DecisionTopicSeed = {
  slug: string;
  title: string;
  keywords: string[];
  categories: string[];
};

/** Curated topic seeds used to synthesize Decision hubs from existing data. */
export const DECISION_TOPIC_SEEDS: DecisionTopicSeed[] = [
  {
    slug: "visitors-after-birth",
    title: "Visitors after birth",
    keywords: ["visitor", "visit", "guest", "grandparent", "overnight", "company"],
    categories: ["birth", "family", "visitors"],
  },
  {
    slug: "sleep",
    title: "Sleep",
    keywords: ["sleep", "night", "bedtime", "nap", "room sharing", "bassinet"],
    categories: ["sleep"],
  },
  {
    slug: "feeding",
    title: "Feeding",
    keywords: ["feed", "breast", "bottle", "formula", "nursing", "pump"],
    categories: ["feeding"],
  },
  {
    slug: "screens",
    title: "Screens",
    keywords: ["screen", "tv", "phone", "tablet", "media"],
    categories: ["screens", "media"],
  },
  {
    slug: "discipline",
    title: "Discipline",
    keywords: ["discipline", "consequence", "timeout", "behavior"],
    categories: ["discipline"],
  },
  {
    slug: "childcare",
    title: "Childcare",
    keywords: ["daycare", "childcare", "nanny", "caregiver"],
    categories: ["childcare"],
  },
  {
    slug: "birth-plan",
    title: "Birth plan",
    keywords: ["birth", "labor", "delivery", "induction", "hospital"],
    categories: ["birth"],
  },
  {
    slug: "vaccinations",
    title: "Vaccinations",
    keywords: ["vaccin", "immuniz", "shot"],
    categories: ["health"],
  },
  {
    slug: "money",
    title: "Money and budgeting",
    keywords: ["money", "budget", "allowance", "cost", "finance"],
    categories: ["money"],
  },
  {
    slug: "religion-values",
    title: "Religion and values",
    keywords: ["faith", "religion", "spiritual", "values", "church"],
    categories: ["values", "faith"],
  },
  {
    slug: "emergency-guardians",
    title: "Emergency guardians",
    keywords: ["guardian", "emergency", "will", "custody"],
    categories: ["legal", "planning"],
  },
  {
    slug: "school-choice",
    title: "School choice",
    keywords: ["school", "preschool", "education"],
    categories: ["education"],
  },
];

export function slugifyDecisionTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function textMatchesKeywords(text: string, keywords: string[]): boolean {
  const hay = text.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function questionMatchesTopic(q: Question, topic: DecisionTopicSeed): boolean {
  const blob = [
    q.short_title,
    q.text,
    q.why_it_matters,
    ...q.categories,
    ...q.subcategories,
  ]
    .join(" ")
    .toLowerCase();
  if (topic.categories.some((c) => q.categories.map((x) => x.toLowerCase()).includes(c))) {
    return true;
  }
  return textMatchesKeywords(blob, topic.keywords);
}

function buildCurrentPosition(input: {
  decision?: Decision | null;
  sharedAnswers: Answer[];
  title: string;
}): string {
  if (input.decision?.shared_conclusion?.trim()) {
    return input.decision.shared_conclusion.trim();
  }
  if (input.decision?.statement?.trim()) {
    return input.decision.statement.trim();
  }
  const withContent = input.sharedAnswers.find((a) => hasAnswerContent(a.payload));
  if (withContent) {
    const p = withContent.payload;
    if (p.text?.trim()) return p.text.trim();
    if (typeof p.choice === "string") return p.choice;
    if (Array.isArray(p.choice)) return p.choice.join(", ");
    if (p.notes?.trim()) return p.notes.trim();
  }
  return `No shared family position recorded yet for ${input.title}.`;
}

export function scoreDecisionHealth(input: {
  status: DecisionStatus;
  confidence: ConfidenceLevel;
  hasDisagreement: boolean;
  sharedAnswer: boolean;
  questionCount: number;
  answeredQuestionCount: number;
  bookCount: number;
  researchCount: number;
  providerCount: number;
  taskCount: number;
  completedTaskCount: number;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
}): DecisionHealth {
  const discussionComplete =
    input.answeredQuestionCount > 0 &&
    input.answeredQuestionCount >= Math.max(1, Math.ceil(input.questionCount * 0.6));
  const sharedAnswer = input.sharedAnswer;
  const evidenceReviewed = input.researchCount > 0 || input.bookCount > 0;
  const booksLinked = input.bookCount > 0;
  const providerReviewed = input.providerCount > 0;
  const checklistComplete =
    input.taskCount === 0 || input.completedTaskCount === input.taskCount;
  const noConflicts = !input.hasDisagreement;
  const recentlyReviewed = Boolean(
    input.lastReviewedAt &&
      Date.now() - Date.parse(input.lastReviewedAt) < 1000 * 60 * 60 * 24 * 90,
  );
  const highConfidence = (input.confidence ?? 0) >= 4;

  const checks = [
    discussionComplete,
    sharedAnswer,
    evidenceReviewed,
    booksLinked,
    providerReviewed,
    checklistComplete,
    noConflicts,
    recentlyReviewed,
    highConfidence,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  let grade: DecisionHealthGrade = "needs_attention";
  if (score >= 80) grade = "excellent";
  else if (score >= 55) grade = "good";

  const insights: string[] = [];
  if (!discussionComplete) insights.push("Missing discussion");
  if (input.hasDisagreement) insights.push("Conflicting answers");
  if (!sharedAnswer) insights.push("No shared position yet");
  if (!evidenceReviewed) insights.push("Evidence not reviewed");
  if (input.researchCount > 0 && input.bookCount === 0) {
    insights.push("Research linked without books");
  }
  if (!highConfidence && sharedAnswer) insights.push("Low confidence");
  if (
    input.nextReviewDate &&
    Date.parse(input.nextReviewDate) < Date.now()
  ) {
    insights.push("Needs review");
  }
  if (
    input.status === "needs_research" ||
    insights.includes("Evidence not reviewed")
  ) {
    insights.push("Provider guidance recommended");
  }
  if (grade === "excellent") insights.push("High confidence");

  return {
    discussionComplete,
    sharedAnswer,
    evidenceReviewed,
    booksLinked,
    providerReviewed,
    checklistComplete,
    noConflicts,
    recentlyReviewed,
    highConfidence,
    score,
    grade,
    insights: [...new Set(insights)],
  };
}

type GraphCache = {
  key: string;
  nodes: FamilyDecisionNode[];
  edges: KnowledgeEdge[];
  bySlug: Map<string, FamilyDecisionNode>;
  byId: Map<string, FamilyDecisionNode>;
  byQuestionId: Map<string, FamilyDecisionNode[]>;
  byConversationId: Map<string, FamilyDecisionNode[]>;
};

let graphCache: GraphCache | null = null;

function storeFingerprint(store: AppStore): string {
  return [
    store.decisions.length,
    store.answers.length,
    store.questions.length,
    store.knowledge_items.length,
    store.checklist_tasks.length,
    store.conversation_sessions?.length ?? 0,
    store.conversation_session_items?.length ?? 0,
    store.decisions.map((d) => d.updated_at).join("|"),
    store.answers.map((a) => a.updated_at).slice(-20).join("|"),
  ].join(":");
}

function knowledgeHref(item: KnowledgeItem): string {
  return `/knowledge/${item.id}`;
}

function deriveStatusFromEvidence(input: {
  decision?: Decision | null;
  hasShared: boolean;
  hasPartial: boolean;
  hasDisagreement: boolean;
  needsResearch: boolean;
}): DecisionStatus {
  if (input.decision) return input.decision.status;
  if (input.needsResearch) return "needs_research";
  if (input.hasDisagreement) return "undecided";
  if (input.hasShared) return "decided";
  if (input.hasPartial) return "in_discussion";
  return "not_started";
}

/**
 * Build the decision hub index from existing store data.
 * Pure / idempotent — does not mutate the store.
 */
export function buildFamilyDecisionGraph(store: AppStore): GraphCache {
  const key = storeFingerprint(store);
  if (graphCache && graphCache.key === key) return graphCache;

  const edges: KnowledgeEdge[] = [];
  const nodes: FamilyDecisionNode[] = [];

  const answersByQuestion = new Map<string, Answer[]>();
  for (const a of store.answers ?? []) {
    if (isQaRecord(a)) continue;
    const list = answersByQuestion.get(a.question_id) ?? [];
    list.push(a);
    answersByQuestion.set(a.question_id, list);
  }

  const conversationByQuestion = new Map<string, Set<string>>();
  for (const item of store.conversation_session_items ?? []) {
    const session = (store.conversation_sessions ?? []).find(
      (s) => s.id === item.session_id && !isQaRecord(s),
    );
    if (!session || isQaRecord(item)) continue;
    const prompt = resolveConversationPrompt(item.prompt_id);
    const qids = [
      item.source_question_id,
      prompt?.follow_up_open_question_id,
    ].filter(Boolean) as string[];
    for (const qid of qids) {
      const set = conversationByQuestion.get(qid) ?? new Set();
      set.add(session.id);
      conversationByQuestion.set(qid, set);
    }
  }

  function buildNode(input: {
    id: string;
    slug: string;
    title: string;
    decision?: Decision | null;
    questionIds: string[];
    source: "persisted" | "synthesized";
  }): FamilyDecisionNode {
    const questions = store.questions.filter((q) =>
      input.questionIds.includes(q.id),
    );
    const sharedAnswers = input.questionIds.flatMap((qid) =>
      (answersByQuestion.get(qid) ?? []).filter(
        (a) => a.is_shared && hasAnswerContent(a.payload),
      ),
    );
    const allAnswers = input.questionIds.flatMap(
      (qid) => answersByQuestion.get(qid) ?? [],
    );
    const hasDisagreement =
      input.decision?.has_disagreement ||
      allAnswers.some((a) => a.status === "undecided") ||
      false;
    const answeredQuestionCount = input.questionIds.filter((qid) => {
      const ans = answersByQuestion.get(qid) ?? [];
      return ans.some((a) => hasAnswerContent(a.payload));
    }).length;
    const needsResearch = allAnswers.some((a) => a.needs_research);

    const conversationIds = [
      ...new Set(
        input.questionIds.flatMap((qid) => [
          ...(conversationByQuestion.get(qid) ?? []),
        ]),
      ),
    ];
    if (input.decision?.linked_conversation_ids?.length) {
      for (const id of input.decision.linked_conversation_ids) {
        if (!conversationIds.includes(id)) conversationIds.push(id);
      }
    }

    const tasks = store.checklist_tasks.filter((t) => {
      if (t.archived) return false;
      if (input.decision?.linked_task_ids?.includes(t.id)) return true;
      return (t.linked_question_ids ?? []).some((qid) =>
        input.questionIds.includes(qid),
      );
    });

    const books = store.knowledge_items.filter((k) => {
      if (input.decision?.linked_book_ids?.includes(k.id)) return true;
      const isBookish =
        k.item_type === "book_note" || k.source_type === "book";
      if (!isBookish) return false;
      return (
        k.related_decision_ids?.includes(input.decision?.id ?? "") ||
        k.related_question_ids?.some((qid) => input.questionIds.includes(qid))
      );
    });

    const research = store.knowledge_items.filter((k) => {
      if (input.decision?.linked_research_ids?.includes(k.id)) return true;
      if (k.item_type === "book_note") return false;
      return (
        k.related_decision_ids?.includes(input.decision?.id ?? "") ||
        k.related_question_ids?.some((qid) => input.questionIds.includes(qid))
      );
    });

    const providerNotes: string[] = [];
    for (const cid of conversationIds) {
      const sess = store.conversation_sessions?.find((s) => s.id === cid);
      if (sess?.summary?.provider_questions?.length) {
        providerNotes.push(...sess.summary.provider_questions);
      }
      if (sess?.summary?.waiting_provider?.length) {
        providerNotes.push(...sess.summary.waiting_provider);
      }
    }
    for (const t of tasks) {
      if (t.provider_confirmation_needed || t.task_tags?.includes("confirm_with_provider")) {
        providerNotes.push(t.title);
      }
    }

    const status = deriveStatusFromEvidence({
      decision: input.decision,
      hasShared: sharedAnswers.length > 0,
      hasPartial: answeredQuestionCount > 0 && sharedAnswers.length === 0,
      hasDisagreement,
      needsResearch,
    });

    const currentPosition = buildCurrentPosition({
      decision: input.decision,
      sharedAnswers,
      title: input.title,
    });

    const lastReviewedAt =
      input.decision?.last_reviewed_at ??
      input.decision?.updated_at ??
      sharedAnswers.map((a) => a.updated_at).sort().at(-1) ??
      null;

    const health = scoreDecisionHealth({
      status,
      confidence: input.decision?.confidence ?? null,
      hasDisagreement,
      sharedAnswer: sharedAnswers.length > 0,
      questionCount: questions.length,
      answeredQuestionCount,
      bookCount: books.length,
      researchCount: research.length,
      providerCount: providerNotes.length,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.completed).length,
      lastReviewedAt,
      nextReviewDate: input.decision?.review_date ?? null,
    });

    for (const q of questions) {
      edges.push({
        id: `e_q_${q.id}_${input.id}`,
        type: "question_to_decision",
        fromId: q.id,
        toId: input.id,
        weight: 1,
      });
    }
    for (const cid of conversationIds) {
      edges.push({
        id: `e_c_${cid}_${input.id}`,
        type: "conversation_to_decision",
        fromId: cid,
        toId: input.id,
        weight: 1,
      });
    }
    for (const t of tasks) {
      edges.push({
        id: `e_t_${t.id}_${input.id}`,
        type: "checklist_to_decision",
        fromId: t.id,
        toId: input.id,
        weight: 1,
      });
    }
    for (const b of books) {
      edges.push({
        id: `e_b_${b.id}_${input.id}`,
        type: "book_to_decision",
        fromId: b.id,
        toId: input.id,
        weight: 1,
      });
    }
    for (const r of research) {
      edges.push({
        id: `e_r_${r.id}_${input.id}`,
        type: "research_to_decision",
        fromId: r.id,
        toId: input.id,
        weight: 1,
      });
    }
    for (const note of providerNotes) {
      edges.push({
        id: `e_p_${input.id}_${slugifyDecisionTitle(note)}`,
        type: "provider_to_decision",
        fromId: `provider:${slugifyDecisionTitle(note)}`,
        toId: input.id,
        weight: 1,
        label: note,
      });
    }

    return {
      id: input.id,
      slug: input.slug,
      title: input.title,
      summary: input.decision?.statement ?? currentPosition,
      currentPosition,
      status,
      statusLabel: STATUS_LABELS[status] ?? status,
      confidence: input.decision?.confidence ?? null,
      createdAt: input.decision?.created_at ?? questions[0]?.created_at ?? "1970-01-01T00:00:00.000Z",
      updatedAt:
        input.decision?.updated_at ??
        sharedAnswers.map((a) => a.updated_at).sort().at(-1) ??
        questions[0]?.updated_at ??
        "1970-01-01T00:00:00.000Z",
      lastReviewedAt,
      nextReviewDate: input.decision?.review_date ?? null,
      lifeStages: input.decision?.life_stages ?? questions.flatMap((q) => q.life_stages),
      categories:
        input.decision?.categories ??
        [...new Set(questions.flatMap((q) => q.categories))],
      importance: input.decision?.emotional_weight ?? 3,
      decisionType: input.decision?.decision_type ?? "parenting_philosophy",
      source: input.source,
      persistedDecisionId: input.decision?.id ?? null,
      linkedQuestionIds: input.questionIds,
      linkedConversationIds: conversationIds,
      linkedBookIds: books.map((b) => b.id),
      linkedResearchIds: research.map((r) => r.id),
      linkedTaskIds: tasks.map((t) => t.id),
      linkedProviderNotes: [...new Set(providerNotes)],
      relatedDecisionIds: input.decision?.related_decision_ids ?? [],
      questions: questions.map((q) => ({
        id: q.id,
        slug: q.slug,
        title: q.short_title,
        href: `/questions/${q.slug}`,
      })),
      conversations: conversationIds
        .map((cid) => {
          const s = store.conversation_sessions?.find((x) => x.id === cid);
          if (!s) return null;
          return {
            id: s.id,
            title: s.title,
            href: sessionPrimaryHref(s),
            status: s.status,
            completedAt: s.completed_at,
          };
        })
        .filter(Boolean) as LinkedConversationRef[],
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        href: `/before-baby?task=${t.id}`,
        completed: t.completed,
      })),
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        href: knowledgeHref(b),
        itemType: b.item_type,
      })),
      research: research.map((r) => ({
        id: r.id,
        title: r.title,
        href: knowledgeHref(r),
        itemType: r.item_type,
      })),
      health,
    };
  }

  // 1) Persisted decisions become hubs.
  for (const decision of store.decisions) {
    const slug =
      decision.slug?.trim() || slugifyDecisionTitle(decision.title);
    const questionIds = [
      ...new Set([
        ...decision.source_question_ids,
        ...(decision.linked_question_ids ?? []),
      ]),
    ];
    const node = buildNode({
      id: decision.id,
      slug,
      title: decision.title,
      decision,
      questionIds,
      source: "persisted",
    });
    nodes.push(node);
  }

  // 2) Synthesize topic hubs for unmatched evidence (no duplicate titles/slugs).
  const existingSlugs = new Set(nodes.map((n) => n.slug));
  const existingTitles = new Set(nodes.map((n) => n.title.toLowerCase()));

  for (const topic of DECISION_TOPIC_SEEDS) {
    if (existingSlugs.has(topic.slug)) continue;
    if (existingTitles.has(topic.title.toLowerCase())) continue;

    const matchedQuestions = store.questions.filter(
      (q) => q.active && questionMatchesTopic(q, topic),
    );
    if (!matchedQuestions.length) continue;

    const hasEvidence = matchedQuestions.some((q) => {
      const ans = answersByQuestion.get(q.id) ?? [];
      const conv = conversationByQuestion.get(q.id);
      return ans.length > 0 || (conv && conv.size > 0);
    });
    // Create hubs when there is evidence, or enough topical questions to browse.
    if (!hasEvidence && matchedQuestions.length < 2) continue;

    const node = buildNode({
      id: `synth_${topic.slug}`,
      slug: topic.slug,
      title: topic.title,
      decision: null,
      questionIds: matchedQuestions.map((q) => q.id),
      source: "synthesized",
    });
    nodes.push(node);
    existingSlugs.add(topic.slug);
  }

  // Related decisions by shared categories / overlapping questions.
  for (const node of nodes) {
    const related = nodes
      .filter((other) => other.id !== node.id)
      .map((other) => {
        const sharedCats = node.categories.filter((c) =>
          other.categories.includes(c),
        ).length;
        const sharedQs = node.linkedQuestionIds.filter((qid) =>
          other.linkedQuestionIds.includes(qid),
        ).length;
        return { other, score: sharedCats * 2 + sharedQs * 5 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    node.relatedDecisionIds = [
      ...new Set([
        ...node.relatedDecisionIds,
        ...related.map((r) => r.other.id),
      ]),
    ];
    for (const r of related) {
      edges.push({
        id: `e_d_${node.id}_${r.other.id}`,
        type: "decision_to_decision",
        fromId: node.id,
        toId: r.other.id,
        weight: r.score,
      });
    }
  }

  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byQuestionId = new Map<string, FamilyDecisionNode[]>();
  const byConversationId = new Map<string, FamilyDecisionNode[]>();
  for (const node of nodes) {
    for (const qid of node.linkedQuestionIds) {
      const list = byQuestionId.get(qid) ?? [];
      list.push(node);
      byQuestionId.set(qid, list);
    }
    for (const cid of node.linkedConversationIds) {
      const list = byConversationId.get(cid) ?? [];
      list.push(node);
      byConversationId.set(cid, list);
    }
  }

  graphCache = { key, nodes, edges, bySlug, byId, byQuestionId, byConversationId };
  return graphCache;
}

/** Clear memoized graph (tests). */
export function clearFamilyDecisionGraphCache() {
  graphCache = null;
}

export function listFamilyDecisions(store: AppStore): FamilyDecisionNode[] {
  return buildFamilyDecisionGraph(store).nodes.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getFamilyDecisionBySlugOrId(
  store: AppStore,
  slugOrId: string,
): FamilyDecisionNode | null {
  const graph = buildFamilyDecisionGraph(store);
  return graph.bySlug.get(slugOrId) ?? graph.byId.get(slugOrId) ?? null;
}

export function getDecisionsForQuestion(
  store: AppStore,
  questionId: string,
): FamilyDecisionNode[] {
  return buildFamilyDecisionGraph(store).byQuestionId.get(questionId) ?? [];
}

export function getDecisionsForConversation(
  store: AppStore,
  conversationId: string,
): FamilyDecisionNode[] {
  return (
    buildFamilyDecisionGraph(store).byConversationId.get(conversationId) ?? []
  );
}

export function getRelatedDecisions(
  store: AppStore,
  slugOrId: string,
): FamilyDecisionNode[] {
  const node = getFamilyDecisionBySlugOrId(store, slugOrId);
  if (!node) return [];
  const graph = buildFamilyDecisionGraph(store);
  return node.relatedDecisionIds
    .map((id) => graph.byId.get(id))
    .filter(Boolean) as FamilyDecisionNode[];
}

export function decisionsNeedingAttention(
  store: AppStore,
): FamilyDecisionNode[] {
  return listFamilyDecisions(store).filter(
    (d) =>
      d.health.grade === "needs_attention" ||
      d.status === "needs_research" ||
      d.status === "in_discussion" ||
      d.status === "undecided" ||
      d.status === "review_scheduled",
  );
}

export function searchFamilyDecisions(
  store: AppStore,
  query: string,
): FamilyDecisionNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listFamilyDecisions(store)
    .filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.currentPosition.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.categories.some((c) => c.toLowerCase().includes(q)) ||
        d.questions.some((x) => x.title.toLowerCase().includes(q)),
    )
    .slice(0, 20);
}

export function traverseDecisionEdges(
  store: AppStore,
  decisionId: string,
  edgeType?: KnowledgeEdgeType,
): KnowledgeEdge[] {
  const graph = buildFamilyDecisionGraph(store);
  return graph.edges.filter(
    (e) =>
      (e.fromId === decisionId || e.toId === decisionId) &&
      (!edgeType || e.type === edgeType),
  );
}

export function decisionHref(node: Pick<FamilyDecisionNode, "slug" | "id">) {
  return `/decisions/${node.slug || node.id}`;
}

/** Ensure optional Phase-1 fields exist when reading legacy decisions. */
export function normalizeDecision(decision: Decision): Decision {
  return {
    ...decision,
    slug: decision.slug ?? slugifyDecisionTitle(decision.title),
    current_position:
      decision.current_position ??
      decision.shared_conclusion ??
      decision.statement,
    linked_question_ids:
      decision.linked_question_ids ?? decision.source_question_ids ?? [],
    linked_conversation_ids: decision.linked_conversation_ids ?? [],
    linked_book_ids: decision.linked_book_ids ?? [],
    linked_research_ids: decision.linked_research_ids ?? [],
    linked_task_ids: decision.linked_task_ids ?? [],
    linked_provider_ids: decision.linked_provider_ids ?? [],
    related_decision_ids: decision.related_decision_ids ?? [],
    last_reviewed_at: decision.last_reviewed_at ?? decision.updated_at,
  };
}

// Re-export for tasks typing in tests
export type { ChecklistTask };
