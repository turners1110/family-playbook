import { describe, expect, it } from "vitest";
import type {
  Answer,
  AppStore,
  Decision,
  Question,
} from "@/lib/types/models";
import {
  buildQuestionStatusIndex,
  filterCounts,
  getQuestionAnswerStatus,
  hasAnswerContent,
  matchesStatusFilter,
  summarizeQuestionProgress,
} from "@/lib/services/question-status";
import { filterQuestions } from "@/lib/services/sessions";

const NOW = new Date("2026-08-01T15:42:00.000Z");

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    slug: "sleep-goals",
    text: "Sleep goals?",
    short_title: "Sleep",
    why_it_matters: "x",
    discussion_guidance: "x",
    question_type: "joint_discussion",
    response_schema: {},
    life_stages: ["newborn_0_3"],
    categories: ["sleep"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 10,
    priority: "high",
    estimated_minutes: 5,
    emotional_weight: 3,
    evidence_needed: false,
    evidence_available: false,
    evidence_summary: null,
    practical_tip: null,
    separate_answers_recommended: false,
    cooling_off_recommended: false,
    follow_up_prompts: [],
    review_recommendation: null,
    child_dependent: false,
    required_before_birth: false,
    babymoon_priority: false,
    research_mode: "optional_background",
    active: true,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseAnswer(overrides: Partial<Answer> = {}): Answer {
  return {
    id: "a1",
    family_id: "fam",
    question_id: "q1",
    member_id: null,
    is_shared: true,
    payload: { text: "We protect rest." },
    status: "tentatively_decided",
    confidence: 4,
    bookmarked: false,
    needs_research: false,
    review_date: null,
    version: 1,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function baseDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "d1",
    family_id: "fam",
    title: "Sleep plan",
    statement: "Protect rest.",
    problem: null,
    reasoning: null,
    sam_perspective: null,
    michelle_perspective: null,
    shared_conclusion: null,
    agreement_notes: null,
    disagreement_notes: null,
    status: "tentatively_decided",
    confidence: 4,
    decision_type: "operational",
    evidence_strength: "moderate",
    emotional_weight: 3,
    reversibility: "moderate",
    child_dependent: false,
    life_stages: [],
    categories: [],
    research_notes: null,
    implementation_notes: null,
    exceptions: null,
    risks: null,
    warning_signs: null,
    reconsideration_conditions: null,
    review_date: null,
    has_disagreement: false,
    version: 1,
    source_question_ids: ["q1"],
    outcome_ids: [],
    principle_ids: [],
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}

function makeStore(partial: Partial<AppStore> = {}): AppStore {
  return {
    family: {
      id: "fam",
      name: "Turner",
      created_at: "",
      updated_at: "",
    },
    users: [],
    members: [
      {
        id: "m_sam",
        family_id: "fam",
        user_id: "u_sam",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: "",
      },
      {
        id: "m_michelle",
        family_id: "fam",
        user_id: "u_michelle",
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: "",
      },
    ],
    children: [],
    life_stages: [],
    categories: [],
    outcome_domains: [],
    outcomes: [],
    development_maps: [],
    principles: [],
    questions: [baseQuestion()],
    question_options: [],
    answers: [],
    answer_versions: [],
    decisions: [],
    decision_versions: [],
    sessions: [],
    session_questions: [],
    knowledge_items: [],
    cooling_off_items: [],
    reviews: [],
    bookmarks: [],
    activity_log: [],
    settings: {
      family_id: "fam",
      hide_partner_answers_until_both_saved: true,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 3,
      include_perspective_history_in_playbook: true,
      updated_at: "",
    },
    ai_outputs: [],
    playbook_versions: [],
    checklist_instances: [],
    checklist_tasks: [],
    current_user_id: "u_sam",
    demo_mode: false,
    ...partial,
  };
}

describe("hasAnswerContent", () => {
  it("treats blank drafts and notes-only as unanswered", () => {
    expect(hasAnswerContent({})).toBe(false);
    expect(hasAnswerContent({ text: "   " })).toBe(false);
    expect(hasAnswerContent({ notes: "thinking aloud" })).toBe(false);
    expect(hasAnswerContent({ text: "Real answer" })).toBe(true);
    expect(hasAnswerContent({ quick: "yes" })).toBe(true);
    expect(hasAnswerContent({ scale: 4 })).toBe(true);
  });
});

describe("getQuestionAnswerStatus", () => {
  it("marks no answers as unanswered", () => {
    const status = getQuestionAnswerStatus("q1", makeStore(), NOW);
    expect(status.primary).toBe("unanswered");
    expect(status.fullyAnswered).toBe(false);
    expect(status.skipByDefault).toBe(false);
  });

  it("detects Sam-only answers", () => {
    const store = makeStore({
      answers: [
        baseAnswer({
          id: "a_sam",
          is_shared: false,
          member_id: "m_sam",
          payload: { text: "Sam view" },
        }),
      ],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("sam_answered");
    expect(status.sam).toBe("answered");
    expect(status.michelle).toBe("unanswered");
    expect(status.partiallyAnswered).toBe(true);
  });

  it("detects Michelle-only answers", () => {
    const store = makeStore({
      answers: [
        baseAnswer({
          id: "a_m",
          is_shared: false,
          member_id: "m_michelle",
          payload: { text: "Michelle view" },
        }),
      ],
    });
    expect(getQuestionAnswerStatus("q1", store, NOW).primary).toBe(
      "michelle_answered",
    );
  });

  it("detects both answered separately", () => {
    const store = makeStore({
      answers: [
        baseAnswer({
          id: "a_sam",
          is_shared: false,
          member_id: "m_sam",
          payload: { text: "Sam" },
        }),
        baseAnswer({
          id: "a_m",
          is_shared: false,
          member_id: "m_michelle",
          payload: { text: "Michelle" },
        }),
      ],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("both_answered");
    expect(status.fullyAnswered).toBe(true);
    expect(status.skipByDefault).toBe(true);
  });

  it("detects shared answer saved", () => {
    const store = makeStore({
      answers: [baseAnswer()],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("shared_answer_saved");
    expect(status.shared).toBe("answered");
    expect(status.fullyAnswered).toBe(true);
  });

  it("detects undecided decision status", () => {
    const store = makeStore({
      answers: [baseAnswer({ status: "undecided" })],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("undecided");
    expect(status.undecided).toBe(true);
    expect(status.skipByDefault).toBe(false);
  });

  it("detects active cooling-off period", () => {
    const store = makeStore({
      answers: [baseAnswer()],
      cooling_off_items: [
        {
          id: "c1",
          family_id: "fam",
          question_id: "q1",
          decision_id: null,
          start_date: "2026-07-28",
          wait_days: 7,
          reason: "pause",
          revisit_date: "2026-08-04",
          notes: null,
          active: true,
          created_at: "2026-07-28T00:00:00.000Z",
        },
      ],
    });
    expect(getQuestionAnswerStatus("q1", store, NOW).primary).toBe("cooling_off");
  });

  it("detects review due", () => {
    const store = makeStore({
      answers: [baseAnswer({ review_date: "2026-07-30" })],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("needs_review");
    expect(status.reviewDue).toBe(true);
  });

  it("detects changed answer after shared decision", () => {
    const store = makeStore({
      answers: [
        baseAnswer({
          updated_at: "2026-07-25T00:00:00.000Z",
        }),
      ],
      decisions: [
        baseDecision({
          updated_at: "2026-07-20T00:00:00.000Z",
        }),
      ],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("answer_changed");
    expect(status.answerChanged).toBe(true);
    expect(status.skipByDefault).toBe(false);
  });

  it("does not treat blank draft as answered", () => {
    const store = makeStore({
      answers: [
        baseAnswer({
          is_shared: false,
          member_id: "m_sam",
          payload: { notes: "draft only" },
        }),
      ],
    });
    const status = getQuestionAnswerStatus("q1", store, NOW);
    expect(status.primary).toBe("unanswered");
    expect(status.sam).toBe("draft");
    expect(status.partiallyAnswered).toBe(false);
  });
});

describe("progress and filters", () => {
  it("excludes test data from progress", () => {
    const store = makeStore({
      questions: [
        baseQuestion({ id: "q1", slug: "sleep" }),
        baseQuestion({
          id: "q_test_1",
          slug: "test-question",
          logical_order: 99,
        }),
        baseQuestion({
          id: "q_inactive",
          slug: "inactive",
          active: false,
          logical_order: 98,
        }),
      ],
      answers: [baseAnswer({ question_id: "q1" })],
    });
    const summary = summarizeQuestionProgress(store);
    expect(summary.total).toBe(1);
    expect(summary.fullyAnswered).toBe(1);
    expect(summary.unanswered).toBe(0);
  });

  it("computes list filter counts", () => {
    const store = makeStore({
      questions: [
        baseQuestion({ id: "q1", slug: "a", logical_order: 1 }),
        baseQuestion({ id: "q2", slug: "b", logical_order: 2 }),
        baseQuestion({ id: "q3", slug: "c", logical_order: 3 }),
      ],
      answers: [
        baseAnswer({ question_id: "q1" }),
        baseAnswer({
          id: "a2",
          question_id: "q2",
          is_shared: false,
          member_id: "m_sam",
          payload: { text: "Sam only" },
        }),
      ],
    });
    const index = buildQuestionStatusIndex(store, NOW);
    const counts = filterCounts(store.questions, index);
    expect(counts.all).toBe(3);
    expect(counts.shared_complete).toBe(1);
    expect(counts.partial).toBe(1);
    expect(counts.unanswered).toBe(1);
    expect(matchesStatusFilter(index.get("q1")!, "shared_complete")).toBe(true);
  });
});

describe("interview mode skipping", () => {
  const questions = [
    baseQuestion({ id: "q1", slug: "done", logical_order: 1 }),
    baseQuestion({ id: "q2", slug: "open", logical_order: 2, categories: ["feeding"] }),
  ];

  it("skips fully answered questions by default", () => {
    const store = makeStore({
      questions,
      answers: [baseAnswer({ question_id: "q1" })],
    });
    const index = buildQuestionStatusIndex(store, NOW);
    const result = filterQuestions(
      questions,
      new Set(["q1"]),
      new Set(),
      {},
      new Map(),
      index,
    );
    expect(result.map((q) => q.id)).toEqual(["q2"]);
  });

  it("includes answered questions when requested", () => {
    const store = makeStore({
      questions,
      answers: [baseAnswer({ question_id: "q1" })],
    });
    const index = buildQuestionStatusIndex(store, NOW);
    const result = filterQuestions(
      questions,
      new Set(["q1"]),
      new Set(),
      { include_answered: true },
      new Map(),
      index,
    );
    expect(result.map((q) => q.id).sort()).toEqual(["q1", "q2"]);
  });

  it("can focus on undecided review", () => {
    const store = makeStore({
      questions,
      answers: [
        baseAnswer({ question_id: "q1", status: "undecided" }),
        baseAnswer({
          id: "a2",
          question_id: "q2",
          payload: { text: "Settled" },
          status: "tentatively_decided",
        }),
      ],
    });
    const index = buildQuestionStatusIndex(store, NOW);
    const result = filterQuestions(
      questions,
      new Set(),
      new Set(),
      { review_undecided: true },
      new Map(),
      index,
    );
    expect(result.map((q) => q.id)).toEqual(["q1"]);
  });
});
