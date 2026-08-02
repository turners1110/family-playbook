import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  SubmissionLock,
  classifySaveError,
  createIdempotencyKey,
  saveButtonIdleLabel,
  slowSaveMessage,
  SLOW_SAVE_MS,
  VERY_SLOW_SAVE_MS,
  SAVED_FLASH_MS,
} from "@/lib/ui/save-feedback";
import { runSaveAttempt } from "@/lib/ui/save-feedback-runner";
import { spawnSync } from "child_process";
import { saveAnswersBatch, saveAnswer } from "@/lib/services/answers";
import { clearMemoryStore, readStore } from "@/lib/db/store";

const root = path.resolve(__dirname, "../..");

function source(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("save feedback helpers", () => {
  it("maps button labels for every required state", () => {
    expect(saveButtonIdleLabel("idle", "Save and next")).toBe("Save and next");
    expect(saveButtonIdleLabel("saving", "Save and next")).toBe("Saving…");
    expect(saveButtonIdleLabel("saved", "Save and next")).toBe("Saved");
    expect(saveButtonIdleLabel("moving_to_next", "Save and next")).toBe(
      "Loading next question…",
    );
    expect(saveButtonIdleLabel("failed", "Save and next")).toBe("Couldn’t save");
    expect(saveButtonIdleLabel("conflict", "Save and next")).toBe(
      "Couldn’t save",
    );
  });

  it("shows slow-save notices after thresholds", () => {
    expect(slowSaveMessage(0)).toBeNull();
    expect(slowSaveMessage(1)).toBe("Still saving securely…");
    expect(slowSaveMessage(2)).toMatch(/still on this screen/i);
    expect(SLOW_SAVE_MS).toBe(1500);
    expect(VERY_SLOW_SAVE_MS).toBe(4000);
    expect(SAVED_FLASH_MS).toBeGreaterThanOrEqual(300);
    expect(SAVED_FLASH_MS).toBeLessThanOrEqual(600);
  });

  it("classifies conflict vs failed without clearing entered data semantics", () => {
    const conflict = classifySaveError(
      Object.assign(new Error("Another update was saved first"), {
        code: "version_conflict",
      }),
    );
    expect(conflict.state).toBe("conflict");
    expect(conflict.message).toMatch(/another update was saved first/i);

    const failed = classifySaveError(new Error("network down"));
    expect(failed.state).toBe("failed");
    expect(failed.message).toMatch(/network down|still on this screen/i);
  });

  it("keeps one idempotency key until release mints a new one", () => {
    const lock = new SubmissionLock();
    const a = lock.tryAcquire();
    const b = lock.tryAcquire();
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    if (a.ok) {
      const key = a.key;
      lock.release({ mintNewKey: false });
      const retry = lock.tryAcquire();
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.key).toBe(key);
      lock.release({ mintNewKey: true });
      const next = lock.tryAcquire();
      expect(next.ok).toBe(true);
      if (next.ok) expect(next.key).not.toBe(key);
    }
  });

  it("does not mint a new key during repeated createIdempotencyKey-less lock holds", () => {
    const lock = new SubmissionLock();
    const first = lock.tryAcquire();
    expect(first.ok).toBe(true);
    lock.release({ mintNewKey: false });
    const second = lock.tryAcquire();
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.key).toBe(first.key);
  });
});

