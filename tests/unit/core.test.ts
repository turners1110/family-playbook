import { describe, expect, it } from "vitest";
import { saveAnswerSchema, createSessionSchema, sessionQuestionCount } from "@/lib/validation/schemas";
import { canRevealPartnerAnswers } from "@/lib/services/answers";
import { filterQuestions } from "@/lib/services/sessions";
import type { Question } from "@/lib/types/models";

describe("validation", () => {
  it("accepts a valid answer payload", () => {
    const parsed = saveAnswerSchema.parse({
      question_id: "q_1",
      is_shared: true,
      payload: { text: "We will protect rest after birth." },
      status: "tentatively_decided",
      confidence: 4,
    });
    expect(parsed.confidence).toBe(4);
  });

  it("computes session lengths", () => {
    expect(sessionQuestionCount("quick")).toBe(4);
    expect(sessionQuestionCount("standard")).toBe(10);
    expect(sessionQuestionCount("deep")).toBe(20);
  });

  it("validates session creation", () => {
    const parsed = createSessionSchema.parse({
      title: "Babymoon",
      length: "quick",
      filters: { only_unanswered: true },
    });
    expect(parsed.length).toBe("quick");
  });
});

describe("separate answer reveal logic", () => {
  it("hides until both saved when setting enabled", () => {
    expect(canRevealPartnerAnswers(true, true, false, false)).toBe(false);
    expect(canRevealPartnerAnswers(true, true, true, false)).toBe(true);
  });

  it("allows force reveal", () => {
    expect(canRevealPartnerAnswers(true, false, false, true)).toBe(true);
  });
});

describe("session filters", () => {
  const base = {
    why_it_matters: "x",
    discussion_guidance: "x",
    response_schema: {},
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    estimated_minutes: 5,
    emotional_weight: 3,
    evidence_needed: false,
    evidence_available: false,
    evidence_summary: null,
    practical_tip: null,
    cooling_off_recommended: false,
    follow_up_prompts: [],
    review_recommendation: null,
    child_dependent: false,
    required_before_birth: false,
    research_mode: "optional_background" as const,
    active: true,
    created_at: "",
    updated_at: "",
    separate_answers_recommended: false,
    babymoon_priority: false,
  };

  const questions: Question[] = [
    {
      ...base,
      id: "1",
      slug: "a",
      text: "Sleep goals?",
      short_title: "Sleep",
      question_type: "joint_discussion",
      life_stages: ["newborn_0_3"],
      categories: ["sleep"],
      logical_order: 10,
      priority: "essential_before_birth",
      babymoon_priority: true,
    },
    {
      ...base,
      id: "2",
      slug: "b",
      text: "Screens?",
      short_title: "Screens",
      question_type: "values_clarification",
      life_stages: ["preschool_3_5"],
      categories: ["technology"],
      logical_order: 20,
      priority: "medium",
    },
  ];

  it("filters unanswered high priority", () => {
    const result = filterQuestions(questions, new Set(["2"]), new Set(), {
      only_unanswered: true,
      include_high_priority: true,
    });
    expect(result.map((q) => q.id)).toEqual(["1"]);
  });
});
