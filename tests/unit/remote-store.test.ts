import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
  assertValidAppStore,
  StoreValidationError,
} from "@/lib/db/store-errors";
import {
  clearMemoryStore,
  getStorageMode,
  readStore,
  usesRemoteJsonStore,
} from "@/lib/db/store";
import { saveAnswer } from "@/lib/services/answers";
import { saveDecision } from "@/lib/services/decisions";
import { createSession, getSession } from "@/lib/services/sessions";
import { getDashboardStats } from "@/lib/services/stats";

describe("store facade selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearMemoryStore();
  });

  it("uses local fallback when USE_REMOTE_JSON_STORE is not true", () => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    expect(usesRemoteJsonStore()).toBe(false);
    expect(getStorageMode()).toBe("local");
  });

  it("selects remote when USE_REMOTE_JSON_STORE=true", () => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "true");
    expect(usesRemoteJsonStore()).toBe(true);
    expect(getStorageMode()).toBe("remote");
  });
});

describe("store validation", () => {
  it("rejects invalid JSON structures", () => {
    expect(() => assertValidAppStore(null)).toThrow(StoreValidationError);
    expect(() => assertValidAppStore({})).toThrow(StoreValidationError);
    expect(() =>
      assertValidAppStore({
        family: {},
        users: [],
        members: [],
        questions: [],
        answers: [],
        decisions: [],
        sessions: [],
        settings: {},
        current_user_id: "user_sam",
      }),
    ).not.toThrow();
  });
});

describe("local store product persistence", () => {
  afterEach(() => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    clearMemoryStore();
  });

  it("persists answers, decisions, sessions and dashboard stats", async () => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    clearMemoryStore();

    const store = await readStore();
    const question =
      store.questions.find(
        (q) => !store.answers.some((a) => a.question_id === q.id && a.is_shared),
      ) ?? store.questions[5];

    await saveAnswer({
      question_id: question.id,
      is_shared: true,
      payload: { text: "Trip mode persistence check" },
      status: "in_discussion",
      confidence: 3,
    });

    clearMemoryStore();
    const afterAnswer = await readStore();
    expect(
      afterAnswer.answers.some(
        (a) =>
          a.question_id === question.id &&
          a.payload.text === "Trip mode persistence check",
      ),
    ).toBe(true);

    await saveDecision({
      title: "Trip decision",
      statement: "We will keep the remote JSON bridge until auth is stable.",
      status: "decided",
      confidence: 4,
      decision_type: "operational",
      outcome_ids: [store.outcomes[0].id],
      categories: ["parent_partnership"],
      source_question_ids: [question.id],
    });

    const sessionId = await createSession({
      title: "Trip session",
      length: "quick",
      filters: { only_unanswered: true },
      babymoon_mode: false,
    });

    clearMemoryStore();
    const next = await readStore();
    expect(next.decisions.some((d) => d.title === "Trip decision")).toBe(true);
    expect(next.sessions.some((s) => s.id === sessionId)).toBe(true);
    const detail = await getSession(sessionId);
    expect(detail?.session.id).toBe(sessionId);

    const stats = await getDashboardStats();
    expect(stats.questionsAnswered).toBeGreaterThan(0);
  });

  it("supports Sam and Michelle separate answers", async () => {
    vi.stubEnv("USE_REMOTE_JSON_STORE", "false");
    clearMemoryStore();
    const store = await readStore();
    const question = store.questions[2];
    const sam = store.members.find((m) => m.display_name === "Sam")!;
    const michelle = store.members.find((m) => m.display_name === "Michelle")!;

    await saveAnswer({
      question_id: question.id,
      is_shared: false,
      member_id: sam.id,
      payload: { text: "Sam trip view" },
      status: "in_discussion",
      confidence: null,
    });
    await saveAnswer({
      question_id: question.id,
      is_shared: false,
      member_id: michelle.id,
      payload: { text: "Michelle trip view" },
      status: "in_discussion",
      confidence: null,
    });

    clearMemoryStore();
    const answers = (await readStore()).answers.filter(
      (a) => a.question_id === question.id && !a.is_shared,
    );
    expect(answers.some((a) => a.payload.text === "Sam trip view")).toBe(true);
    expect(answers.some((a) => a.payload.text === "Michelle trip view")).toBe(
      true,
    );
  });
});

describe("remote store adapter source contracts", () => {
  it("keeps service-role usage server-side only", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/db/remote-json-store.ts"),
      "utf8",
    );
    expect(source).toMatch(/createSupabaseAdminClient/);
    expect(source).toMatch(/replace_family_json_store/);
    expect(source).toMatch(/MAX_UPDATE_RETRIES/);
  });

  it("migration revokes browser access", async () => {
    const sql = await fs.readFile(
      path.join(process.cwd(), "supabase/migrations/0003_remote_json_store.sql"),
      "utf8",
    );
    expect(sql).toMatch(/family_json_stores/);
    expect(sql).toMatch(/family_json_store_versions/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on table public\.family_json_stores from anon/);
    expect(sql).toMatch(/replace_family_json_store/);
    expect(sql).toMatch(/offset 50/);
  });
});