describe("runSaveAttempt", () => {
  it("moves to Saving immediately and blocks duplicate submissions", async () => {
    const lock = new SubmissionLock();
    const states: string[] = [];
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const p1 = runSaveAttempt({
      lock,
      execute: async () => {
        calls += 1;
        await gate;
      },
      sleep: async () => undefined,
      onEvent: (e) => {
        if (e.type === "state") states.push(e.state);
      },
    });

    expect(states[0]).toBe("saving");
    const dup = await runSaveAttempt({
      lock,
      execute: async () => {
        calls += 1;
      },
      sleep: async () => undefined,
    });
    expect(dup.duplicate).toBe(true);
    expect(calls).toBe(1);
    release();
    const result = await p1;
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
    expect(states).toContain("saved");
  });

  it("keeps failure state for retry and shows Saved before moving_to_next", async () => {
    const lock = new SubmissionLock();
    const states: string[] = [];
    const result = await runSaveAttempt({
      lock,
      advanceAfterSave: true,
      execute: async () => undefined,
      sleep: async () => undefined,
      onEvent: (e) => {
        if (e.type === "state") states.push(e.state);
      },
    });
    expect(result.ok).toBe(true);
    const savedIdx = states.indexOf("saved");
    const movingIdx = states.indexOf("moving_to_next");
    expect(savedIdx).toBeGreaterThanOrEqual(0);
    expect(movingIdx).toBeGreaterThan(savedIdx);
  });

  it("emits slow-save tier after threshold while keeping form semantics", async () => {
    const lock = new SubmissionLock();
    const tiers: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const p = runSaveAttempt({
      lock,
      execute: async () => gate,
      sleep: async () => undefined,
      onEvent: (e) => {
        if (e.type === "slow") tiers.push(e.tier);
      },
    });
    await new Promise((r) => setTimeout(r, SLOW_SAVE_MS + 40));
    expect(tiers).toContain(1);
    release();
    await p;
  });

  it("conflict keeps entered data path (failure does not clear lock key for retry)", async () => {
    const lock = new SubmissionLock();
    const err = Object.assign(new Error("version conflict"), {
      code: "version_conflict",
    });
    const failed = await runSaveAttempt({
      lock,
      execute: async () => {
        throw err;
      },
      sleep: async () => undefined,
    });
    expect(failed.state).toBe("conflict");
    expect(failed.mutationId).toBeTruthy();
    expect(lock.currentKey()).toBe(failed.mutationId);
  });

  it("retry works after failure with a new key when minted", async () => {
    const lock = new SubmissionLock();
    await runSaveAttempt({
      lock,
      execute: async () => {
        throw new Error("fail");
      },
      sleep: async () => undefined,
    });
    lock.release({ mintNewKey: true });
    const ok = await runSaveAttempt({
      lock,
      execute: async () => undefined,
      sleep: async () => undefined,
    });
    expect(ok.ok).toBe(true);
  });
});

describe("batch answer saves (no duplicate revisions)", () => {
  function reseed() {
    clearMemoryStore();
    const seed = spawnSync("pnpm", ["seed"], { cwd: process.cwd(), shell: true });
    if (seed.status !== 0) {
      throw new Error(seed.stderr?.toString() || "seed failed");
    }
    clearMemoryStore();
  }

  it("writes multiple essentials answers in one mutation without duplicate history spam", async () => {
    reseed();
    const store = await readStore();
    const questionId = store.questions[0]!.id;
    const sam = store.members.find((m) => m.display_name === "Sam")!;
    const michelle = store.members.find((m) => m.display_name === "Michelle")!;
    const beforeVersions = store.answer_versions.length;

    await saveAnswersBatch(
      [
        {
          question_id: questionId,
          member_id: sam.id,
          is_shared: false,
          payload: { text: "sam draft" },
          status: "decided",
          confidence: 3,
        },
        {
          question_id: questionId,
          member_id: michelle.id,
          is_shared: false,
          payload: { text: "michelle draft" },
          status: "decided",
          confidence: 3,
        },
        {
          question_id: questionId,
          member_id: null,
          is_shared: true,
          payload: { text: "shared" },
          status: "decided",
          confidence: 3,
        },
      ],
      undefined,
      "mut_batch_test_001",
    );

    const after = await readStore();
    const created = after.answer_versions.length - beforeVersions;
    expect(created).toBe(3);
    const answers = after.answers.filter((a) => a.question_id === questionId);
    expect(answers).toHaveLength(3);

    await saveAnswer({
      question_id: questionId,
      member_id: null,
      is_shared: true,
      payload: { text: "shared kept" },
      status: "decided",
      confidence: 3,
      mutation_id: createIdempotencyKey("mut"),
    });
    const final = await readStore();
    const shared = final.answers.find(
      (a) => a.question_id === questionId && a.is_shared,
    );
    expect(shared?.payload.text).toBe("shared kept");
  });
});

