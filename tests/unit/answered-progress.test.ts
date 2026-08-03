import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  buildFamilyProgressMetrics,
  conversationItemIsComplete,
  isDeepQuestionAnswered,
  quickCompanionCompletesDeepQuestion,
} from "@/lib/services/answered-status";
import { resolveLibraryQuestionId } from "@/lib/conversations/deep-link";
import type { AppStore } from "@/lib/types/models";

const root = path.resolve(__dirname, "../..");

function emptyStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    family: {
      id: "family_t",
      name: "Turner Family",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    members: [
      {
        id: "member_sam",
        family_id: "family_t",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "member_michelle",
        family_id: "family_t",
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    users: [],
    questions: [
      {
        id: "q_deep_one",
        slug: "deep-one",
        short_title: "Deep one",
        text: "Deep?",
        why_it_matters: "x",
        discussion_guidance: "x",
        active: true,
        priority: "high",
        life_stages: [],
        categories: [],
        outcomes: [],
        required_before_birth: false,
        babymoon_priority: false,
        research_mode: "none",
        answer_type: "open",
        options: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      } as never,
      {
        id: "q_deep_two",
        slug: "deep-two",
        short_title: "Deep two",
        text: "Deep two?",
        why_it_matters: "x",
        discussion_guidance: "x",
        active: true,
        priority: "high",
        life_stages: [],
        categories: [],
        outcomes: [],
        required_before_birth: false,
        babymoon_priority: false,
        research_mode: "none",
        answer_type: "open",
        options: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      } as never,
      {
        id: "qa_test_skip",
        slug: "qa-skip",
        short_title: "QA",
        text: "QA",
        why_it_matters: "x",
        discussion_guidance: "x",
        active: true,
        priority: "low",
        life_stages: [],
        categories: [],
        outcomes: [],
        required_before_birth: false,
        babymoon_priority: false,
        research_mode: "none",
        answer_type: "open",
        options: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      } as never,
    ],
    answers: [],
    decisions: [],
    outcomes: [],
    principles: [],
    knowledge_items: [],
    categories: [],
    life_stages: [],
    sessions: [],
    cooling_off_items: [],
    reviews: [],
    activity_log: [],
    settings: {} as never,
    checklist_instances: [],
    checklist_tasks: [],
    conversation_sessions: [
      {
        id: "csess_1",
        family_id: "family_t",
        mode: "babymoon",
        status: "completed",
        title: "Babymoon",
        planned_minutes: 30,
        current_item_index: 0,
        created_by: "user",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        is_test_data: false,
      } as never,
    ],
    conversation_session_items: [
      {
        id: "item_1",
        session_id: "csess_1",
        prompt_id: "qp_a",
        display_order: 0,
        status: "answered_same",
        energy: "light",
      } as never,
      {
        id: "item_2",
        session_id: "csess_1",
        prompt_id: "qp_b",
        display_order: 1,
        status: "answered_different",
        energy: "light",
      } as never,
    ],
    conversation_quick_answers: [
      {
        id: "qa1",
        session_id: "csess_1",
        session_item_id: "item_1",
        prompt_id: "qp_a",
        actor: "sam",
        selected_options: ["yes"],
        is_test_data: false,
        updated_at: "2026-01-01T00:00:00.000Z",
      } as never,
      {
        id: "qa2",
        session_id: "csess_1",
        session_item_id: "item_1",
        prompt_id: "qp_a",
        actor: "michelle",
        selected_options: ["yes"],
        is_test_data: false,
        updated_at: "2026-01-01T00:00:00.000Z",
      } as never,
    ],
    conversation_differences: [],
    ...overrides,
  } as AppStore;
}

describe("family progress metric contract", () => {
  it("quick picks raise conversation count but not deep/canonical count", () => {
    const store = emptyStore();
    const metrics = buildFamilyProgressMetrics(store);
    expect(metrics.conversationPromptsCompleted).toBe(2);
    expect(metrics.conversationQuickAnswers).toBe(2);
    expect(metrics.canonicalQuestionsAnswered).toBe(0);
    expect(quickCompanionCompletesDeepQuestion()).toBe(false);
    expect(isDeepQuestionAnswered(store, "q_deep_one")).toBe(false);
  });

  it("deep shared answer raises canonical count", () => {
    const store = emptyStore({
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q_deep_one",
          member_id: null,
          is_shared: true,
          payload: { text: "We agree" },
          status: "tentatively_decided",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as never);
    const metrics = buildFamilyProgressMetrics(store);
    expect(metrics.canonicalQuestionsAnswered).toBe(1);
    expect(isDeepQuestionAnswered(store, "q_deep_one")).toBe(true);
  });

  it("Sam-only is partial, not fully answered", () => {
    const store = emptyStore({
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q_deep_two",
          member_id: "member_sam",
          is_shared: false,
          payload: { text: "Sam only" },
          status: "in_discussion",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as never);
    const metrics = buildFamilyProgressMetrics(store);
    expect(metrics.canonicalQuestionsAnswered).toBe(0);
    expect(metrics.canonicalQuestionsPartial).toBe(1);
    expect(metrics.legacyUniqueAnsweredQuestionIds).toBe(1);
  });

  it("both separate answers count as fully answered", () => {
    const store = emptyStore({
      answers: [
        {
          id: "a1",
          family_id: "family_t",
          question_id: "q_deep_two",
          member_id: "member_sam",
          is_shared: false,
          payload: { text: "Sam" },
          status: "in_discussion",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "a2",
          family_id: "family_t",
          question_id: "q_deep_two",
          member_id: "member_michelle",
          is_shared: false,
          payload: { text: "Michelle" },
          status: "in_discussion",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as never);
    const metrics = buildFamilyProgressMetrics(store);
    expect(metrics.canonicalQuestionsAnswered).toBe(1);
    expect(metrics.canonicalQuestionsPartial).toBe(0);
  });

  it("QA records are excluded from conversation totals", () => {
    const base = emptyStore();
    const store = emptyStore({
      conversation_sessions: [
        ...(base.conversation_sessions ?? []),
        {
          id: "csess_qa",
          family_id: "family_t",
          is_test_data: true,
          test_run_id: "run_1",
          status: "completed",
          mode: "qa_integrity",
          title: "QA",
          planned_minutes: 10,
          current_item_index: 0,
          created_by: "qa",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        } as never,
      ],
      conversation_session_items: [
        ...(base.conversation_session_items ?? []),
        {
          id: "item_qa",
          session_id: "csess_qa",
          prompt_id: "qp_qa",
          status: "answered_same",
          display_order: 0,
          energy: "light",
        } as never,
      ],
      conversation_quick_answers: [
        ...(base.conversation_quick_answers ?? []),
        {
          id: "qaq",
          session_id: "csess_qa",
          session_item_id: "item_qa",
          prompt_id: "qp_qa",
          is_test_data: true,
          test_run_id: "run_1",
          actor: "sam",
          selected_options: [],
          updated_at: "2026-01-01T00:00:00.000Z",
        } as never,
      ],
    } as never);
    const metrics = buildFamilyProgressMetrics(store);
    expect(metrics.conversationPromptsCompleted).toBe(2);
    expect(metrics.conversationQuickAnswers).toBe(2);
    expect(conversationItemIsComplete("undecided")).toBe(true);
    expect(conversationItemIsComplete("discuss_later")).toBe(true);
  });

  it("homepage uses multi-metric progress helpers", () => {
    const home = readFileSync(path.join(root, "app/home/page.tsx"), "utf8");
    expect(home).toMatch(/Deep discussions answered/);
    expect(home).toMatch(/Conversation prompts completed/);
    expect(home).toMatch(/Essentials screens/);
    expect(home).toMatch(/stats\.progress\.canonicalQuestionsAnswered/);
  });
});

describe("deep link library ID resolution", () => {
  it("resolves truncated bank IDs from longer prompt follow-ups", () => {
    const questions = [
      { id: "q_how_do_we_want_to_handle_photos_and_social_media_after_bi", slug: "photos" },
    ];
    expect(
      resolveLibraryQuestionId(
        "q_how_do_we_want_to_handle_photos_and_social_media_after_birth",
        questions,
      ),
    ).toBe("q_how_do_we_want_to_handle_photos_and_social_media_after_bi");
  });
});
