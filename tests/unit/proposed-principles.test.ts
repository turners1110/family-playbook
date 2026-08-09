import { describe, expect, it } from "vitest";
import {
  craftPrincipleStatement,
  extractAnswerThemes,
  explainPrincipleGaps,
} from "@/lib/knowledge/principle-synthesis";
import { listProposedPrinciples } from "@/lib/knowledge/proposed-principles";
import { recommendNextQuestions } from "@/lib/knowledge/topic-coverage";
import type { Answer, AppStore, Question } from "@/lib/types/models";

function baseStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    family: { id: "fam", name: "Test", created_at: "", updated_at: "" },
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

function q(partial: Partial<Question> & Pick<Question, "id" | "text">): Question {
  return {
    slug: partial.id,
    short_title: partial.text,
    why_it_matters: "specific why about money habits",
    discussion_guidance: "specific guidance",
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
    ...partial,
  } as unknown as Question;
}

function shared(questionId: string, text: string): Answer {
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
  } as unknown as Answer;
}

describe("principle synthesis specificity", () => {
  it("extracts ages and rules from answers", () => {
    const themes = extractAnswerThemes(
      "Allowance starts at age 6. Always save before spending. No more than $5 on candy.",
    );
    expect(themes.ages.length).toBeGreaterThan(0);
    expect(themes.rules.length).toBeGreaterThan(0);
    expect(themes.specificity).toBeGreaterThanOrEqual(4);
  });

  it("crafts a statement from concrete shared answers and preserves disagreement", () => {
    const crafted = craftPrincipleStatement({
      topicTitle: "Allowance",
      sharedPreviews: [
        "Allowance starts at age six with a save-first rule each week",
        "Base chores are unpaid family contribution; extra jobs can earn more",
      ],
      samThemes: extractAnswerThemes("Start at age 6; always save 50% first"),
      michelleThemes: extractAnswerThemes(
        "Start at age 7; never tie every chore to pay",
      ),
      sharedThemes: extractAnswerThemes(
        "Allowance starts at age six with a save-first rule each week",
      ),
      disagreements: [
        {
          question: "Should allowance be tied to chores",
          sam: "Tied to completed chores each week",
          michelle: "Untied base chores; pay only for extras",
        },
      ],
    });
    expect(crafted).toBeTruthy();
    expect(crafted!.statement.toLowerCase()).toMatch(/age six|save-first|chores/);
    expect(crafted!.statement.toLowerCase()).toMatch(/differ|sam|michelle/);
  });

  it("explains gaps when confidence is low", () => {
    const msg = explainPrincipleGaps({
      answeredCount: 2,
      importantUnanswered: 2,
      disagreementCount: 2,
      avgSpecificity: 2,
      hasShared: false,
    });
    expect(msg.toLowerCase()).toMatch(/missing/);
  });
});

describe("proposed principles from answers", () => {
  it("drafts an allowance principle from specific answers", () => {
    const q1 = q({
      id: "q_should_our_child_receive_an_allowance",
      text: "Should our child receive an allowance?",
    });
    const q2 = q({
      id: "q_should_allowance_be_tied_to_chores",
      text: "Should allowance be tied to chores?",
    });
    const q3 = q({
      id: "q_what_money_lessons_belong_before_age_eight",
      text: "What money lessons belong before age eight?",
      priority: "medium",
    });
    const store = baseStore({
      questions: [q1, q2, q3],
      answers: [
        shared(
          q1.id,
          "Yes — weekly allowance starting at age six, with save before spend.",
        ),
        shared(
          q2.id,
          "Base chores are always unpaid family contribution; only optional extras earn money.",
        ),
        shared(
          q3.id,
          "Before age eight: money comes from effort, wants are not needs, save a portion first.",
        ),
      ],
    });
    const proposals = listProposedPrinciples(store);
    const allowance =
      proposals.find((p) => p.topicSlug === "allowance") ??
      proposals.find((p) => p.topicSlug === "money");
    expect(allowance).toBeTruthy();
    expect(allowance!.readyToDraft).toBe(true);
    expect(allowance!.statement?.toLowerCase()).toMatch(
      /age six|allowance|chore|save/,
    );
    expect(allowance!.confidencePercent).toBeGreaterThan(40);
    expect(allowance!.usedSpecifics.length).toBeGreaterThan(0);
  });

  it("does not invent a generic principle from thin answers", () => {
    const q1 = q({
      id: "q_thin_a",
      text: "Money vibes?",
      categories: ["money"],
    });
    const q2 = q({
      id: "q_thin_b",
      text: "Spending vibes?",
      categories: ["money"],
    });
    const store = baseStore({
      questions: [q1, q2],
      answers: [shared(q1.id, "Yes."), shared(q2.id, "Maybe.")],
    });
    const money = listProposedPrinciples(store).find(
      (p) => p.topicSlug === "money" || p.topicSlug === "allowance",
    );
    if (money) {
      expect(money.readyToDraft).toBe(false);
      expect(money.missingExplanation).toBeTruthy();
    }
  });
});

describe("next question recommendations", () => {
  it("ranks unanswered high-importance questions with reasons", () => {
    const answered = q({
      id: "q_answered_money",
      text: "Should our child receive an allowance?",
      priority: "high",
    });
    const open = q({
      id: "q_open_chores",
      text: "Should allowance be tied to chores?",
      priority: "high",
    });
    const store = baseStore({
      questions: [answered, open],
      answers: [
        shared(
          answered.id,
          "Yes at age six with save-first every week without exception.",
        ),
      ],
    });
    const next = recommendNextQuestions(store, 5);
    expect(next.some((n) => n.questionId === open.id)).toBe(true);
    expect(next[0]?.reasons.length).toBeGreaterThan(0);
  });
});
