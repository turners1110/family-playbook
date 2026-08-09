import { describe, expect, it } from "vitest";
import {
  CONVERSATION_RESPONSE_TYPES,
  validateEitherOrOptions,
  validateQuickPickOptions,
} from "@/lib/conversations/response-types";
import {
  countQuickToDeepLinks,
  getActiveQuickPrompts,
  getQuickPrompt,
} from "@/lib/conversations/quick-prompts";
import {
  BABYMOON_ROUNDS,
  BABYMOON_SET_TAG,
  estimateRoundSeconds,
  getBabymoonRoundPrompts,
} from "@/lib/conversations/babymoon-set";
import { CONVERSATION_MODES } from "@/lib/conversations/modes";
import {
  buildConversationSession,
  describeEnergyMix,
} from "@/lib/conversations/session-builder";
import { suggestMomentum } from "@/lib/conversations/momentum";
import {
  IDLE_CUTOFF_MS,
  measureActiveSeconds,
  shouldPauseForIdle,
} from "@/lib/conversations/timing";
import { ensureConversationQuestionOptions } from "@/lib/conversations/ensure-options";
import { ESSENTIALS_COMPANIONS } from "@/lib/conversations/companions";
import type { AppStore } from "@/lib/types/models";

describe("conversation response types", () => {
  it("includes required new response types", () => {
    expect(CONVERSATION_RESPONSE_TYPES).toEqual(
      expect.arrayContaining([
        "quick_pick",
        "either_or",
        "short_text",
        "open_time_boxed",
        "reaction_scale",
      ]),
    );
  });

  it("validates either_or and quick_pick option shapes", () => {
    expect(
      validateEitherOrOptions([
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "undecided", label: "Undecided" },
      ]),
    ).toBe(true);
    expect(
      validateQuickPickOptions([
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]),
    ).toBe(true);
  });

  it("renders curated prompts for each new type", () => {
    const prompts = getActiveQuickPrompts();
    for (const type of [
      "quick_pick",
      "either_or",
      "short_text",
      "reaction_scale",
    ] as const) {
      expect(prompts.some((p) => p.response_type === type)).toBe(true);
    }
  });

  it("requires populated options for choice types", () => {
    for (const p of getActiveQuickPrompts()) {
      if (p.response_type === "quick_pick" || p.response_type === "either_or") {
        expect(p.answer_options.length).toBeGreaterThanOrEqual(2);
      }
      if (p.response_type === "either_or") {
        expect(validateEitherOrOptions(p.answer_options)).toBe(true);
      }
      if (p.response_type === "quick_pick") {
        expect(validateQuickPickOptions(p.answer_options)).toBe(true);
      }
      if (p.response_type === "reaction_scale") {
        expect(p.scale_low_label).toBeTruthy();
        expect(p.scale_high_label).toBeTruthy();
      }
    }
  });
});

describe("babymoon set v1", () => {
  it("exists with three stable rounds", () => {
    expect(BABYMOON_SET_TAG).toBe("babymoon_set_v1");
    expect(BABYMOON_ROUNDS).toHaveLength(3);
    expect(BABYMOON_ROUNDS.map((r) => r.round)).toEqual([1, 2, 3]);
  });

  it("contains expected items and reasonable duration", () => {
    const r1 = getBabymoonRoundPrompts(1);
    expect(r1.map((p) => p.id)).toEqual([
      "qp_parent_word",
      "qp_holiday_size",
      "qp_family_food",
      "qp_bm_success_deep",
      "qp_bm_rose_thorn",
      "qp_baby_face_online",
    ]);
    const r3 = getBabymoonRoundPrompts(3);
    expect(r3.at(-1)?.is_trip_memory).toBe(true);
    for (const round of [1, 2, 3] as const) {
      const secs = estimateRoundSeconds(round);
      expect(secs).toBeGreaterThan(5 * 60);
      expect(secs).toBeLessThan(25 * 60);
    }
  });
});

