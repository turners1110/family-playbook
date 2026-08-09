import { describe, expect, it } from "vitest";
import { getLibraryQuestionEnrichment } from "@/lib/content/library-question-context";
import { sharedContextFromLibraryQuestion } from "@/lib/content/resolve-question-context";
import type { Question } from "@/lib/types/models";

describe("library question context expansion", () => {
  it("provides specific enrichment for allowance and discipline questions", () => {
    const allowance = getLibraryQuestionEnrichment(
      "q_should_our_child_receive_an_allowance",
    );
    expect(allowance?.purpose).toMatch(/allowance/i);
    expect(allowance?.examples.length).toBeGreaterThanOrEqual(2);
    expect(allowance?.prompts.length).toBeGreaterThan(0);

    const discipline = getLibraryQuestionEnrichment(
      "q_what_is_the_purpose_of_discipline_in_our_family",
    );
    expect(discipline?.explanation).toMatch(/discipline|punishment|teaching/i);
  });

  it("surfaces enrichment through shared library context resolver", () => {
    const question = {
      id: "q_should_allowance_be_tied_to_chores",
      slug: "allowance-chores",
      text: "Should allowance be tied to chores?",
      short_title: "Allowance and chores",
      why_it_matters:
        "This choice shapes daily family life and the adult your child becomes.",
      discussion_guidance:
        "Listen first, then look for the shared principle underneath the preference.",
      priority: "medium",
      babymoon_priority: false,
      estimated_minutes: 8,
      follow_up_prompts: [],
      evidence_summary: null,
      practical_tip: null,
      categories: ["money"],
    } as unknown as Question;

    const ctx = sharedContextFromLibraryQuestion(question);
    expect(ctx.purpose).toBeTruthy();
    expect(ctx.explanation).toBeTruthy();
    expect(ctx.examples?.length).toBeGreaterThanOrEqual(2);
    expect(ctx.purpose).not.toMatch(/shapes daily family life/);
  });
});
