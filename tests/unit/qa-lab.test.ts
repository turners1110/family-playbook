import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { clearMemoryStore, readStore } from "@/lib/db/store";
import {
  QA_EXPECTED,
  QA_SESSION_ORDER,
  isQaQuestionId,
  qaQuestionCount,
} from "@/lib/qa/question-pack";
import { validateShortTextLength } from "@/lib/qa/validation";
import { runAutomatedIntegrityCheck } from "@/lib/qa/integrity";
import {
  cleanupQaData,
  confirmQaTasks,
  createQaTestPack,
  previewQaCleanup,
  seedQaExpectedAnswers,
} from "@/lib/services/qa-lab";
import { saveConversationQuickAnswer } from "@/lib/services/conversations";

function reseed() {
  clearMemoryStore();
  const seed = spawnSync("pnpm", ["seed"], { cwd: process.cwd(), shell: true });
  if (seed.status !== 0) {
    throw new Error(seed.stderr?.toString() || "seed failed");
  }
  clearMemoryStore();
}

describe("QA question pack", () => {
  it("has dedicated qa_ questions outside the real library", () => {
    expect(qaQuestionCount()).toBeGreaterThanOrEqual(18);
    expect(QA_SESSION_ORDER.every((id) => isQaQuestionId(id))).toBe(true);
    expect(QA_SESSION_ORDER[0]).toBe("qa_quick_pick_same");
  });

  it("blocks validation-limit overflow and allows max length", () => {
    const blocked = validateShortTextLength("qa_validation_limit", "x".repeat(51));
    expect(blocked.ok).toBe(false);
    const ok = validateShortTextLength("qa_validation_limit", "x".repeat(50));
    expect(ok.ok).toBe(true);
  });
});

