import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import type {
  AppStore,
  ConversationSession,
  ConversationSessionItem,
  ConversationQuickAnswer,
} from "@/lib/types/models";
import {
  buildAnswerPreview,
  buildConversationReview,
  exportConversationReviewMarkdown,
  filterConversationPromptRows,
  isSessionIncomplete,
  listConversationPromptReviewRows,
  sessionPrimaryHref,
} from "@/lib/services/conversation-review";

const root = path.resolve(__dirname, "../..");
const ts = "2026-08-03T16:05:33.007Z";

function store(overrides: Partial<AppStore> = {}): AppStore {
  return {
    family: {
      id: "family_t",
      name: "Turner Family",
      created_at: ts,
      updated_at: ts,
    },
    members: [],
    users: [],
    questions: [
      {
        id: "q_success",
        slug: "success-as-parents",
        short_title: "Success as parents",
        text: "What does success mean?",
        why_it_matters: "x",
        discussion_guidance: "x",
        question_type: "values",
        response_schema: {},
        life_stages: [],
        categories: ["identity"],
        subcategories: [],
        outcomes: [],
        related_principles: [],
        related_questions: [],
        parent_decision_dependency: null,
        logical_order: 1,
        priority: "high",
        estimated_minutes: 10,
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
        created_at: ts,
        updated_at: ts,
      },
    ],
    question_options: [],
    answers: [],
    answer_versions: [],
    decisions: [],
    decision_versions: [],
    sessions: [],
    session_items: [],
    disagreements: [],
    cooling_off_items: [],
    review_items: [],
    bookmarks: [],
    principles: [],
    outcomes: [],
    research_notes: [],
    research_sources: [],
    research_findings: [],
    research_links: [],
    research_preferences: { hidden: [], added: {} },
    playbook_exports: [],
    settings: {
      family_id: "family_t",
      hide_partner_answers_until_both_saved: false,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 3,
      include_perspective_history_in_playbook: false,
      updated_at: ts,
    },
    demo_mode: false,
    checklists: [],
    checklist_tasks: [],
    checklist_milestones: [],
    conversation_sessions: [],
    conversation_session_items: [],
    conversation_quick_answers: [],
    conversation_differences: [],
    ...overrides,
  } as AppStore;
}

