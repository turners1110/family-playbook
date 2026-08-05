import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  classifyDiscussionMode,
  discussionModeIcon,
  essentialsShowSeparateEditors,
  resolveDiscussionMode,
  shouldShowSeparateEditors,
  summarizeClassification,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { filterAnswersForClient } from "@/lib/discussions/answer-privacy";
import { buildDiscussionModeHomeStats } from "@/lib/discussions/discussion-stats";
import { canRevealPartnerAnswers } from "@/lib/services/answers";
import type { Answer, AppStore, Question } from "@/lib/types/models";
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

describe("resolveDiscussionMode canonical contract", () => {
  it("defaults to shared_first when metadata is missing", () => {
    const r = resolveDiscussionMode({});
    expect(r.mode).toBe("shared_first");
    expect(r.source).toBe("fallback");
  });

  it("never uses separate_answers_recommended alone to force separate", () => {
    const r = resolveDiscussionMode({
      question: baseQuestion({
        id: "q1",
        slug: "x",
        text: "What is our visitor plan for the first weeks?",
        short_title: "Visitors",
        separate_answers_recommended: true,
        discussion_mode: null,
        categories: ["extended_family"],
      }),
      preferExistingSeparate: false,
    });
    expect(r.mode).toBe("shared_first");
  });

  it("uses stored discussion_mode when present", () => {
    const r = resolveDiscussionMode({
      question: baseQuestion({
        id: "q1",
        slug: "x",
        text: "What are your birth fears?",
        short_title: "Birth fears",
        discussion_mode: "separate_first",
        categories: ["pregnancy"],
      }),
    });
    expect(r.mode).toBe("separate_first");
    expect(r.source).toBe("stored");
  });

  it("either defaults to shared UI unless user chooses separate", () => {
    expect(
      shouldShowSeparateEditors({
        resolvedMode: "either",
        userChoseSeparate: false,
      }),
    ).toBe(false);
    expect(
      shouldShowSeparateEditors({
        resolvedMode: "either",
        userChoseSeparate: true,
      }),
    ).toBe(true);
  });

  it("shows separate when existing separate answers need review", () => {
    expect(
      shouldShowSeparateEditors({
        resolvedMode: "shared_first",
        hasSeparateAnswers: true,
      }),
    ).toBe(true);
  });
});

describe("discussion mode classification", () => {
  it("classifies the full seed within shared-first bands", () => {
    const modes = (seedQuestions as Array<{
      id: string;
      slug: string;
      short_title: string;
      text: string;
      categories: string[];
      why_it_matters?: string;
      discussion_mode?: DiscussionMode;
    }>).map((q) => {
      expect(q.discussion_mode).toBeTruthy();
      return classifyDiscussionMode(q).discussion_mode;
    });
    const stats = summarizeClassification(modes);
    expect(stats.total).toBe(430);
    expect(stats.shared_first_pct).toBeGreaterThanOrEqual(70);
    expect(stats.separate_first_pct).toBeLessThanOrEqual(25);
    expect(stats.either_pct).toBeLessThan(5);
  });

  it("keeps visitors shared-first and childhood separate-first", () => {
    const visitors = seedQuestions.find((q) =>
      /visitor/i.test(q.short_title) || /visitor/i.test(q.text),
    );
    const childhood = seedQuestions.find((q) =>
      /childhood/i.test(q.short_title),
    );
    expect(visitors).toBeTruthy();
    expect(classifyDiscussionMode(visitors! as never).discussion_mode).toBe(
      "shared_first",
    );
    if (childhood) {
      expect(classifyDiscussionMode(childhood as never).discussion_mode).toBe(
        "separate_first",
      );
    }
  });
});

describe("privacy and essentials", () => {
  it("preserves partner reveal rules", () => {
    expect(canRevealPartnerAnswers(true, true, false, false)).toBe(false);
    expect(canRevealPartnerAnswers(true, true, true, false)).toBe(true);
  });

  it("redacts partner payloads server-side before client", () => {
    const members = [
      {
        id: "m_sam",
        family_id: "f",
        user_id: "u_sam",
        display_name: "Sam",
        role: "parent" as const,
        sort_order: 1,
        created_at: "",
      },
      {
        id: "m_michelle",
        family_id: "f",
        user_id: "u_michelle",
        display_name: "Michelle",
        role: "parent" as const,
        sort_order: 2,
        created_at: "",
      },
    ];
    const answers: Answer[] = [
      {
        id: "a_sam",
        family_id: "f",
        question_id: "q1",
        member_id: "m_sam",
        is_shared: false,
        payload: { text: "Sam secret" },
        status: "in_discussion",
        confidence: null,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "",
        updated_at: "",
      },
    ];
    const filtered = filterAnswersForClient({
      answers,
      members,
      hideUntilBoth: true,
      currentMemberId: "m_michelle",
      separateEditorsVisible: true,
    });
    expect(filtered.reveal).toBe(false);
    expect(filtered.answers[0]?.payload.text).toBeUndefined();
    expect(filtered.hiddenPartnerIds).toContain("a_sam");
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
  });
});

describe("home discussion metrics", () => {
  it("counts shared-first completions", () => {
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
        slug: "childhood",
        text: "What parts of childhood do we hope to repeat?",
        short_title: "Childhood",
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
  });
});

describe("surface contracts", () => {
  it("Conversations card supports shared-first rendering", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/conversations/ConversationCard.tsx"),
      "utf8",
    );
    expect(src).toContain("Shared family answer");
    expect(src).toContain("Capture separate perspectives");
    expect(src).toContain("buildActorWrite(\"shared\")");
    expect(src).toContain("shouldShowSeparateEditors");
  });

  it("AnswerEditor uses resolveDiscussionMode", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/questions/AnswerEditor.tsx"),
      "utf8",
    );
    expect(src).toContain("resolveDiscussionMode");
    expect(src).toContain("Shared family decision");
  });

  it("icons exist", () => {
    expect(discussionModeIcon("shared_first").symbol).toBeTruthy();
    expect(discussionModeIcon("separate_first").symbol).toBeTruthy();
  });
});