describe("QA lab storage", () => {
  const runIds: string[] = [];

  beforeAll(() => {
    reseed();
  });

  beforeEach(() => {
    clearMemoryStore();
  });

  afterAll(async () => {
    // Remove any leftover QA runs, then reseed to restore shared local store.
    clearMemoryStore();
    try {
      const store = await readStore();
      for (const run of store.qa_runs ?? []) {
        if (run.status === "cleaned") continue;
        try {
          const preview = await previewQaCleanup(run.test_run_id);
          await cleanupQaData(
            run.test_run_id,
            `DELETE QA ${preview.confirmation_token}`,
          );
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    reseed();
  });

  it("creates a fixed session once with tagged records", async () => {
    const realCount = (await readStore()).questions.length;
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    expect(testRunId.startsWith("qa_")).toBe(true);
    const again = await createQaTestPack("user_sam");
    runIds.push(again.testRunId);
    expect(again.testRunId).not.toBe(testRunId);
    expect(again.sessionId).not.toBe(sessionId);

    await seedQaExpectedAnswers(testRunId);
    const store = await readStore();
    expect(store.questions.length).toBe(realCount);
    expect(store.questions.some((q) => isQaQuestionId(q.id))).toBe(false);

    const report = runAutomatedIntegrityCheck(store, testRunId);
    expect(report.summary.fail).toBe(0);
    expect(report.record_counts.sessions).toBe(1);
    expect(report.record_counts.session_items).toBe(QA_SESSION_ORDER.length);
  });

  it("stores same/different answers and difference records correctly", async () => {
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    const store = await readStore();
    const same = store.conversation_session_items!.find(
      (i) => i.session_id === sessionId && i.prompt_id === "qa_quick_pick_same",
    )!;
    const diff = store.conversation_session_items!.find(
      (i) =>
        i.session_id === sessionId && i.prompt_id === "qa_quick_pick_different",
    )!;

    await saveConversationQuickAnswer({
      sessionId,
      itemId: same.id,
      actor: "sam",
      selectedOptions: ["option_a"],
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: same.id,
      actor: "michelle",
      selectedOptions: ["option_a"],
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: diff.id,
      actor: "sam",
      selectedOptions: ["morning"],
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: diff.id,
      actor: "michelle",
      selectedOptions: ["night"],
    });

    const after = await readStore();
    const sameItem = after.conversation_session_items!.find((i) => i.id === same.id)!;
    const diffItem = after.conversation_session_items!.find((i) => i.id === diff.id)!;
    expect(sameItem.status).toBe("answered_same");
    expect(diffItem.status).toBe("answered_different");
    expect(
      after.conversation_differences!.filter(
        (d) => d.prompt_id === "qa_quick_pick_same" && d.test_run_id === testRunId,
      ),
    ).toHaveLength(0);
    expect(
      after.conversation_differences!.filter(
        (d) =>
          d.prompt_id === "qa_quick_pick_different" && d.test_run_id === testRunId,
      ),
    ).toHaveLength(1);
  });

  it("keeps shared answers while preserving separate actors", async () => {
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    const store = await readStore();
    const item = store.conversation_session_items!.find(
      (i) => i.session_id === sessionId && i.prompt_id === "qa_shared_answer",
    )!;
    await saveConversationQuickAnswer({
      sessionId,
      itemId: item.id,
      actor: "sam",
      shortText: QA_EXPECTED.shared_sam,
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: item.id,
      actor: "michelle",
      shortText: QA_EXPECTED.shared_michelle,
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: item.id,
      actor: "shared",
      shortText: QA_EXPECTED.shared_agreed,
    });
    const after = await readStore();
    const actors = after.conversation_quick_answers!
      .filter((a) => a.session_item_id === item.id)
      .map((a) => a.actor)
      .sort();
    expect(actors).toEqual(["michelle", "sam", "shared"]);
  });

  it("persists special characters and numeric scales", async () => {
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    const store = await readStore();
    const special = store.conversation_session_items!.find(
      (i) =>
        i.session_id === sessionId && i.prompt_id === "qa_special_characters",
    )!;
    const scale = store.conversation_session_items!.find(
      (i) =>
        i.session_id === sessionId && i.prompt_id === "qa_reaction_scale",
    )!;
    await saveConversationQuickAnswer({
      sessionId,
      itemId: special.id,
      actor: "sam",
      shortText: QA_EXPECTED.special,
    });
    await saveConversationQuickAnswer({
      sessionId,
      itemId: scale.id,
      actor: "sam",
      scale: 2,
    });
    const after = await readStore();
    const s = after.conversation_quick_answers!.find(
      (a) => a.session_item_id === special.id,
    )!;
    const sc = after.conversation_quick_answers!.find(
      (a) => a.session_item_id === scale.id,
    )!;
    expect(s.short_text).toBe(QA_EXPECTED.special);
    expect(typeof sc.scale).toBe("number");
    expect(sc.scale).toBe(2);
  });

  it("rejects invalid short-text before storage", async () => {
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    const store = await readStore();
    const item = store.conversation_session_items!.find(
      (i) =>
        i.session_id === sessionId && i.prompt_id === "qa_validation_limit",
    )!;
    const beforeCount = store.conversation_quick_answers!.filter(
      (a) => a.session_item_id === item.id,
    ).length;
    await expect(
      saveConversationQuickAnswer({
        sessionId,
        itemId: item.id,
        actor: "sam",
        shortText: "x".repeat(51),
      }),
    ).rejects.toThrow(/at most 50/);
    const after = await readStore();
    expect(
      after.conversation_quick_answers!.filter((a) => a.session_item_id === item.id),
    ).toHaveLength(beforeCount);
  });

  it("creates confirmed tasks idempotently and cleans only QA data", async () => {
    const before = await readStore();
    const realQuestions = before.questions.length;
    const realAnswerId = before.answers[0]?.id;

    const { testRunId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    await seedQaExpectedAnswers(testRunId);
    await confirmQaTasks(testRunId, ["QA Task One", "QA Provider Follow-Up"]);
    await confirmQaTasks(testRunId, ["QA Task One", "QA Provider Follow-Up"]);
    let store = await readStore();
    const qaTasks = store.checklist_tasks.filter((t) => t.test_run_id === testRunId);
    expect(qaTasks).toHaveLength(2);

    const preview = await previewQaCleanup(testRunId);
    await cleanupQaData(
      testRunId,
      `DELETE QA ${preview.confirmation_token}`,
    );
    store = await readStore();
    expect(
      store.checklist_tasks.filter((t) => t.test_run_id === testRunId),
    ).toHaveLength(0);
    expect(
      store.conversation_sessions!.filter((s) => s.test_run_id === testRunId),
    ).toHaveLength(0);
    expect(store.questions.length).toBe(realQuestions);
    if (realAnswerId) {
      expect(store.answers.some((a) => a.id === realAnswerId)).toBe(true);
    }
    expect(store.questions.some((q) => isQaQuestionId(q.id))).toBe(false);

    const report = runAutomatedIntegrityCheck(store, testRunId);
    expect(report.record_counts.sessions).toBe(0);
    expect(report.record_counts.quick_answers).toBe(0);
  });

  it("does not reshuffle fixed QA order", async () => {
    const { testRunId, sessionId } = await createQaTestPack("user_sam");
    runIds.push(testRunId);
    const store = await readStore();
    const ordered = store
      .conversation_session_items!.filter((i) => i.session_id === sessionId)
      .sort((a, b) => a.display_order - b.display_order)
      .map((i) => i.prompt_id);
    expect(ordered).toEqual(QA_SESSION_ORDER);
  });
});
