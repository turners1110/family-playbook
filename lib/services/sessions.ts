import { readStore, updateStore, nowIso, id } from "@/lib/db/local-store";
import type { Question, Session, SessionFilters, SessionQuestion } from "@/lib/types/models";
import {
  createSessionSchema,
  sessionQuestionCount,
  type CreateSessionInput,
} from "@/lib/validation/schemas";
import { BABYMOON_WEIGHT_CATEGORIES } from "@/lib/constants/enums";

const PRACTICAL_TYPES = new Set([
  "practical_planning",
  "yes_or_no",
  "single_choice",
  "multiple_choice",
  "policy_decision",
]);

const PHILOSOPHICAL_TYPES = new Set([
  "values_clarification",
  "reflection",
  "tradeoff",
  "joint_discussion",
  "open_response",
]);

export function filterQuestions(
  questions: Question[],
  answeredIds: Set<string>,
  unresolvedIds: Set<string>,
  filters: SessionFilters,
  recentCategoryCounts: Map<string, number> = new Map(),
): Question[] {
  let list = questions.filter((q) => q.active);

  if (filters.life_stage) {
    list = list.filter(
      (q) =>
        q.life_stages.includes(filters.life_stage!) ||
        q.life_stages.includes("all_stages"),
    );
  }
  if (filters.category) {
    list = list.filter((q) => q.categories.includes(filters.category!));
  }
  if (filters.outcome) {
    list = list.filter((q) => q.outcomes.includes(filters.outcome!));
  }
  if (filters.only_unanswered) {
    list = list.filter((q) => !answeredIds.has(q.id));
  }
  if (filters.include_unresolved) {
    list = list.filter((q) => unresolvedIds.has(q.id) || !answeredIds.has(q.id));
  }
  if (filters.include_research) {
    list = list.filter(
      (q) =>
        q.research_mode === "helpful_before_decision" ||
        q.research_mode === "strongly_recommended" ||
        q.evidence_needed,
    );
  }
  if (filters.include_separate) {
    list = list.filter((q) => q.separate_answers_recommended);
  }
  if (filters.include_high_priority) {
    list = list.filter(
      (q) =>
        q.priority === "essential_before_birth" ||
        q.priority === "high" ||
        q.babymoon_priority,
    );
  }
  if (filters.include_practical) {
    list = list.filter((q) => PRACTICAL_TYPES.has(q.question_type));
  }
  if (filters.include_philosophical) {
    list = list.filter((q) => PHILOSOPHICAL_TYPES.has(q.question_type));
  }
  if (filters.include_evidence) {
    list = list.filter((q) => q.evidence_available || q.evidence_summary);
  }

  if (filters.preset === "not_considered") {
    list = list.filter((q) => !answeredIds.has(q.id));
    list.sort((a, b) => {
      const ac = Math.min(...a.categories.map((c) => recentCategoryCounts.get(c) ?? 0));
      const bc = Math.min(...b.categories.map((c) => recentCategoryCounts.get(c) ?? 0));
      return ac - bc || a.logical_order - b.logical_order;
    });
    return list;
  }

  if (filters.preset === "fifteen_minutes") {
    list = list
      .filter((q) => !answeredIds.has(q.id) && q.estimated_minutes <= 8)
      .sort((a, b) => {
        const ap = priorityScore(a);
        const bp = priorityScore(b);
        return bp - ap || a.logical_order - b.logical_order;
      });
    return list;
  }

  list.sort((a, b) => {
    const score = priorityScore(b) - priorityScore(a);
    if (score !== 0) return score;
    return a.logical_order - b.logical_order;
  });

  return diversify(list);
}

function priorityScore(q: Question) {
  let score = 0;
  if (q.required_before_birth || q.priority === "essential_before_birth") score += 50;
  if (q.babymoon_priority) score += 30;
  if (q.priority === "high") score += 20;
  if (q.priority === "medium") score += 10;
  if (q.categories.some((c) => (BABYMOON_WEIGHT_CATEGORIES as readonly string[]).includes(c))) {
    score += 15;
  }
  return score;
}

function diversify(questions: Question[]) {
  const result: Question[] = [];
  const usedCategories = new Set<string>();
  const remaining = [...questions];

  while (remaining.length) {
    let idx = remaining.findIndex((q) => !q.categories.some((c) => usedCategories.has(c)));
    if (idx === -1) {
      usedCategories.clear();
      idx = 0;
    }
    const next = remaining.splice(idx, 1)[0];
    result.push(next);
    next.categories.forEach((c) => usedCategories.add(c));
  }
  return result;
}

