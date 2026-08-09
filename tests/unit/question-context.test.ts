import { describe, expect, it } from "vitest";
import {
  GENERIC_CONTEXT_MARKERS,
  hasRenderableContext,
  isSpecificContextText,
  specificOrNull,
} from "@/lib/content/question-context";
import {
  sharedContextFromConversationPrompt,
  sharedContextFromLibraryQuestion,
} from "@/lib/content/resolve-question-context";
import type { ConversationPromptDef } from "@/lib/conversations/response-types";
import type { Question } from "@/lib/types/models";

function fakeQuestion(partial: Partial<Question> & Pick<Question, "id" | "text">): Question {
  return {
    slug: partial.slug ?? partial.id,
    short_title: partial.short_title ?? partial.text.slice(0, 40),
    why_it_matters:
      partial.why_it_matters ??
      "This choice shapes daily family life and the adult your child becomes. Discussing it early reduces stress when the moment arrives.",
    discussion_guidance:
      partial.discussion_guidance ??
      "Listen first, then look for the shared principle underneath the preference.",
    question_type: "values_clarification",
    response_schema: {},
    life_stages: ["pregnancy"],
    categories: ["values"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 1,
    priority: "medium",
    babymoon_priority: false,
    required_before_birth: false,
    estimated_minutes: 8,
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

describe("question context specificity", () => {
  it("rejects generic seed copy", () => {
    for (const marker of GENERIC_CONTEXT_MARKERS.slice(0, 3)) {
      expect(isSpecificContextText(`${marker} extra words here`)).toBe(false);
    }
    expect(
      specificOrNull(
        "Your definition of success becomes the filter for later tradeoffs.",
      ),
    ).toBeTruthy();
  });

  it("omits filler purpose for generic library questions", () => {
    const ctx = sharedContextFromLibraryQuestion(
      fakeQuestion({
        id: "q_generic_library_item",
        text: "A generic library question?",
      }),
    );
    expect(ctx.purpose).toBeNull();
    expect(ctx.howTo).toBeNull();
    expect(ctx.estimatedMinutes).toBe(8);
  });

  it("pulls Essentials enrichment into conversation prompts when linked", () => {
    const prompt = {
      id: "qp_test",
      version: 1,
      prompt: "What does success look like?",
      response_type: "short_text",
      answer_options: [],
      allow_multiple: false,
      allow_custom_answer: true,
      estimated_time_seconds: 180,
      suggested_discussion_minutes: 10,
      short_text_max_length: 280,
      follow_up_open_question_id: "q_what_does_success_as_parents_mean_to_us",
      conversation_energy: "coffee",
      conversation_tags: ["identity"],
      session_tags: ["babymoon"],
      category: "identity",
      topic: "identity",
      life_stage: "pregnancy",
      separate_answers_recommended: false,
      shared_answer_supported: true,
      difference_capture: false,
      companion_prompt_id: null,
      trip_friendly: true,
      optional: false,
      requires_deep_follow_up: false,
      active: true,
    } as unknown as ConversationPromptDef;

    const ctx = sharedContextFromConversationPrompt(prompt, {
      babymoonRound: 1,
      sessionMode: "babymoon",
    });
    expect(ctx.explanation).toBeTruthy();
    expect(ctx.examples?.length).toBeGreaterThanOrEqual(2);
    expect(ctx.whySeeingThis).toMatch(/Babymoon/i);
    expect(
      ctx.recommendations?.some((r) => r.kind === "recommended_first"),
    ).toBe(true);
    expect(hasRenderableContext(ctx)).toBe(true);
  });
});
