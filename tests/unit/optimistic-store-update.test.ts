import { describe, expect, it } from "vitest";
import type { AppStore } from "@/lib/types/models";
import { RemoteStoreError } from "@/lib/db/store-errors";
import {
  MAX_UPDATE_RETRIES,
  conflictBackoffMs,
  runOptimisticStoreUpdate,
  type MutationLogFields,
  type OptimisticReplaceArgs,
} from "@/lib/db/optimistic-store-update";
import { promises as fs } from "fs";
import path from "path";

function minimalStore(overrides?: Partial<AppStore>): AppStore {
  return {
    family: {
      id: "family_t",
      name: "Turner Family",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    users: [
      {
        id: "user_sam",
        email: "sam@turner.family",
        display_name: "Sam",
        role: "parent",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    members: [
      {
        id: "member_sam",
        family_id: "family_t",
        user_id: "user_sam",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    questions: [],
    answers: [],
    answer_versions: [],
    decisions: [],
    decision_links: [],
    sessions: [],
    session_items: [],
    outcomes: [],
    principles: [],
    bookmarks: [],
    cooling_off_periods: [],
    review_reminders: [],
    activity_log: [],
    ai_outputs: [],
    playbook_snapshots: [],
    knowledge_items: [],
    checklist_instances: [],
    checklist_tasks: [],
    settings: {
      hide_partner_answers_until_both_saved: false,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 3,
      include_perspective_history_in_playbook: false,
    },
    current_user_id: "user_sam",
    ...overrides,
  } as AppStore;
}

type HistoryEntry = { version: number; store: AppStore; createdBy: string };

/** In-memory stand-in for the Postgres RPC + row lock. */
function createFakeRemote() {
  let version = 1;
  let store = minimalStore();
  const history: HistoryEntry[] = [];
  const mutations = new Map<string, number>();
  let replaceCalls = 0;
  let failNextConflicts = 0;
  let atomicFailAfterHistory = false;
  const logs: MutationLogFields[] = [];

  const gate = {
    chain: Promise.resolve() as Promise<unknown>,
    run<T>(fn: () => Promise<T> | T): Promise<T> {
      const next = this.chain.then(() => fn());
      this.chain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };

  return {
    logs,
    get version() {
      return version;
    },
    get store() {
      return structuredClone(store);
    },
    get history() {
      return history.map((h) => ({ ...h, store: structuredClone(h.store) }));
    },
    get replaceCalls() {
      return replaceCalls;
    },
    setConflictFailures(n: number) {
      failNextConflicts = n;
    },
    setAtomicFailAfterHistory(value: boolean) {
      atomicFailAfterHistory = value;
    },
    deps: {
      readRow: async () => ({
        store_data: structuredClone(store),
        version,
      }),
      replace: async (args: OptimisticReplaceArgs) =>
        gate.run(async () => {
          replaceCalls += 1;
          if (args.mutationId && mutations.has(args.mutationId)) {
            return {
              version: mutations.get(args.mutationId)!,
              idempotentReplay: true,
            };
          }
          if (failNextConflicts > 0) {
            failNextConflicts -= 1;
            throw new RemoteStoreError(
              "version_conflict",
              "Remote store version conflict.",
            );
          }
          if (version !== args.expectedVersion) {
            throw new RemoteStoreError(
              "version_conflict",
              "Remote store version conflict.",
            );
          }

          // Simulate history + update atomicity
          const prior = structuredClone(store);
          if (atomicFailAfterHistory) {
            atomicFailAfterHistory = false;
            throw new RemoteStoreError("unavailable", "Simulated mid-tx failure.");
          }
          history.push({
            version,
            store: prior,
            createdBy: args.createdBy,
          });
          store = structuredClone(args.store);
          version += 1;
          if (args.mutationId) {
            mutations.set(args.mutationId, version);
          }
          return { version };
        }),
      sleep: async () => undefined,
      random: () => 0.5,
      now: () => Date.now(),
      log: (fields: MutationLogFields) => {
        logs.push(fields);
      },
    },
  };
}

describe("conflictBackoffMs", () => {
  it("is immediate on first attempt and jittered later", () => {
    expect(conflictBackoffMs(1, () => 0)).toBe(0);
    expect(conflictBackoffMs(2, () => 0)).toBe(40);
    expect(conflictBackoffMs(2, () => 0.999)).toBe(250);
    expect(conflictBackoffMs(5, () => 0.5)).toBeGreaterThanOrEqual(40);
    expect(conflictBackoffMs(5, () => 0.5)).toBeLessThanOrEqual(250);
  });
});

describe("runOptimisticStoreUpdate", () => {
  it("performs one normal update and increments version", async () => {
    const remote = createFakeRemote();
    const result = await runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.answers.push({
          id: "a1",
          family_id: "family_t",
          question_id: "q1",
          member_id: null,
          is_shared: true,
          payload: { text: "hello" },
          status: "in_discussion",
          confidence: 3,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        });
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_normal" },
      remote.deps,
    );

    expect(result.answers).toHaveLength(1);
    expect(remote.version).toBe(2);
    expect(remote.history).toHaveLength(1);
    expect(remote.logs[0]?.conflict).toBe(false);
    expect(remote.logs[0]?.finalSavedVersion).toBe(2);
    expect(remote.logs[0]?.operation).toBe("saveAnswer");
  });

  it("skips unchanged writes", async () => {
    const remote = createFakeRemote();
    await runOptimisticStoreUpdate(
      "fam",
      (s) => s,
      { operation: "syncLocalIdentityFromAuth", mutationId: "mut_noop" },
      remote.deps,
    );
    expect(remote.version).toBe(1);
    expect(remote.replaceCalls).toBe(0);
    expect(remote.logs[0]?.skippedUnchanged).toBe(true);
  });

  it("applies two concurrent updates to different records without loss", async () => {
    const remote = createFakeRemote();
    const a = runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.answers.push({
          id: "ans_a",
          family_id: "family_t",
          question_id: "q_a",
          member_id: null,
          is_shared: true,
          payload: { text: "A" },
          status: "in_discussion",
          confidence: null,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        });
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_a" },
      remote.deps,
    );
    const b = runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.answers.push({
          id: "ans_b",
          family_id: "family_t",
          question_id: "q_b",
          member_id: null,
          is_shared: true,
          payload: { text: "B" },
          status: "in_discussion",
          confidence: null,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        });
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_b" },
      remote.deps,
    );

    await Promise.all([a, b]);
    expect(remote.store.answers.map((x) => x.id).sort()).toEqual(["ans_a", "ans_b"]);
    expect(remote.version).toBe(3);
  });

  it("applies two concurrent updates to the same record without lost update", async () => {
    const remote = createFakeRemote();
    // Seed one answer
    await runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.answers.push({
          id: "ans_shared",
          family_id: "family_t",
          question_id: "q1",
          member_id: null,
          is_shared: true,
          payload: { text: "v0" },
          status: "in_discussion",
          confidence: 1,
          bookmarked: false,
          needs_research: false,
          review_date: null,
          version: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        });
        return s;
      },
      { operation: "seed", mutationId: "mut_seed" },
      remote.deps,
    );

    const first = runOptimisticStoreUpdate(
      "fam",
      (s) => {
        const ans = s.answers.find((a) => a.id === "ans_shared")!;
        ans.payload = { text: `${ans.payload.text}+sam` };
        ans.version += 1;
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_same_1" },
      remote.deps,
    );
    const second = runOptimisticStoreUpdate(
      "fam",
      (s) => {
        const ans = s.answers.find((a) => a.id === "ans_shared")!;
        ans.payload = { text: `${ans.payload.text}+michelle` };
        ans.version += 1;
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_same_2" },
      remote.deps,
    );

    await Promise.all([first, second]);
    const text = remote.store.answers[0]?.payload.text ?? "";
    expect(text).toContain("sam");
    expect(text).toContain("michelle");
    expect(remote.version).toBe(4);
  });

  it("retries by rereading latest state and reapplying the mutation", async () => {
    const remote = createFakeRemote();
    remote.setConflictFailures(2);
    const seenVersions: number[] = [];

    await runOptimisticStoreUpdate(
      "fam",
      (s) => {
        seenVersions.push(remote.version);
        s.settings.babymoon_daily_questions = 9;
        return s;
      },
      { operation: "updateSettings", mutationId: "mut_retry" },
      remote.deps,
    );

    expect(seenVersions.length).toBe(3);
    expect(remote.version).toBe(2);
    expect(remote.store.settings.babymoon_daily_questions).toBe(9);
    expect(remote.logs.filter((l) => l.conflict)).toHaveLength(2);
    expect(remote.logs.at(-1)?.finalSavedVersion).toBe(2);
  });

  it("does not retry non-conflict errors", async () => {
    const remote = createFakeRemote();
    remote.deps.replace = async () => {
      throw new RemoteStoreError("unavailable", "down");
    };

    await expect(
      runOptimisticStoreUpdate(
        "fam",
        (s) => {
          s.settings.babymoon_daily_questions = 2;
          return s;
        },
        { operation: "x", mutationId: "mut_err" },
        remote.deps,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("keeps history and update atomic (failure after history aborts bump)", async () => {
    const remote = createFakeRemote();
    remote.setAtomicFailAfterHistory(true);
    await expect(
      runOptimisticStoreUpdate(
        "fam",
        (s) => {
          s.settings.babymoon_daily_questions = 4;
          return s;
        },
        { operation: "atomic", mutationId: "mut_atomic" },
        remote.deps,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(remote.version).toBe(1);
    expect(remote.history).toHaveLength(0);
    expect(remote.store.settings.babymoon_daily_questions).toBe(3);
  });

  it("treats duplicate mutation IDs as idempotent", async () => {
    const remote = createFakeRemote();
    await runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.settings.babymoon_daily_questions = 7;
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_dup" },
      remote.deps,
    );
    const versionAfterFirst = remote.version;
    await runOptimisticStoreUpdate(
      "fam",
      (s) => {
        s.settings.babymoon_daily_questions = 99;
        return s;
      },
      { operation: "saveAnswer", mutationId: "mut_dup" },
      remote.deps,
    );
    expect(remote.version).toBe(versionAfterFirst);
    expect(remote.store.settings.babymoon_daily_questions).toBe(7);
    expect(remote.logs.some((l) => l.idempotentReplay)).toBe(true);
  });

  it("exhausts retries and preserves the caller's intended mutation input", async () => {
    const remote = createFakeRemote();
    remote.setConflictFailures(MAX_UPDATE_RETRIES);
    const intended = { text: "keep this draft" };

    await expect(
      runOptimisticStoreUpdate(
        "fam",
        (s) => {
          s.answers.push({
            id: "draft",
            family_id: "family_t",
            question_id: "q",
            member_id: null,
            is_shared: true,
            payload: intended,
            status: "in_discussion",
            confidence: null,
            bookmarked: false,
            needs_research: false,
            review_date: null,
            version: 1,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          });
          return s;
        },
        { operation: "saveAnswer", mutationId: "mut_exhaust" },
        remote.deps,
      ),
    ).rejects.toMatchObject({ code: "version_conflict" });

    expect(intended.text).toBe("keep this draft");
    expect(remote.store.answers).toHaveLength(0);
    expect(remote.logs).toHaveLength(MAX_UPDATE_RETRIES);
  });

  it("handles five simultaneous writes without lost updates", async () => {
    const remote = createFakeRemote();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        runOptimisticStoreUpdate(
          "fam",
          (s) => {
            s.answers.push({
              id: `ans_${i}`,
              family_id: "family_t",
              question_id: `q_${i}`,
              member_id: null,
              is_shared: true,
              payload: { text: `t${i}` },
              status: "in_discussion",
              confidence: null,
              bookmarked: false,
              needs_research: false,
              review_date: null,
              version: 1,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            });
            return s;
          },
          { operation: "saveAnswer", mutationId: `mut_five_${i}` },
          remote.deps,
        ),
      ),
    );

    expect(remote.store.answers).toHaveLength(5);
    expect(remote.version).toBe(6);
    expect(new Set(remote.store.answers.map((a) => a.id)).size).toBe(5);
  });
});

describe("remote store source contracts", () => {
  it("uses five retries and optimistic helper", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/db/remote-json-store.ts"),
      "utf8",
    );
    expect(source).toMatch(/runOptimisticStoreUpdate/);
    expect(source).toMatch(/p_mutation_id/);
    expect(source).not.toMatch(/replaceWithRetry/);
  });

  it("migration adds mutation table and atomic RPC", async () => {
    const sql = await fs.readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/0006_remote_store_mutations.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/family_json_store_mutations/);
    expect(sql).toMatch(/idempotent_replay/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/family_json_store_versions/);
  });

  it("exports MAX_UPDATE_RETRIES = 5", async () => {
    expect(MAX_UPDATE_RETRIES).toBe(5);
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/db/optimistic-store-update.ts"),
      "utf8",
    );
    expect(source).toMatch(/MAX_UPDATE_RETRIES = 5/);
  });
});

describe("version conflict UX copy", () => {
  it("uses retry-oriented message", async () => {
    const { REMOTE_STORE_USER_MESSAGES } = await import("@/lib/db/store-errors");
    expect(REMOTE_STORE_USER_MESSAGES.version_conflict).toBe(
      "Another update was saved at the same time. Please retry.",
    );
  });
});

describe("duplicate write surfaces", () => {
  it("identity sync and answer save use distinct operation names", async () => {
    const bridge = await fs.readFile(
      path.join(process.cwd(), "lib/auth/local-bridge.ts"),
      "utf8",
    );
    const answers = await fs.readFile(
      path.join(process.cwd(), "lib/services/answers.ts"),
      "utf8",
    );
    const emergency = await fs.readFile(
      path.join(process.cwd(), "lib/auth/emergency-identity.ts"),
      "utf8",
    );
    expect(bridge).toMatch(/operation: "syncLocalIdentityFromAuth"/);
    expect(answers).toMatch(/operation: "saveAnswer"/);
    expect(emergency).toMatch(/operation: "syncEmergencyActorToStore"/);
  });
});
