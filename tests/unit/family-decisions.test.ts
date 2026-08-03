import { describe, expect, it, beforeEach } from "vitest";
import type { AppStore, Decision, Question } from "@/lib/types/models";
import {
  buildFamilyDecisionGraph,
  clearFamilyDecisionGraphCache,
  decisionHref,
  decisionsNeedingAttention,
  getDecisionsForQuestion,
  getFamilyDecisionBySlugOrId,
  getRelatedDecisions,
  listFamilyDecisions,
  normalizeDecision,
  scoreDecisionHealth,
  searchFamilyDecisions,
  slugifyDecisionTitle,
  traverseDecisionEdges,
} from "@/lib/knowledge";

const ts = "2026-08-01T12:00:00.000Z";

function question(partial: Partial<Question> & { id: string; slug: string }): Question {
  return {
    short_title: partial.short_title ?? partial.slug,
    text: partial.text ?? partial.slug,
    why_it_matters: "x",
    discussion_guidance: "x",
    question_type: "open_response",
    response_schema: {},
    life_stages: ["pregnancy"],
    categories: partial.categories ?? ["birth"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 1,
    priority: "high",
    estimated_minutes: 10,
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
    required_before_birth: true,
    babymoon_priority: true,
    research_mode: "optional_background",
    active: true,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

function emptyStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    family: { id: "family_t", name: "Turner Family", created_at: ts, updated_at: ts },
    members: [],
    users: [],
    children: [],
    life_stages: [],
    categories: [],
    outcome_domains: [],
    outcomes: [],
    development_maps: [],
    principles: [],
    questions: [],
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
      family_id: "family_t",
      hide_partner_answers_until_both_saved: false,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 3,
      include_perspective_history_in_playbook: false,
      updated_at: ts,
    },
    ai_outputs: [],
    playbook_versions: [],
    checklist_instances: [],
    checklist_tasks: [],
    conversation_sessions: [],
    conversation_session_items: [],
    conversation_quick_answers: [],
    conversation_differences: [],
    current_user_id: "user_sam",
    demo_mode: false,
    ...overrides,
  } as AppStore;
}

