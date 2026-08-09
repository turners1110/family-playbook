import { describe, expect, it } from "vitest";
import { listProposedPrinciples } from "@/lib/knowledge/proposed-principles";
import type { Answer, AppStore, Question } from "@/lib/types/models";

function baseStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    family: {
      id: "fam",
      name: "Test",
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
        sort_order: 0,
        created_at: "",
      },
      {
        id: "m_michelle",
        family_id: "fam",
        user_id: "u_michelle",
        display_name: "Michelle",
        role: "parent",
        sort_order: 1,
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
      family_id: "fam",
      hide_partner_answers_until_both_saved: false,
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
    principle_proposal_feedback: [],
    current_user_id: "u_sam",
    demo_mode: true,
    ...overrides,
  } as AppStore;
}

function moneyQuestion(id: string, text: string): Question {
  return {
    id,
    slug: id,
    text,
    short_title: text,
    why_it_matters: "specific money why",
    discussion_guidance: "specific guidance for money talks",
    question_type: "values_clarification",
    response_schema: {},
    life_stages: ["toddler"],
    categories: ["money"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 1,
    priority: "high",
    babymoon_priority: false,
    required_before_birth: false,
    estimated_minutes: 10,
    emotional_weight: 3,
    research_mode: "optional",
    evidence_needed: false,
    evidence_available: false,
    evidence_summary: null,
    practical_tip: null,
    follow_up_prompts: [],
  } as unknown as Question;
}

function sharedAnswer(questionId: string, text: string): Answer {
  return {
    id: `a_${questionId}`,
    family_id: "fam",
    question_id: questionId,
    member_id: null,
    is_shared: true,
    payload: { text },
    status: "decided",
    confidence: 4,
    bookmarked: false,
    needs_research: false,
    review_date: null,
    version: 1,
    created_at: "",
    updated_at: "",
  } as Answer;
}

describe("proposed principles", () => {
  it("drafts a money principle from related answers", () => {
    const q1 = moneyQuestion(
      "q_allowance",
      "When should allowance begin?",
    );
    const q2 = moneyQuestion(
      "q_chores_money",
      "Should children earn spending money?",
    );
    const store = baseStore({
      questions: [q1, q2],
      answers: [
        sharedAnswer(
          q1.id,
          "Allowance starts at six with a save-first rule.",
        ),
        sharedAnswer(
          q2.id,
          "Spending money comes from chores and effort.",
        ),
      ],
    });
    const proposals = listProposedPrinciples(store);
    const money = proposals.find((p) => p.topicSlug === "money");
    expect(money).toBeTruthy();
    expect(money!.statement.toLowerCase()).toMatch(/money|effort|save|spend|allowance/);
    expect(money!.sourceAnswers.length).toBe(2);
    expect(money!.confidence).toBeGreaterThanOrEqual(3);
  });

  it("hides rejected proposals", () => {
    const q1 = moneyQuestion("q_budget", "How do we talk about budget?");
    const q2 = moneyQuestion("q_saving", "How do we teach saving?");
    const store = baseStore({
      questions: [q1, q2],
      answers: [
        sharedAnswer(q1.id, "We keep a simple family budget."),
        sharedAnswer(q2.id, "Save before spend."),
      ],
      principle_proposal_feedback: [
        {
          topic_slug: "money",
          status: "rejected",
          updated_at: "",
        },
      ],
    });
    expect(
      listProposedPrinciples(store).some((p) => p.topicSlug === "money"),
    ).toBe(false);
  });
});
