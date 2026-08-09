import { describe, expect, it } from "vitest";
import {
  previouslyAnsweredLabel,
  previewLibraryAnswerText,
  promptLinksAnsweredLibrary,
} from "@/lib/services/previously-answered";
import type { Answer } from "@/lib/types/models";

describe("previously-answered helpers", () => {
  it("labels fully and partially answered statuses", () => {
    expect(
      previouslyAnsweredLabel({
        questionId: "q1",
        primary: "shared_answer_saved",
        sam: "answered",
        michelle: "answered",
        sharedSaved: true,
        bothAnswered: true,
        undecided: false,
        needsReview: false,
        coolingOff: false,
        answerChanged: false,
        fullyAnswered: true,
        partiallyAnswered: false,
        skipByDefault: true,
      } as never),
    ).toBe("Previously answered");
    expect(
      previouslyAnsweredLabel({
        questionId: "q1",
        primary: "sam_answered",
        fullyAnswered: false,
        partiallyAnswered: true,
        skipByDefault: false,
      } as never),
    ).toBe("Partially answered before");
  });

  it("previews shared answer text", () => {
    const answers = [
      {
        is_shared: true,
        payload: { text: "We want a calm, loving home." },
      },
    ] as Answer[];
    expect(previewLibraryAnswerText(answers)).toBe(
      "We want a calm, loving home.",
    );
  });

  it("matches truncated library IDs for answered prompts", () => {
    const answered = new Set(["q_what_does_success_as_parents_mean_to_us"]);
    expect(
      promptLinksAnsweredLibrary(
        answered,
        "q_what_does_success_as_parents_mean",
      ),
    ).toBe(true);
    expect(promptLinksAnsweredLibrary(answered, "q_unrelated")).toBe(false);
  });
});