function decision(partial: Partial<Decision> & { id: string; title: string }): Decision {
  return {
    family_id: "family_t",
    statement: partial.statement ?? partial.title,
    problem: null,
    reasoning: null,
    sam_perspective: null,
    michelle_perspective: null,
    shared_conclusion: partial.shared_conclusion ?? null,
    agreement_notes: null,
    disagreement_notes: null,
    status: "decided",
    confidence: 4,
    decision_type: "philosophical",
    evidence_strength: "moderate",
    emotional_weight: 3,
    reversibility: "moderate",
    child_dependent: false,
    life_stages: ["pregnancy"],
    categories: ["birth"],
    research_notes: null,
    implementation_notes: null,
    exceptions: null,
    risks: null,
    warning_signs: null,
    reconsideration_conditions: null,
    review_date: null,
    has_disagreement: false,
    version: 1,
    source_question_ids: [],
    outcome_ids: [],
    principle_ids: [],
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

describe("family decision knowledge layer", () => {
  beforeEach(() => {
    clearFamilyDecisionGraphCache();
  });

  it("normalizes legacy decisions with slug and link defaults", () => {
    const d = normalizeDecision(
      decision({ id: "decision_1", title: "Visitors after birth" }),
    );
    expect(d.slug).toBe("visitors-after-birth");
    expect(d.linked_question_ids).toEqual([]);
    expect(d.related_decision_ids).toEqual([]);
  });

  it("generates decisions from persisted rows without duplication", () => {
    const store = emptyStore({
      decisions: [
        decision({
          id: "decision_1",
          title: "Visitors after birth",
          slug: "visitors-after-birth",
          shared_conclusion: "Parents only for the first week.",
          source_question_ids: ["q_visitors"],
        }),
      ],
      questions: [
        question({
          id: "q_visitors",
          slug: "visitors",
          short_title: "Visitors after birth?",
          categories: ["birth", "visitors"],
        }),
      ],
    });
    const nodes = listFamilyDecisions(store);
    expect(nodes.filter((n) => n.slug === "visitors-after-birth")).toHaveLength(
      1,
    );
    expect(nodes[0]?.source).toBe("persisted");
    expect(nodes[0]?.currentPosition).toContain("Parents only");
  });

  it("synthesizes topic hubs from matching questions and answers", () => {
    const store = emptyStore({
      questions: [
        question({
          id: "q1",
          slug: "sleep-1",
          short_title: "Where will baby sleep?",
          categories: ["sleep"],
          text: "Bassinet or room sharing?",
        }),
        question({
          id: "q2",
          slug: "sleep-2",
          short_title: "Night waking plan",
          categories: ["sleep"],
        }),
      ],
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q1",
          member_id: null,
          is_shared: true,
          payload: { text: "Room share for six months" },
          status: "decided",
          confidence: 4,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
    });
    const sleep = getFamilyDecisionBySlugOrId(store, "sleep");
    expect(sleep).toBeTruthy();
    expect(sleep?.source).toBe("synthesized");
    expect(sleep?.linkedQuestionIds).toContain("q1");
    expect(sleep?.currentPosition).toContain("Room share");
  });

  it("links questions and conversations to decisions", () => {
    const store = emptyStore({
      questions: [
        question({
          id: "q_birth",
          slug: "birth-prefs",
          short_title: "Birth preferences",
          categories: ["birth"],
          text: "Labor and delivery preferences",
        }),
      ],
      conversation_sessions: [
        {
          id: "csess_1",
          family_id: "family_t",
          mode: "babymoon",
          title: "Birth round",
          planned_minutes: 15,
          status: "completed",
          started_at: ts,
          paused_at: null,
          completed_at: ts,
          active_seconds: 100,
          session_tag: "babymoon_set_v1_round_2",
          created_by: "user_sam",
          current_item_index: 0,
          summary: { agreed: [], differed: [], discuss_later: [], tasks_suggested: [], provider_questions: ["Ask OB about induction"], light_moment: null, trip_memory: null, notes: null },
          created_at: ts,
          updated_at: ts,
        },
      ],
      conversation_session_items: [
        {
          id: "citem_1",
          session_id: "csess_1",
          prompt_id: "qp_x",
          source_question_id: "q_birth",
          item_type: "quick_pick",
          display_order: 0,
          energy: "light",
          estimated_time_seconds: 20,
          actual_time_seconds: 10,
          status: "answered_same",
          opened_at: ts,
          answered_at: ts,
          paused_duration_seconds: 0,
          branch_context: null,
          created_at: ts,
          updated_at: ts,
        },
      ],
    });
    const birth = getFamilyDecisionBySlugOrId(store, "birth-plan");
    expect(birth?.linkedQuestionIds).toContain("q_birth");
    expect(birth?.linkedConversationIds).toContain("csess_1");
    expect(birth?.linkedProviderNotes.join(" ")).toContain("induction");
    expect(getDecisionsForQuestion(store, "q_birth").some((d) => d.slug === "birth-plan")).toBe(true);
  });

  it("links checklist tasks and knowledge items", () => {
    const store = emptyStore({
      questions: [
        question({
          id: "q_care",
          slug: "daycare",
          short_title: "Daycare options",
          categories: ["childcare"],
          text: "How will we handle childcare?",
        }),
      ],
      checklist_tasks: [
        {
          id: "task_1",
          checklist_id: "cl_1",
          template_task_slug: null,
          title: "Tour daycare",
          category: "childcare",
          category_label: "Childcare",
          completed: false,
          completed_at: null,
          due_date: null,
          priority: "medium",
          owner: "both",
          notes: null,
          is_custom: true,
          is_default: false,
          archived: false,
          sort_order: 1,
          created_at: ts,
          updated_at: ts,
          linked_question_ids: ["q_care"],
        },
      ],
      knowledge_items: [
        {
          id: "k_book",
          family_id: "family_t",
          title: "Expecting Better",
          summary: "Evidence on pregnancy choices",
          item_type: "book_note",
          source: "book",
          author: "Emily Oster",
          publication: null,
          publication_date: null,
          url: null,
          source_type: "book",
          evidence_quality: "strong",
          life_stages: [],
          categories: ["childcare"],
          related_question_ids: ["q_care"],
          related_decision_ids: [],
          related_outcome_ids: [],
          notes: null,
          is_sample: false,
          date_added: ts,
          date_reviewed: null,
        },
      ],
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q_care",
          member_id: null,
          is_shared: true,
          payload: { text: "Visit two centers" },
          status: "tentatively_decided",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
    });
    const node = getFamilyDecisionBySlugOrId(store, "childcare");
    expect(node?.tasks.some((t) => t.title === "Tour daycare")).toBe(true);
    expect(node?.books.some((b) => b.title === "Expecting Better")).toBe(true);
  });

  it("computes related decisions and graph edges", () => {
    const store = emptyStore({
      questions: [
        question({
          id: "q_sleep",
          slug: "sleep",
          short_title: "Sleep plan",
          categories: ["sleep"],
        }),
        question({
          id: "q_feed",
          slug: "feed",
          short_title: "Night feeding",
          categories: ["sleep", "feeding"],
          text: "Feeding overnight",
        }),
      ],
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q_sleep",
          member_id: null,
          is_shared: true,
          payload: { text: "Bassinet" },
          status: "decided",
          confidence: 4,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: ts,
          updated_at: ts,
        },
        {
          id: "a2",
          family_id: "family_t",
          question_id: "q_feed",
          member_id: null,
          is_shared: true,
          payload: { text: "Feed on demand" },
          status: "decided",
          confidence: 4,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
    });
    const sleep = getFamilyDecisionBySlugOrId(store, "sleep");
    expect(sleep).toBeTruthy();
    const related = getRelatedDecisions(store, sleep!.id);
    expect(related.some((r) => r.slug === "feeding")).toBe(true);
    const edges = traverseDecisionEdges(store, sleep!.id, "decision_to_decision");
    expect(edges.length).toBeGreaterThan(0);
  });

  it("scores decision health and attention list", () => {
    const health = scoreDecisionHealth({
      status: "in_discussion",
      confidence: 1,
      hasDisagreement: true,
      sharedAnswer: false,
      questionCount: 4,
      answeredQuestionCount: 1,
      bookCount: 0,
      researchCount: 0,
      providerCount: 0,
      taskCount: 2,
      completedTaskCount: 0,
      lastReviewedAt: null,
      nextReviewDate: "2020-01-01",
    });
    expect(health.grade).toBe("needs_attention");
    expect(health.insights).toContain("Missing discussion");

    const store = emptyStore({
      decisions: [
        decision({
          id: "decision_weak",
          title: "Screens",
          status: "needs_research",
          confidence: 1,
          has_disagreement: true,
          shared_conclusion: null,
        }),
      ],
    });
    expect(decisionsNeedingAttention(store).length).toBeGreaterThan(0);
  });

  it("search finds decisions and href uses slug", () => {
    const store = emptyStore({
      decisions: [
        decision({
          id: "decision_1",
          title: "Visitors after birth",
          slug: "visitors-after-birth",
          statement: "Parents only first week",
        }),
      ],
    });
    const hits = searchFamilyDecisions(store, "visitors");
    expect(hits[0]?.slug).toBe("visitors-after-birth");
    expect(decisionHref(hits[0]!)).toBe("/decisions/visitors-after-birth");
  });

  it("memoizes graph construction", () => {
    const store = emptyStore({
      questions: [
        question({
          id: "q1",
          slug: "sleep-a",
          short_title: "Sleep A",
          categories: ["sleep"],
        }),
        question({
          id: "q2",
          slug: "sleep-b",
          short_title: "Sleep B",
          categories: ["sleep"],
        }),
      ],
    });
    const a = buildFamilyDecisionGraph(store);
    const b = buildFamilyDecisionGraph(store);
    expect(a).toBe(b);
  });

  it("slugify is stable", () => {
    expect(slugifyDecisionTitle("Visitors After Birth!")).toBe(
      "visitors-after-birth",
    );
  });
});
