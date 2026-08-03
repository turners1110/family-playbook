import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import type { AppStore, ConversationSession } from "@/lib/types/models";
import {
  evaluateBabymoonRoundStatus,
  evaluateSessionCompletion,
  itemMeetsCompletionRule,
} from "@/lib/services/round-status";
import {
  buildFamilyProgressMetrics,
} from "@/lib/services/answered-status";
import {
  listConversationPromptRecords,
  listDeepDiscussionRecords,
  listEssentialsCompletedRecords,
  listOpenFollowUpRecords,
  listSharedDecisionRecords,
  reconcileProgressTileCounts,
} from "@/lib/services/progress-records";

const root = path.resolve(__dirname, "../..");

function baseStore(overrides: Partial<AppStore> = {}): AppStore {
  const ts = "2026-08-01T12:00:00.000Z";
  return {
    family: {
      id: "family_t",
      name: "Turner Family",
      created_at: ts,
      updated_at: ts,
    },
    members: [
      {
        id: "member_sam",
        family_id: "family_t",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: ts,
      },
      {
        id: "member_michelle",
        family_id: "family_t",
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: ts,
      },
    ],
    users: [],
    questions: [],
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
  const ts = "2026-08-01T12:00:00.000Z";
  return {
    id: "csess_1",
    family_id: "family_t",
    mode: "babymoon",
    title: "Babymoon · Warm-up",
    planned_minutes: 15,
    status: "active",
    started_at: ts,
    paused_at: null,
    completed_at: null,
    active_seconds: 0,
    session_tag: "babymoon_set_v1_round_1",
    created_by: "user_sam",
    current_item_index: 0,
    summary: null,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

function item(
  id: string,
  status:
    | "pending"
    | "opened"
    | "answered_same"
    | "answered_different"
    | "shared_answer_saved"
    | "undecided"
    | "discuss_later"
    | "skipped"
    | "needs_follow_up",
  opts?: { optional?: boolean; hidden?: boolean; order?: number },
) {
  const ts = "2026-08-01T12:00:00.000Z";
  return {
    id,
    session_id: "csess_1",
    prompt_id: `qp_${id}`,
    source_question_id: null,
    item_type: "quick_pick" as const,
    display_order: opts?.order ?? 0,
    energy: "light" as const,
    estimated_time_seconds: 20,
    actual_time_seconds: 10,
    status,
    opened_at: ts,
    answered_at: status === "pending" ? null : ts,
    paused_duration_seconds: 0,
    branch_context:
      opts?.optional || opts?.hidden
        ? {
            ...(opts.optional ? { optional: true } : {}),
            ...(opts.hidden ? { hidden: true } : {}),
          }
        : null,
    created_at: ts,
    updated_at: ts,
  };
}

describe("round status", () => {
  it("zero answers gives not_started", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "pending", { order: 0 }),
        item("b", "pending", { order: 1 }),
      ],
    });
    const eval_ = evaluateSessionCompletion(
      store,
      store.conversation_sessions![0]!,
    );
    expect(eval_.status).toBe("not_started");
  });

  it("partial answers gives in_progress", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "pending", { order: 1 }),
      ],
    });
    expect(
      evaluateSessionCompletion(store, store.conversation_sessions![0]!)
        .status,
    ).toBe("in_progress");
  });

  it("all required visible items gives completed", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "shared_answer_saved", { order: 1 }),
      ],
    });
    expect(
      evaluateSessionCompletion(store, store.conversation_sessions![0]!)
        .status,
    ).toBe("completed");
  });

  it("discuss later gives completed_with_followups", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "discuss_later", { order: 1 }),
      ],
    });
    expect(
      evaluateSessionCompletion(store, store.conversation_sessions![0]!)
        .status,
    ).toBe("completed_with_followups");
  });

  it("optional skip does not block completion", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "skipped", { order: 1, optional: true }),
      ],
    });
    const eval_ = evaluateSessionCompletion(
      store,
      store.conversation_sessions![0]!,
    );
    expect(eval_.status).toBe("completed");
    expect(
      itemMeetsCompletionRule(store, store.conversation_session_items![1]!),
    ).toBe(true);
  });

  it("hidden branch does not block completion", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "pending", { order: 1, hidden: true }),
      ],
    });
    expect(
      evaluateSessionCompletion(store, store.conversation_sessions![0]!)
        .status,
    ).toBe("completed");
  });

  it("babymoon round prefers completed session", () => {
    const store = baseStore({
      conversation_sessions: [
        session({
          id: "csess_done",
          status: "completed",
          completed_at: "2026-08-03T16:05:33.007Z",
        }),
        session({
          id: "csess_empty",
          status: "active",
          updated_at: "2026-08-04T00:00:00.000Z",
        }),
      ],
      conversation_session_items: [
        {
          ...item("a", "answered_same", { order: 0 }),
          session_id: "csess_done",
        },
        {
          ...item("b", "answered_same", { order: 1 }),
          session_id: "csess_done",
        },
        {
          ...item("c", "pending", { order: 0 }),
          id: "citem_empty",
          session_id: "csess_empty",
        },
      ],
    });
    const view = evaluateBabymoonRoundStatus(store, 1);
    expect(view.session?.id).toBe("csess_done");
    expect(view.status).toBe("completed");
    expect(view.completedAt).toBe("2026-08-03T16:05:33.007Z");
  });

  it("repeated completion evaluation stays idempotent on completed session", () => {
    const store = baseStore({
      conversation_sessions: [
        session({
          status: "completed",
          completed_at: "2026-08-03T16:05:33.007Z",
          completed_item_count: 2,
          eligible_item_count: 2,
          open_followup_count: 0,
          summary: {
            agreed: ["x"],
            differed: [],
            discuss_later: [],
            tasks_suggested: [],
            provider_questions: [],
            light_moment: null,
            trip_memory: null,
            notes: null,
          },
        }),
      ],
      conversation_session_items: [
        item("a", "answered_same", { order: 0 }),
        item("b", "answered_same", { order: 1 }),
      ],
    });
    const first = evaluateSessionCompletion(
      store,
      store.conversation_sessions![0]!,
    );
    const second = evaluateSessionCompletion(
      store,
      store.conversation_sessions![0]!,
    );
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(store.conversation_sessions![0]!.summary?.agreed).toEqual(["x"]);
  });
});

