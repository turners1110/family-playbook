import { readStore } from "@/lib/db/local-store";
import { BABYMOON_WEIGHT_CATEGORIES, LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import type { LifeStage } from "@/lib/constants/enums";

export async function getDashboardStats() {
  const store = await readStore();
  const totalQuestions = store.questions.filter((q) => q.active).length;
  const answeredQuestionIds = new Set(store.answers.map((a) => a.question_id));
  const questionsAnswered = answeredQuestionIds.size;
  const questionsRemaining = Math.max(totalQuestions - questionsAnswered, 0);
  const completion = totalQuestions
    ? Math.round((questionsAnswered / totalQuestions) * 100)
    : 0;

  const decisionsReached = store.decisions.filter((d) =>
    ["decided", "tentatively_decided"].includes(d.status),
  ).length;
  const undecided = store.decisions.filter((d) =>
    ["undecided", "not_started", "in_discussion"].includes(d.status),
  ).length;
  const disagreements = store.decisions.filter((d) => d.has_disagreement).length;
  const coolingOff = store.cooling_off_items.filter((c) => c.active).length;
  const researchNeeded =
    store.answers.filter((a) => a.needs_research).length +
    store.decisions.filter((d) => d.status === "needs_research").length;
  const reviewLater =
    store.reviews.filter((r) => !r.completed).length +
    store.answers.filter((a) => a.review_date).length;
  const lowConfidence = [
    ...store.answers.filter((a) => a.confidence !== null && a.confidence <= 2),
    ...store.decisions.filter((d) => d.confidence !== null && d.confidence <= 2),
  ].length;

  const highPriorityUnanswered = store.questions.filter(
    (q) =>
      (q.priority === "essential_before_birth" || q.priority === "high") &&
      !answeredQuestionIds.has(q.id),
  ).length;

  const byStage = store.life_stages.map((stage) => {
    const stageQuestions = store.questions.filter(
      (q) =>
        q.life_stages.includes(stage.slug) ||
        (stage.slug !== "all_stages" && q.life_stages.includes("all_stages")),
    );
    const answered = stageQuestions.filter((q) => answeredQuestionIds.has(q.id)).length;
    return {
      slug: stage.slug,
      label: stage.label,
      total: stageQuestions.length,
      answered,
      pct: stageQuestions.length ? Math.round((answered / stageQuestions.length) * 100) : 0,
    };
  });

  const byCategory = store.categories.map((cat) => {
    const qs = store.questions.filter((q) => q.categories.includes(cat.slug));
    const answered = qs.filter((q) => answeredQuestionIds.has(q.id)).length;
    return {
      slug: cat.slug,
      label: cat.label,
      total: qs.length,
      answered,
      pct: qs.length ? Math.round((answered / qs.length) * 100) : 0,
    };
  }).filter((c) => c.total > 0);

  const byOutcome = store.outcomes.map((outcome) => {
    const qs = store.questions.filter((q) => q.outcomes.includes(outcome.slug));
    const answered = qs.filter((q) => answeredQuestionIds.has(q.id)).length;
    const linkedDecisions = store.decisions.filter((d) =>
      d.outcome_ids.includes(outcome.id),
    ).length;
    return {
      slug: outcome.slug,
      label: outcome.label,
      total: qs.length,
      answered,
      linkedDecisions,
      coverage: qs.length ? Math.round((answered / qs.length) * 100) : linkedDecisions > 0 ? 50 : 0,
    };
  });

  const babymoonQuestions = store.questions.filter(
    (q) =>
      q.babymoon_priority ||
      q.required_before_birth ||
      q.categories.some((c) => (BABYMOON_WEIGHT_CATEGORIES as readonly string[]).includes(c)),
  );
  const babymoonAnswered = babymoonQuestions.filter((q) =>
    answeredQuestionIds.has(q.id),
  ).length;
  const babymoonPct = babymoonQuestions.length
    ? Math.round((babymoonAnswered / babymoonQuestions.length) * 100)
    : 0;

  const recentDecisions = store.decisions
    .slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const recentActivity = store.activity_log.slice(0, 12);

  const lastSession =
    store.sessions.find((s) => s.status === "active" || s.status === "paused") ??
    store.sessions[0] ??
    null;

  const essentialRemaining = store.questions.filter(
    (q) =>
      (q.required_before_birth || q.priority === "essential_before_birth") &&
      !answeredQuestionIds.has(q.id),
  );

  return {
    totalQuestions,
    questionsAnswered,
    questionsRemaining,
    completion,
    decisionsReached,
    undecided,
    disagreements,
    coolingOff,
    researchNeeded,
    reviewLater,
    lowConfidence,
    highPriorityUnanswered,
    byStage,
    byCategory,
    byOutcome,
    babymoonPct,
    babymoonAnswered,
    babymoonTotal: babymoonQuestions.length,
    babymoonTargetDate: store.settings.babymoon_target_date,
    recentDecisions,
    recentActivity,
    lastSession,
    essentialRemaining: essentialRemaining.slice(0, 10),
    upcomingReviews: store.reviews.filter((r) => !r.completed).slice(0, 8),
    familyName: store.family.name,
    members: store.members,
  };
}

export async function searchAll(query: string) {
  const q = query.trim().toLowerCase();
  const store = await readStore();
  if (!q) {
    return {
      questions: [],
      answers: [],
      decisions: [],
      outcomes: [],
      principles: [],
      knowledge: [],
      notes: [],
      checklist_tasks: [],
    };
  }

  const questions = store.questions
    .filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.short_title.toLowerCase().includes(q) ||
        item.why_it_matters.toLowerCase().includes(q),
    )
    .slice(0, 20);

  const answers = store.answers
    .filter((a) => JSON.stringify(a.payload).toLowerCase().includes(q))
    .slice(0, 20)
    .map((a) => ({
      ...a,
      question: store.questions.find((item) => item.id === a.question_id),
    }));

  const decisions = store.decisions
    .filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.statement.toLowerCase().includes(q) ||
        (d.reasoning ?? "").toLowerCase().includes(q),
    )
    .slice(0, 20);

  const outcomes = store.outcomes
    .filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.definition.toLowerCase().includes(q),
    )
    .slice(0, 20);

  const principles = store.principles
    .filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.statement.toLowerCase().includes(q),
    )
    .slice(0, 20);

  const knowledge = store.knowledge_items
    .filter(
      (k) =>
        k.title.toLowerCase().includes(q) ||
        k.summary.toLowerCase().includes(q) ||
        (k.notes ?? "").toLowerCase().includes(q),
    )
    .slice(0, 20);

  const notes = [
    ...store.answers
      .filter((a) => (a.payload.notes ?? "").toLowerCase().includes(q))
      .map((a) => ({
        id: a.id,
        type: "answer_note" as const,
        text: a.payload.notes!,
        ref: a.question_id,
      })),
    ...store.sessions
      .filter((s) => (s.note ?? "").toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        type: "session_note" as const,
        text: s.note!,
        ref: s.id,
      })),
  ].slice(0, 20);

  const checklist_tasks = (store.checklist_tasks ?? [])
    .filter((t) => !t.archived)
    .filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q) ||
        t.category_label.toLowerCase().includes(q) ||
        t.owner.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q) ||
        (t.relative_timing_label ?? "").toLowerCase().includes(q) ||
        (t.created_from_label ?? "").toLowerCase().includes(q) ||
        (t.linked_question_ids ?? []).some((id) => id.toLowerCase().includes(q)) ||
        (t.linked_conversation_ids ?? []).some((id) =>
          id.toLowerCase().includes(q),
        ) ||
        (t.linked_research_ids ?? []).some((id) => id.toLowerCase().includes(q)),
    )
    .slice(0, 20);

  return {
    questions,
    answers,
    decisions,
    outcomes,
    principles,
    knowledge,
    notes,
    checklist_tasks,
  };
}

export function lifeStageLabel(slug: LifeStage) {
  return LIFE_STAGE_LABELS[slug];
}