function session(partial: Partial<ConversationSession>): ConversationSession {
  return {
    id: "csess_1",
    family_id: "family_t",
    mode: "babymoon",
    title: "Babymoon · Warm-up and Family Identity",
    planned_minutes: 15,
    status: "completed",
    started_at: ts,
    paused_at: null,
    completed_at: ts,
    active_seconds: 600,
    session_tag: "babymoon_set_v1_round_1",
    created_by: "user_sam",
    current_item_index: 5,
    summary: null,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

function item(
  partial: Partial<ConversationSessionItem> & { id: string },
): ConversationSessionItem {
  return {
    session_id: "csess_1",
    prompt_id: "qp_parent_word",
    source_question_id: null,
    item_type: "quick_pick",
    display_order: 0,
    energy: "light",
    estimated_time_seconds: 20,
    actual_time_seconds: 15,
    status: "shared_answer_saved",
    opened_at: ts,
    answered_at: ts,
    paused_duration_seconds: 0,
    branch_context: null,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

function ans(
  partial: Partial<ConversationQuickAnswer> & {
    id: string;
    actor: "sam" | "michelle" | "shared";
  },
): ConversationQuickAnswer {
  return {
    family_id: "family_t",
    session_id: "csess_1",
    session_item_id: "citem_1",
    prompt_id: "qp_parent_word",
    selected_options: [],
    short_text: null,
    explanation: null,
    scale: null,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

describe("conversation review routing", () => {
  it("completed session opens review page", () => {
    const s = session({ status: "completed" });
    expect(isSessionIncomplete(s)).toBe(false);
    expect(sessionPrimaryHref(s)).toBe(
      "/conversations/session/csess_1/review",
    );
  });

  it("incomplete session opens answer flow", () => {
    const s = session({ status: "active", completed_at: null });
    expect(isSessionIncomplete(s)).toBe(true);
    expect(sessionPrimaryHref(s)).toBe("/conversations/session/csess_1");
  });

  it("Conversation prompts page uses Open review", () => {
    const src = readFileSync(
      path.join(root, "app/progress/conversation-prompts/page.tsx"),
      "utf8",
    );
    expect(src).toContain("Open review");
    expect(src).toContain("listConversationPromptReviewRows");
  });

  it("History completed links to review", () => {
    const src = readFileSync(
      path.join(root, "app/conversations/history/page.tsx"),
      "utf8",
    );
    expect(src).toContain("/review");
    expect(src).toContain("Review conversation");
  });
});

describe("answer previews", () => {
  it("shared answers display", () => {
    const preview = buildAnswerPreview({
      item: item({ id: "citem_1", status: "shared_answer_saved" }),
      shared: ans({
        id: "a1",
        actor: "shared",
        short_text: "Parents only for first week",
      }),
    });
    expect(preview.kind).toBe("shared");
    expect(preview.snippet).toContain("Parents only");
  });

  it("separate answers display", () => {
    const preview = buildAnswerPreview({
      item: item({ id: "citem_1", status: "answered_different" }),
      sam: ans({ id: "a1", actor: "sam", short_text: "Quiet mornings" }),
      michelle: ans({
        id: "a2",
        actor: "michelle",
        short_text: "Busy mornings",
      }),
    });
    expect(preview.kind).toBe("different");
    expect(preview.samText).toBe("Quiet mornings");
    expect(preview.michelleText).toBe("Busy mornings");
  });

  it("notes display on review cards", () => {
    const model = buildConversationReview(
      store({
        conversation_sessions: [session({})],
        conversation_session_items: [
          item({ id: "citem_1", status: "answered_same" }),
        ],
        conversation_quick_answers: [
          ans({
            id: "a1",
            actor: "sam",
            short_text: "Calm",
            explanation: "We want less rush",
          }),
          ans({
            id: "a2",
            actor: "michelle",
            short_text: "Calm",
            explanation: "Same goal",
          }),
        ],
      }),
      "csess_1",
    );
    expect(model?.cards[0]?.samNotes).toBe("We want less rush");
    expect(model?.cards[0]?.michelleNotes).toBe("Same goal");
  });
});

describe("conversation prompt list search and filters", () => {
  const rows = listConversationPromptReviewRows(
    store({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item({
          id: "citem_1",
          status: "shared_answer_saved",
          prompt_id: "qp_parent_word",
        }),
        item({
          id: "citem_2",
          status: "discuss_later",
          prompt_id: "qp_holiday_size",
          display_order: 1,
        }),
      ],
      conversation_quick_answers: [
        ans({
          id: "a1",
          actor: "shared",
          session_item_id: "citem_1",
          short_text: "Parents only for first week",
        }),
      ],
    }),
  );

  it("answer previews appear on list rows", () => {
    expect(rows[0]?.preview.snippet).toContain("Parents only");
  });

  it("search finds answer text", () => {
    const found = filterConversationPromptRows(rows, {
      q: "parents only",
    });
    expect(found.length).toBeGreaterThan(0);
  });

  it("filters work for discuss later and shared", () => {
    expect(
      filterConversationPromptRows(rows, { filter: "discuss_later" }),
    ).toHaveLength(1);
    expect(
      filterConversationPromptRows(rows, { filter: "shared" }),
    ).toHaveLength(1);
    expect(
      filterConversationPromptRows(rows, { filter: "babymoon" }),
    ).toHaveLength(2);
  });

  it("edit returns to flow with item query", () => {
    const model = buildConversationReview(
      store({
        conversation_sessions: [session({})],
        conversation_session_items: [item({ id: "citem_1" })],
        conversation_quick_answers: [
          ans({ id: "a1", actor: "shared", short_text: "Yes" }),
        ],
      }),
      "csess_1",
    );
    expect(model?.cards[0]?.links.editAnswerHref).toContain(
      "/conversations/session/csess_1?item=citem_1",
    );
  });

  it("review export includes answers", () => {
    const model = buildConversationReview(
      store({
        conversation_sessions: [session({})],
        conversation_session_items: [item({ id: "citem_1" })],
        conversation_quick_answers: [
          ans({
            id: "a1",
            actor: "shared",
            short_text: "Parents only for first week",
          }),
        ],
      }),
      "csess_1",
    );
    const md = exportConversationReviewMarkdown(model!);
    expect(md).toContain("Parents only for first week");
    expect(md).toContain("Babymoon Round 1");
  });

  it("review survives relaunch contract via stable review href", () => {
    const s = session({ id: "csess_9ouyjygd59hk" });
    expect(sessionPrimaryHref(s)).toBe(
      "/conversations/session/csess_9ouyjygd59hk/review",
    );
  });
});