describe("UI wiring (source contracts)", () => {
  it("ConversationCard uses sticky save feedback components", () => {
    const src = source("components/conversations/ConversationCard.tsx");
    expect(src).toMatch(/SaveButton/);
    expect(src).toMatch(/SlowSaveNotice/);
    expect(src).toMatch(/RetrySavePanel/);
    expect(src).toMatch(/PendingNavigationGuard/);
    expect(src).toMatch(/CardSkeleton/);
    expect(src).toMatch(/aria-live/);
    expect(src).toMatch(/fixed inset-x-0 bottom-0/);
    expect(src).toMatch(/headingRef\.current\?\.focus/);
    expect(src).toMatch(/actionSaveConversationAnswersBatch/);
    expect(src).toMatch(/Keep both answers/);
    expect(src).toMatch(/Discuss later/);
    expect(src).toMatch(/Pause/);
    expect(src).toMatch(/mutationId/);
  });

  it("Essentials screen keeps form visible and uses save states", () => {
    const src = source("components/essentials/EssentialsScreen.tsx");
    expect(src).toMatch(/useSaveFeedback/);
    expect(src).toMatch(/SaveButton/);
    expect(src).toMatch(/PendingNavigationGuard/);
    expect(src).toMatch(/actionSaveEssentialsAnswersBatch/);
    expect(src).toMatch(/Waiting for provider/);
    expect(src).toMatch(/Undecided/);
    expect(src).toMatch(/Discuss later/);
    expect(src).toMatch(/aria-live/);
  });

  it("reusable loader components exist with a11y hooks", () => {
    expect(source("components/ui/save-feedback/SaveButton.tsx")).toMatch(
      /aria-busy/,
    );
    expect(source("components/ui/save-feedback/InlineSpinner.tsx")).toMatch(
      /aria-label/,
    );
    expect(source("components/ui/save-feedback/SlowSaveNotice.tsx")).toMatch(
      /Still saving securely/,
    );
    expect(
      source("components/ui/save-feedback/PendingNavigationGuard.tsx"),
    ).toMatch(/Your answer is still saving/);
    expect(source("components/ui/save-feedback/CardSkeleton.tsx")).toMatch(
      /animate-pulse|skeleton/i,
    );
    expect(source("components/ui/save-feedback/RetrySavePanel.tsx")).toMatch(
      /Retry/,
    );
  });

  it("QA task confirmation and essentials task confirm show pending save UI", () => {
    const qa = source("components/qa/TestLabClient.tsx");
    expect(qa).toMatch(/SaveButton/);
    expect(qa).toMatch(/confirm_qa_tasks/);
    const tasks = source("components/essentials/TaskSuggestionPreview.tsx");
    expect(tasks).toMatch(/useSaveFeedback/);
    expect(tasks).toMatch(/confirm_task_suggestions/);
  });

  it("timing logs never include answer text fields", () => {
    const ui = source("lib/ui/save-feedback.ts");
    expect(ui).toMatch(/Never includes answer text/);
    const logFn = ui.slice(ui.indexOf("export function logSaveTiming"));
    expect(logFn).not.toMatch(/payload|short_text|answerText/);
    const actions = source("lib/actions/conversations.ts");
    expect(actions).toMatch(/\[save_timing\]/);
    const timingBlocks = actions.match(/console\.info\("\[save_timing\]"[\s\S]*?\}\);/g) ?? [];
    expect(timingBlocks.length).toBeGreaterThan(0);
    for (const block of timingBlocks) {
      expect(block).not.toMatch(/shortText|selectedOptions|explanation/);
    }
  });
});