describe("conversation modes and session builder", () => {
  it("defines all modes", () => {
    expect(CONVERSATION_MODES.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "babymoon",
        "date_night",
        "morning_coffee",
        "airport",
        "deep_dive",
        "first_month",
        "random_mix",
      ]),
    );
  });

  it("builds a persistent babymoon round without reshuffle", () => {
    const a = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      babymoonRound: 1,
    });
    const b = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      babymoonRound: 1,
    });
    expect(a.map((i) => i.prompt_id)).toEqual(b.map((i) => i.prompt_id));
  });

  it("respects session length via estimated time", () => {
    const short = buildConversationSession({
      mode: "airport",
      plannedMinutes: 5,
      avoidRecentlyAnswered: false,
    });
    const long = buildConversationSession({
      mode: "deep_dive",
      plannedMinutes: 60,
      avoidRecentlyAnswered: false,
    });
    const shortSecs = short.reduce((s, i) => s + i.estimated_time_seconds, 0);
    const longSecs = long.reduce((s, i) => s + i.estimated_time_seconds, 0);
    expect(shortSecs).toBeLessThanOrEqual(8 * 60);
    expect(longSecs).toBeGreaterThan(shortSecs);
  });

  it("avoids clustering heavy questions", () => {
    const items = buildConversationSession({
      mode: "date_night",
      plannedMinutes: 45,
      avoidRecentlyAnswered: false,
    });
    for (let i = 1; i < items.length; i++) {
      if (items[i]!.energy === "deep" && items[i - 1]!.energy === "deep") {
        throw new Error("clustered deep questions");
      }
    }
    expect(describeEnergyMix(items)).toMatch(/Lightning|Coffee|About/);
  });

  it("keeps teen/future money topics out of babymoon mode", () => {
    const items = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 30,
      avoidRecentlyAnswered: false,
    });
    for (const item of items) {
      const p = getQuickPrompt(item.prompt_id);
      if (!p) continue;
      expect(p.life_stage).not.toBe("teen");
    }
  });

  it("skips prompts whose linked library question is already answered", () => {
    const answeredId = "q_what_does_success_as_parents_mean_to_us";
    const full = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      babymoonRound: 1,
      includeUnansweredOnly: false,
    });
    const filtered = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      babymoonRound: 1,
      includeUnansweredOnly: true,
      answeredLibraryQuestionIds: [answeredId],
    });
    expect(full.some((i) => i.source_question_id === answeredId)).toBe(true);
    expect(filtered.every((i) => i.source_question_id !== answeredId)).toBe(
      true,
    );
    // Truncated remote IDs still match
    const filteredShort = buildConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      babymoonRound: 1,
      answeredLibraryQuestionIds: [answeredId.slice(0, 28)],
    });
    expect(
      filteredShort.every((i) => i.source_question_id !== answeredId),
    ).toBe(true);
  });
});

describe("momentum and timing", () => {
  it("suggests related tagged prompts and excludes answered", () => {
    const current = getQuickPrompt("qp_first_week_home")!;
    const suggestions = suggestMomentum({
      current,
      mode: "babymoon",
      answeredIds: ["qp_visitor_notice"],
      remainingSeconds: 600,
      sessionPromptIds: ["qp_first_week_home"],
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.prompt_id !== "qp_visitor_notice")).toBe(
      true,
    );
  });

  it("caps active time at idle cutoff", () => {
    const opened = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const answered = new Date().toISOString();
    const secs = measureActiveSeconds({ openedAt: opened, answeredAt: answered });
    expect(secs).toBeLessThanOrEqual(IDLE_CUTOFF_MS / 1000);
    expect(
      shouldPauseForIdle(new Date(Date.now() - IDLE_CUTOFF_MS - 1000).toISOString()),
    ).toBe(true);
  });
});

describe("quick prompts and companions", () => {
  it("has at least 30 curated prompts and 10 deep links", () => {
    expect(getActiveQuickPrompts().length).toBeGreaterThanOrEqual(30);
    expect(countQuickToDeepLinks()).toBeGreaterThanOrEqual(10);
  });

  it("includes essentials companions", () => {
    expect(ESSENTIALS_COMPANIONS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("empty option fixes", () => {
  it("backfills traits and allowance options without deleting answers", () => {
    const store = {
      questions: [
        {
          id: "q_what_traits_do_we_most_hope_our_child_develops",
          question_type: "joint_discussion",
          response_schema: { mode: "open_or_policy" },
        },
        {
          id: "q_which_five_adult_traits_matter_most_to_us",
          question_type: "joint_discussion",
          response_schema: { mode: "open_or_policy" },
        },
        {
          id: "q_should_allowance_be_tied_to_chores",
          question_type: "joint_discussion",
          response_schema: { mode: "open_or_policy" },
        },
      ],
      question_options: [],
      answers: [
        {
          id: "a1",
          question_id: "q_should_allowance_be_tied_to_chores",
          payload: { text: "Prior open answer" },
        },
      ],
    } as unknown as AppStore;

    const first = ensureConversationQuestionOptions(store);
    expect(first.added).toBeGreaterThan(0);
    const second = ensureConversationQuestionOptions(store);
    expect(second.added).toBe(0);
    expect(store.answers[0]!.payload.text).toBe("Prior open answer");
    expect(
      store.question_options.filter(
        (o) => o.question_id === "q_what_traits_do_we_most_hope_our_child_develops",
      ).length,
    ).toBe(14);
  });
});