export async function createSession(input: CreateSessionInput) {
  const data = createSessionSchema.parse(input);
  const store = await readStore();
  const answeredIds = new Set(
    store.answers.filter((a) => a.is_shared || a.status !== "not_started").map((a) => a.question_id),
  );
  const unresolvedIds = new Set(
    store.answers
      .filter((a) =>
        ["undecided", "needs_research", "cooling_off", "in_discussion"].includes(a.status),
      )
      .map((a) => a.question_id),
  );

  const recentCategoryCounts = new Map<string, number>();
  for (const sq of store.session_questions.slice(-50)) {
    const q = store.questions.find((item) => item.id === sq.question_id);
    q?.categories.forEach((c) => {
      recentCategoryCounts.set(c, (recentCategoryCounts.get(c) ?? 0) + 1);
    });
  }

  const filtered = filterQuestions(
    store.questions,
    answeredIds,
    unresolvedIds,
    data.filters,
    recentCategoryCounts,
  );

  const count = data.question_ids?.length
    ? data.question_ids.length
    : sessionQuestionCount(data.length);
  const selectedIds =
    data.question_ids ??
    filtered.slice(0, count).map((q) => q.id);

  const timestamp = nowIso();
  let createdId = "";

  await updateStore((s) => {
    const session: Session = {
      id: id("session"),
      family_id: s.family.id,
      title: data.title,
      description: data.description ?? null,
      length: data.length,
      status: "active",
      filters: data.filters,
      current_index: 0,
      note: null,
      babymoon_mode: data.babymoon_mode ?? false,
      started_at: timestamp,
      completed_at: null,
      updated_at: timestamp,
    };
    createdId = session.id;
    s.sessions.unshift(session);
    selectedIds.forEach((questionId, index) => {
      const sq: SessionQuestion = {
        id: id("sq"),
        session_id: session.id,
        question_id: questionId,
        sort_order: index,
        status: "pending",
        answered_at: null,
      };
      s.session_questions.push(sq);
    });
    s.activity_log.unshift({
      id: id("act"),
      family_id: s.family.id,
      actor_id: s.current_user_id,
      event_type: "session_started",
      entity_type: "session",
      entity_id: session.id,
      metadata: { count: selectedIds.length },
      created_at: timestamp,
    });
    return s;
  });

  return createdId;
}

export async function getSession(sessionId: string) {
  const store = await readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const items = store.session_questions
    .filter((sq) => sq.session_id === sessionId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sq) => ({
      ...sq,
      question: store.questions.find((q) => q.id === sq.question_id)!,
    }));
  return { session, items };
}

export async function advanceSession(
  sessionId: string,
  action: "answered" | "skipped" | "pause" | "complete",
  note?: string,
) {
  const timestamp = nowIso();
  await updateStore((store) => {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Session not found");
    const items = store.session_questions
      .filter((sq) => sq.session_id === sessionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (action === "pause") {
      session.status = "paused";
      session.updated_at = timestamp;
      if (note !== undefined) session.note = note;
      return store;
    }

    if (action === "complete") {
      session.status = "completed";
      session.completed_at = timestamp;
      session.updated_at = timestamp;
      if (note !== undefined) session.note = note;
      return store;
    }

    const current = items[session.current_index];
    if (current) {
      current.status = action === "answered" ? "answered" : "skipped";
      current.answered_at = timestamp;
    }
    if (session.current_index >= items.length - 1) {
      session.status = "completed";
      session.completed_at = timestamp;
    } else {
      session.current_index += 1;
    }
    session.updated_at = timestamp;
    return store;
  });
}

export async function getSessionSummary(sessionId: string) {
  const detail = await getSession(sessionId);
  if (!detail) return null;
  const store = await readStore();
  const questionIds = detail.items.map((i) => i.question_id);
  const answers = store.answers.filter((a) => questionIds.includes(a.question_id));
  const decisions = store.decisions.filter((d) =>
    d.source_question_ids.some((id) => questionIds.includes(id)),
  );

  return {
    session: detail.session,
    completed: detail.items.filter((i) => i.status === "answered").length,
    skipped: detail.items.filter((i) => i.status === "skipped").length,
    total: detail.items.length,
    undecided: answers.filter((a) => a.status === "undecided").length,
    separate: answers.filter((a) => !a.is_shared).length,
    lowConfidence: answers.filter((a) => a.confidence !== null && a.confidence <= 2).length,
    research: answers.filter((a) => a.needs_research).length,
    coolingOff: store.cooling_off_items.filter(
      (c) => c.active && c.question_id && questionIds.includes(c.question_id),
    ).length,
    reviewLater: answers.filter((a) => a.review_date).length,
    decisions,
    answers,
    outcomes: [
      ...new Set(
        detail.items.flatMap((i) => i.question?.outcomes ?? []),
      ),
    ],
  };
}

export async function getActiveSession() {
  const store = await readStore();
  return (
    store.sessions.find((s) => s.status === "active" || s.status === "paused") ?? null
  );
}
