import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  auditQuickToDeepLinks,
  conversationReturnHref,
  resolveDeepQuestionTarget,
} from "@/lib/conversations/deep-link";
import { getEssentialsScreenByQuestionId } from "@/lib/essentials/pathway";
import { clearMemoryStore, readStore } from "@/lib/db/store";
import { spawnSync } from "child_process";
import {
  createQaTestPack,
  seedQaExpectedAnswers,
} from "@/lib/services/qa-lab";
import { getConversationSession } from "@/lib/services/conversations";
import { getQaQuestion } from "@/lib/qa/question-pack";

const root = path.resolve(__dirname, "../..");

function source(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function reseed() {
  clearMemoryStore();
  const seed = spawnSync("pnpm", ["seed"], { cwd: process.cwd(), shell: true });
  if (seed.status !== 0) {
    throw new Error(seed.stderr?.toString() || "seed failed");
  }
  clearMemoryStore();
}

describe("resolveDeepQuestionTarget", () => {
  it("resolves normal library ID to slug route (never raw ID)", async () => {
    reseed();
    const store = await readStore();
    const traits = store.questions.find(
      (q) => q.id === "q_what_traits_do_we_most_hope_our_child_develops",
    );
    expect(traits?.slug).toBeTruthy();
    const target = resolveDeepQuestionTarget({
      questionId: traits!.id,
      sessionId: "sess_1",
      sessionItemId: "item_1",
      questions: store.questions.map((q) => ({ id: q.id, slug: q.slug })),
    });
    expect(target.type).toBe("normal_question");
    expect(target.href).toBe(
      `/questions/${traits!.slug}?source=conversation&returnTo=%2Fconversations%2Fsession%2Fsess_1&sessionId=sess_1&sessionItemId=item_1&fromSession=sess_1`,
    );
    expect(target.href).not.toContain(`/questions/${traits!.id}`);
    expect(target.href).not.toMatch(/\/questions\/q_/);
  });

  it("resolves Essentials ID to Essentials screen route", () => {
    const id = "q_what_does_success_as_parents_mean_to_us";
    const screen = getEssentialsScreenByQuestionId(id);
    expect(screen).toBeTruthy();
    const target = resolveDeepQuestionTarget({
      questionId: id,
      sessionId: "sess_1",
      sessionItemId: "item_1",
    });
    expect(target.type).toBe("essentials_screen");
    expect(target.href).toContain(
      `/questions/before-birth/screen/${screen!.id}`,
    );
    expect(target.href).toContain("returnTo=");
  });

  it("resolves grouped Essentials question to grouped screen", () => {
    // Find a paired question id from pathway
    const screen = getEssentialsScreenByQuestionId(
      "q_what_parts_of_our_own_childhoods_do_we_hope_to_repeat",
    );
    const paired = screen?.paired_question_ids?.[0];
    if (!paired) {
      // Still assert primary resolves
      expect(screen).toBeTruthy();
      return;
    }
    const target = resolveDeepQuestionTarget({
      questionId: paired,
      sessionId: "sess_1",
    });
    expect(target.type).toBe("essentials_grouped");
    expect(target.screenId).toBe(screen!.id);
    expect(target.href).toContain(`/questions/before-birth/screen/${screen!.id}`);
  });

  it("resolves QA ID to QA deep route and rejects missing testRunId", () => {
    const withRun = resolveDeepQuestionTarget({
      questionId: "qa_deep_follow_up",
      sessionId: "sess_qa",
      sessionItemId: "item_q",
      testRunId: "run_abc",
    });
    expect(withRun.type).toBe("qa_deep");
    expect(withRun.href).toBe(
      `/conversations/test/run_abc/deep/qa_deep_follow_up?source=conversation&returnTo=%2Fconversations%2Ftest%2Frun_abc&sessionId=sess_qa&sessionItemId=item_q&testRunId=run_abc&fromSession=sess_qa`,
    );

    const missing = resolveDeepQuestionTarget({
      questionId: "qa_deep_follow_up",
      sessionId: "sess_qa",
    });
    expect(missing.type).toBe("unavailable");
    expect(missing.href).toBeNull();
  });

  it("returns unavailable for missing IDs", () => {
    const target = resolveDeepQuestionTarget({
      questionId: "q_does_not_exist_anywhere",
      sessionId: "s",
      questions: [],
    });
    expect(target.type).toBe("unavailable");
    expect(target.href).toBeNull();
    expect(target.exists).toBe(false);
  });

  it("builds conversation return href for session and QA", () => {
    expect(
      conversationReturnHref({
        returnTo: "/conversations/session/x",
      }),
    ).toBe("/conversations/session/x");
    expect(conversationReturnHref({ testRunId: "run1" })).toBe(
      "/conversations/test/run1",
    );
    expect(conversationReturnHref({ sessionId: "s1" })).toBe(
      "/conversations/session/s1",
    );
  });
});

describe("quick-to-deep audit", () => {
  it("audits all links with zero unavailable when store is seeded", async () => {
    reseed();
    const store = await readStore();
    const report = auditQuickToDeepLinks(
      store.questions.map((q) => ({ id: q.id, slug: q.slug })),
    );
    expect(report.total).toBeGreaterThan(30);
    expect(report.valid_qa).toBeGreaterThanOrEqual(1);
    expect(report.valid_essentials + report.valid_essentials_grouped).toBeGreaterThan(
      20,
    );
    expect(report.valid_normal).toBeGreaterThanOrEqual(1);
    expect(report.unavailable).toBe(0);
    expect(report.invalid_routes).toEqual([]);

    const qaPair = report.rows.find((r) => r.promptId === "qa_quick_to_deep");
    expect(qaPair?.deepQuestionId).toBe("qa_deep_follow_up");
    expect(qaPair?.type).toBe("qa_deep");
    expect(qaPair?.href).toContain(
      "/conversations/test/audit_run/deep/qa_deep_follow_up",
    );
  });
});

describe("QA quick→deep session integrity", () => {
  it("keeps same session and test_run_id; deep item exists; no library question", async () => {
    reseed();
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    await seedQaExpectedAnswers(testRunId);
    const data = await getConversationSession(sessionId);
    expect(data).toBeTruthy();
    expect(data!.session.test_run_id).toBe(testRunId);
    expect(data!.session.is_test_data).toBe(true);

    const quick = data!.items.find((i) => i.prompt_id === "qa_quick_to_deep");
    const deep = data!.items.find((i) => i.prompt_id === "qa_deep_follow_up");
    expect(quick).toBeTruthy();
    expect(deep).toBeTruthy();
    expect(deep!.test_run_id).toBe(testRunId);

    const target = resolveDeepQuestionTarget({
      questionId: "qa_deep_follow_up",
      sessionId,
      sessionItemId: quick!.id,
      testRunId,
    });
    expect(target.href).toContain(
      `/conversations/test/${testRunId}/deep/qa_deep_follow_up`,
    );

    const store = await readStore();
    expect(store.questions.some((q) => q.id === "qa_deep_follow_up")).toBe(
      false,
    );
    expect(getQaQuestion("qa_deep_follow_up")).toBeTruthy();

    const quickAnswers = data!.answers.filter(
      (a) => a.prompt_id === "qa_quick_to_deep",
    );
    expect(quickAnswers.length).toBeGreaterThan(0);
    expect(quickAnswers.every((a) => a.test_run_id === testRunId)).toBe(true);

    // Single session for the run
    expect(
      store.conversation_sessions?.filter((s) => s.test_run_id === testRunId),
    ).toHaveLength(1);
  });
});

describe("UI wiring contracts", () => {
  it("ConversationCard does not build deep links from raw IDs", () => {
    const src = source("components/conversations/ConversationCard.tsx");
    expect(src).not.toMatch(/before-birth\/deep\/\$\{/);
    expect(src).toMatch(/deepTarget/);
    expect(src).toMatch(/Deeper discussion is not available yet/);
  });

  it("QA deep route page exists and guards QA IDs", () => {
    const src = source(
      "app/conversations/test/[testRunId]/deep/[questionId]/page.tsx",
    );
    expect(src).toMatch(/isQaQuestionId/);
    expect(src).toMatch(/advanceConversationItem/);
    expect(src).toMatch(/sessionBaseHref/);
  });
});
