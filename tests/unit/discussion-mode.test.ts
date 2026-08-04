import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  classifyDiscussionMode,
  discussionModeIcon,
  essentialsShowSeparateEditors,
  resolveEffectiveDiscussionMode,
  summarizeClassification,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { buildDiscussionModeHomeStats } from "@/lib/discussions/discussion-stats";
import { canRevealPartnerAnswers } from "@/lib/services/answers";
import type { AppStore, Question } from "@/lib/types/models";
import seedQuestions from "@/data/seed/questions.json";

function baseQuestion(
  overrides: Partial<Question> & Pick<Question, "id" | "slug" | "text" | "short_title">,
): Question {
  return {
    why_it_matters: "Why",
    discussion_guidance: "Talk",
    question_type: "open_response",
    response_schema: {},
    life_stages: ["pregnancy"],
    categories: ["newborn_care"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 1,
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
    required_before_birth: true,
    babymoon_priority: true,
    research_mode: "optional_background",
    active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("discussion mode classification", () => {
  it("classifies the full seed within target bands", () => {
    const modes = (seedQuestions as Array<{
      id: string;
      slug: string;
      short_title: string;
      text: string;
      categories: string[];
      why_it_matters?: string;
      separate_answers_recommended?: boolean;
      discussion_mode?: DiscussionMode;
    }>).map((q) => {
      expect(q.discussion_mode).toBeTruthy();
      return classifyDiscussionMode(q).discussion_mode;
    });
    const stats = summarizeClassification(modes);
    expect(stats.total).toBe(430);
    expect(stats.shared_first_pct).toBeGreaterThanOrEqual(70);
    expect(stats.shared_first_pct).toBeLessThanOrEqual(85);
    expect(stats.separate_first_pct).toBeGreaterThanOrEqual(15);
    expect(stats.separate_first_pct).toBeLessThanOrEqual(25);
    expect(stats.either_pct).toBeLessThan(5);
  });

  it("keeps visitors shared-first and birth fears separate-first", () => {
    const visitors = seedQuestions.find((q) =>
      /visitor/i.test(q.short_title) || /visitor/i.test(q.text),
    );
    const fears = seedQuestions.find((q) =>
      /birth fear/i.test(q.short_title) || /birth fear/i.test(q.text),
    );
    expect(visitors).toBeTruthy();
    expect(classifyDiscussionMode(visitors!).discussion_mode).toBe(
      "shared_first",
    );
    if (fears) {
      expect(classifyDiscussionMode(fears).discussion_mode).toBe(
        "separate_first",
      );
    }
  });

  it("resolves effective mode with existing separate answers", () => {
    expect(
      resolveEffectiveDiscussionMode({
        discussion_mode: "shared_first",
        hasSeparateAnswers: true,
      }),
    ).toBe("shared_first");
    expect(
      resolveEffectiveDiscussionMode({
        separate_answers_recommended: true,
      }),
    ).toBe("separate_first");
  });

  it("exposes icons without requiring text labels in lists", () => {
    expect(discussionModeIcon("shared_first").symbol).toBeTruthy();
    expect(discussionModeIcon("separate_first").symbol).toBeTruthy();
    expect(discussionModeIcon("either").symbol).toBeTruthy();
  });
});

describe("shared-first privacy and essentials", () => {
  it("preserves partner reveal rules for separate answers", () => {
    expect(canRevealPartnerAnswers(true, true, false, false)).toBe(false);
    expect(canRevealPartnerAnswers(true, true, true, false)).toBe(true);
    expect(canRevealPartnerAnswers(false, true, false, false)).toBe(true);
  });

  it("hides essentials separate editors for shared-first planning", () => {
    const q = baseQuestion({
      id: "q1",
      slug: "visitors",
      text: "Who may visit in the first two weeks?",
      short_title: "Visitors",
      discussion_mode: "shared_first",
      categories: ["extended_family"],
    });
    expect(
      essentialsShowSeparateEditors(
        { separate_answers: true, response_type: "multi_select" },
        q,
      ),
    ).toBe(false);
    expect(
      essentialsShowSeparateEditors(
        { response_type: "separate_then_shared" },
        { ...q, discussion_mode: "separate_first" },
      ),
    ).toBe(true);
    expect(
      essentialsShowSeparateEditors(
        { response_type: "paired_text" },
        q,
      ),
    ).toBe(true);
  });
});

describe("home discussion metrics", () => {
  it("counts shared-first completions and separate remaining", () => {
    const questions = [
      baseQuestion({
        id: "q_shared",
        slug: "visitors",
        text: "Who may visit after birth?",
        short_title: "Visitors",
        discussion_mode: "shared_first",
        categories: ["extended_family"],
      }),
      baseQuestion({
        id: "q_sep",
        slug: "fears",
        text: "What are your biggest birth fears?",
        short_title: "Birth fears",
        discussion_mode: "separate_first",
        separate_answers_recommended: true,
        categories: ["core_values"],
      }),
    ];
    const store = {
      questions,
      answers: [
        {
          id: "a1",
          family_id: "f",
          question_id: "q_shared",
          member_id: null,
          is_shared: true,
          payload: { text: "Immediate family only" },
          status: "decided",
          confidence: 4,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "",
          updated_at: "",
        },
      ],
      members: [],
    } as unknown as AppStore;

    const stats = buildDiscussionModeHomeStats(store);
    expect(stats.sharedFirstCompleted).toBe(1);
    expect(stats.separateReflectionRemaining).toBe(1);
    expect(stats.sharedDecisionsCompleted).toBe(1);
  });
});

describe("AnswerEditor shared-first source contract", () => {
  it("defaults to shared family decision without Sam/Michelle editors", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/questions/AnswerEditor.tsx"),
      "utf8",
    );
    expect(src).toContain("Shared family decision");
    expect(src).toContain("Capture separate perspectives");
    expect(src).toContain("Did this discussion uncover meaningful differences?");
    expect(src).toContain("Merge into family decision");
    expect(src).toContain("resolveEffectiveDiscussionMode");
  });

  it("QuestionInterview defaults from discussion_mode", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/discuss/QuestionInterview.tsx"),
      "utf8",
    );
    expect(src).toContain("resolveEffectiveDiscussionMode");
    expect(src).toContain('discussionMode === "separate_first" ? "separate"');
  });

  it("Decision page hides empty separate perspectives", () => {
    const src = readFileSync(
      path.join(process.cwd(), "app/decisions/[id]/page.tsx"),
      "utf8",
    );
    expect(src).toContain("decision?.sam_perspective || decision?.michelle_perspective");
    expect(src).toContain("Started together");
  });
});