describe("progress tile reconciliation", () => {
  it("tile counts equal detail list lengths", () => {
    const store = baseStore();
    const metrics = buildFamilyProgressMetrics(store);
    const recon = reconcileProgressTileCounts(store, metrics);
    expect(recon.allMatch).toBe(true);
    expect(listDeepDiscussionRecords(store).length).toBe(
      metrics.canonicalQuestionsAnswered,
    );
    expect(listConversationPromptRecords(store).length).toBe(
      metrics.conversationPromptsCompleted,
    );
    expect(listEssentialsCompletedRecords(store).length).toBe(
      metrics.essentialsScreensCompleted,
    );
    expect(listSharedDecisionRecords(store).length).toBe(
      metrics.sharedDecisions,
    );
    expect(listOpenFollowUpRecords(store).length).toBe(metrics.openFollowUps);
  });

  it("QA sessions are excluded from conversation prompt counts", () => {
    const store = baseStore({
      conversation_sessions: [
        session({ id: "csess_qa", is_test_data: true, test_run_id: "run_1" }),
      ],
      conversation_session_items: [
        {
          ...item("qa", "answered_same"),
          session_id: "csess_qa",
          is_test_data: true,
          test_run_id: "run_1",
        },
      ],
    });
    expect(listConversationPromptRecords(store)).toHaveLength(0);
    expect(buildFamilyProgressMetrics(store).conversationPromptsCompleted).toBe(
      0,
    );
  });

  it("zero-answer sessions do not inflate conversation prompts", () => {
    const store = baseStore({
      conversation_sessions: [session({})],
      conversation_session_items: [item("a", "pending")],
    });
    expect(listConversationPromptRecords(store)).toHaveLength(0);
  });
});

describe("home progress tiles wiring", () => {
  it("Home uses ProgressTile links for the five metrics", () => {
    const src = readFileSync(path.join(root, "app/home/page.tsx"), "utf8");
    expect(src).toContain('href="/progress/deep-discussions"');
    expect(src).toContain('href="/progress/conversation-prompts"');
    expect(src).toContain('href="/questions/before-birth?filter=completed"');
    expect(src).toContain('href="/progress/shared-decisions"');
    expect(src).toContain('href="/progress/open-followups"');
    expect(src).toContain("ProgressTile");
  });

  it("Storage Debug shows tile vs detail reconciliation", () => {
    const src = readFileSync(
      path.join(root, "app/settings/storage-debug/page.tsx"),
      "utf8",
    );
    expect(src).toContain("reconcileProgressTileCounts");
    expect(src).toContain("Detail list");
  });
});
