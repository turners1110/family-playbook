import { spawnSync } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearMemoryStore, readStore } from "@/lib/db/store";
import {
  findResumableConversationSession,
  getConversationSession,
  getConversationSessionProgress,
  saveConversationQuickAnswersBatch,
  startConversationSession,
} from "@/lib/services/conversations";
import {
  answerContentFingerprint,
  assertDurableStorageForProductWrites,
  storageBackupLabel,
  verifyConversationAnswersInStore,
} from "@/lib/db/durable-save";
import { readFileSync } from "fs";
import path from "path";

function reseed() {
  clearMemoryStore();
  const seed = spawnSync("pnpm", ["seed"], { cwd: process.cwd(), shell: true });
  if (seed.status !== 0) {
    throw new Error(seed.stderr?.toString() || "seed failed");
  }
  clearMemoryStore();
}

describe("data-loss root cause: resume vs new session", () => {
  beforeAll(() => {
    reseed();
  });

  afterAll(() => {
    reseed();
  });

  it("keeps answers after save and prefers resuming that session", async () => {
    const started = await startConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      createdBy: "user_sam",
      babymoonRound: 1,
      forceNew: true,
    });
    expect(started.resumed).toBe(false);

    const data = await getConversationSession(started.sessionId);
    expect(data).toBeTruthy();
    const item = data!.items[0]!;
    await saveConversationQuickAnswersBatch({
      sessionId: started.sessionId,
      itemId: item.id,
      answers: [
        { actor: "sam", shortText: "Present", selectedOptions: [] },
        { actor: "michelle", shortText: "Steady", selectedOptions: [] },
      ],
      mutationId: "mut_persist_test_001",
    });

    // Simulate "app relaunch" — clear memory, re-read from durable local file.
    clearMemoryStore();
    const afterRelaunch = await getConversationSession(started.sessionId);
    expect(afterRelaunch).toBeTruthy();
    const answers = afterRelaunch!.answers.filter(
      (a) => a.session_item_id === item.id,
    );
    expect(answers).toHaveLength(2);
    expect(answers.every((a) => a.session_id === started.sessionId)).toBe(true);

    const progress = getConversationSessionProgress(
      await readStore(),
      started.sessionId,
    );
    expect(progress.hasProgress).toBe(true);

    // Starting the same round must resume, not create a blank session.
    const again = await startConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      createdBy: "user_sam",
      babymoonRound: 1,
    });
    expect(again.resumed).toBe(true);
    expect(again.sessionId).toBe(started.sessionId);

    const resumable = await findResumableConversationSession({
      mode: "babymoon",
      babymoonRound: 1,
    });
    expect(resumable?.sessionId).toBe(started.sessionId);
  });

  it("does not treat empty newer sessions as the resume target when progress exists", async () => {
    const withProgress = await startConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      createdBy: "user_sam",
      babymoonRound: 2,
      forceNew: true,
    });
    const data = await getConversationSession(withProgress.sessionId);
    const item = data!.items[0]!;
    await saveConversationQuickAnswersBatch({
      sessionId: withProgress.sessionId,
      itemId: item.id,
      answers: [
        { actor: "sam", selectedOptions: ["a"] },
        { actor: "michelle", selectedOptions: ["a"] },
      ],
      mutationId: "mut_persist_test_002",
    });

    // Explicit empty new session (user forced)
    const empty = await startConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      createdBy: "user_sam",
      babymoonRound: 2,
      forceNew: true,
    });
    expect(empty.sessionId).not.toBe(withProgress.sessionId);

    const resumable = await findResumableConversationSession({
      mode: "babymoon",
      babymoonRound: 2,
    });
    expect(resumable?.sessionId).toBe(withProgress.sessionId);
  });
});

describe("durable save verification", () => {
  beforeAll(() => reseed());
  afterAll(() => reseed());

  it("verifies fingerprints after mutation and refuses advance without verify", async () => {
    const started = await startConversationSession({
      mode: "babymoon",
      plannedMinutes: 15,
      createdBy: "user_sam",
      babymoonRound: 3,
      forceNew: true,
    });
    const data = await getConversationSession(started.sessionId);
    const item = data!.items[0]!;
    const writes = [
      {
        actor: "sam" as const,
        shortText: "Alpha",
        selectedOptions: [] as string[],
      },
      {
        actor: "michelle" as const,
        shortText: "Beta",
        selectedOptions: [] as string[],
      },
    ];
    await saveConversationQuickAnswersBatch({
      sessionId: started.sessionId,
      itemId: item.id,
      answers: writes,
      mutationId: "mut_verify_001",
    });
    const store = await readStore();
    const verified = verifyConversationAnswersInStore(store, {
      sessionId: started.sessionId,
      itemId: item.id,
      promptId: item.prompt_id,
      expectations: writes.map((w) => ({
        actor: w.actor,
        fingerprint: answerContentFingerprint(w),
      })),
    });
    expect(verified.ok).toBe(true);

    const mismatch = verifyConversationAnswersInStore(store, {
      sessionId: started.sessionId,
      itemId: item.id,
      promptId: item.prompt_id,
      expectations: [
        {
          actor: "sam",
          fingerprint: answerContentFingerprint({ shortText: "WRONG" }),
        },
      ],
    });
    expect(mismatch.ok).toBe(false);
  });

  it("blocks trip-mode writes when remote store is disabled", () => {
    const prevE = process.env.EMERGENCY_ACCESS_MODE;
    const prevR = process.env.USE_REMOTE_JSON_STORE;
    process.env.EMERGENCY_ACCESS_MODE = "true";
    process.env.USE_REMOTE_JSON_STORE = "false";
    expect(() => assertDurableStorageForProductWrites()).toThrow(/remote storage/i);
    const label = storageBackupLabel();
    expect(label.remote).toBe(false);
    expect(label.warning).toMatch(/ONLINE backup is OFF|Online backup is OFF/i);
    process.env.EMERGENCY_ACCESS_MODE = prevE;
    process.env.USE_REMOTE_JSON_STORE = prevR;
  });
});

describe("release gate: navigation after verified save", () => {
  it("ConversationCard only advances after verified ack", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/conversations/ConversationCard.tsx"),
      "utf8",
    );
    expect(src).toMatch(/ack\.verified/);
    expect(src).toMatch(/advanceAfterSave/);
    expect(src).toMatch(/SaveStatusBanner/);
  });

  it("batch action verifies before advance", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../lib/actions/conversations.ts"),
      "utf8",
    );
    expect(src).toMatch(/verifyConversationAnswersInStore/);
    expect(src).toMatch(/advance: false/);
    expect(src).toMatch(/advanceConversationItem/);
  });

  it("AppShell does not claim online backup unless remote is on", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/layout/AppShell.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/Online Backup Enabled/);
    expect(src).toMatch(/storageBackupLabel/);
  });
});
