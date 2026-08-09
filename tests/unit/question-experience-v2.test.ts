import { describe, expect, it } from "vitest";
import {
  formatAnswerPayload,
  answerToReadableSummary,
} from "@/lib/questions/answer-display";
import { parseResponseSchema, isStructuredMode } from "@/lib/questions/response-schema";
import { packQuestionsByMinutes } from "@/lib/questions/session-pack";
import { planEssentialsByMinutes } from "@/lib/essentials/session-plan";
import { filterAnswersForClient } from "@/lib/discussions/answer-privacy";
import type { Answer, Question } from "@/lib/types/models";
import { readFileSync } from "fs";
import path from "path";

describe("answer-display formatting", () => {
  it("formats ranking as numbered list", () => {
    const text = formatAnswerPayload(
      { ranking: ["Kindness", "Curiosity", "Resilience"], notes: "Revisit yearly" },
      { mode: "ranking", version: 2 },
    );
    expect(text).toContain("1. Kindness");
    expect(text).toContain("2. Curiosity");
    expect(text).toContain("Notes: Revisit yearly");
  });

  it("formats matrix as row: owner lines", () => {
    const text = formatAnswerPayload(
      {
        matrix: { Feeding: "Michelle", Diapers: "Sam", Soothing: "Both" },
        text: "Feeding: Michelle\nDiapers: Sam\nSoothing: Both",
      },
      { mode: "matrix", version: 2 },
    );
    expect(text).toContain("Feeding: Michelle");
    expect(text).toContain("Diapers: Sam");
    // Does not duplicate identical serialized text
    expect(text.split("Feeding: Michelle").length).toBe(2);
  });

  it("formats policy builder text", () => {
    const text = formatAnswerPayload(
      {
        text: "First week: Parents only\nNotice: 24 hours\nIllness: No visits",
      },
      { mode: "policy_builder", version: 2 },
    );
    expect(text).toContain("Notice: 24 hours");
  });

  it("formats scale and tradeoff", () => {
    expect(
      formatAnswerPayload(
        { scale: 4 },
        {
          mode: "scale",
          version: 2,
          scale_low_label: "Uncomfortable",
          scale_high_label: "Comfortable",
        },
      ),
    ).toContain("Scale: 4");
    expect(
      answerToReadableSummary(
        { choice: "Maintaining breastfeeding", text: "Unless stress is high" },
        { mode: "tradeoff", version: 2 },
      ),
    ).toContain("Chose: Maintaining breastfeeding");
  });
});

describe("response schema", () => {
  it("parses v2 modes and needs options for structured choice modes", () => {
    const schema = parseResponseSchema({
      mode: "multi_select",
      version: 2,
      options: ["A", "B"],
    });
    expect(schema.mode).toBe("multi_select");
    expect(isStructuredMode(schema.mode)).toBe(true);
  });
});

describe("session packing", () => {
  it("packs by estimated minutes and avoids leftover major items", () => {
    const qs = [
      { id: "a", estimated_minutes: 5 },
      { id: "b", estimated_minutes: 5 },
      { id: "c", estimated_minutes: 20 },
    ] as Question[];
    const packed = packQuestionsByMinutes(qs, 12);
    expect(packed.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("allows one major question to fill a short session", () => {
    const qs = [{ id: "major", estimated_minutes: 20 }] as Question[];
    expect(packQuestionsByMinutes(qs, 15).map((q) => q.id)).toEqual(["major"]);
  });
});

describe("essentials session plan", () => {
  it("packs screens by minutes", () => {
    const screens = [
      { id: "s1", question_id: "q1", response_type: "multi_select" },
      { id: "s2", question_id: "q2", response_type: "policy_builder" },
      { id: "s3", question_id: "q3", response_type: "open_with_prompts" },
    ] as never[];
    const plan = planEssentialsByMinutes(screens, 15);
    expect(plan.screens.length).toBeGreaterThan(0);
    expect(plan.aboutMinutes).toBeLessThanOrEqual(17);
  });
});

describe("structured answer privacy", () => {
  it("redacts structured partner payloads before reveal", () => {
    const answers: Answer[] = [
      {
        id: "a1",
        family_id: "f",
        question_id: "q1",
        member_id: "m_sam",
        is_shared: false,
        payload: {
          ranking: ["secret-partner-ranking"],
          matrix: { Feeding: "hidden" },
          choice: "hidden-choice",
          text: "hidden-text",
        },
        status: "in_discussion",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "",
        updated_at: "",
      },
    ];
    const result = filterAnswersForClient({
      answers,
      members: [
        {
          id: "m_sam",
          family_id: "f",
          user_id: "u_sam",
          display_name: "Sam",
          role: "parent",
          sort_order: 0,
          created_at: "",
        },
        {
          id: "m_michelle",
          family_id: "f",
          user_id: "u_michelle",
          display_name: "Michelle",
          role: "parent",
          sort_order: 1,
          created_at: "",
        },
      ],
      currentMemberId: "m_michelle",
      hideUntilBoth: true,
      separateEditorsVisible: true,
    });
    // Michelle has not saved yet — Sam's structured payload must stay redacted.
    expect(result.reveal).toBe(false);
    const partner = result.answers.find((a) => a.member_id === "m_sam");
    expect(partner).toBeTruthy();
    const blob = JSON.stringify(partner?.payload ?? {});
    expect(blob).not.toContain("secret-partner-ranking");
    expect(blob).not.toContain("hidden-choice");
    expect(blob).not.toContain("hidden-text");
    expect(blob).not.toContain("Feeding");
  });
});

describe("AnswerEditor form identity", () => {
  it("remounts with question id key to prevent stale notes", () => {
    const src = readFileSync(
      path.join(__dirname, "../../app/questions/[slug]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/key=\{question\.id\}/);
  });
});
