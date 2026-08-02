export type SaveUiState =
  | "idle"
  | "saving"
  | "saved"
  | "moving_to_next"
  | "conflict"
  | "failed";

export type SaveTimingStage =
  | "server_action"
  | "remote_read"
  | "mutation"
  | "retry_delay"
  | "revalidation"
  | "next_card_render"
  | "total";

export type SaveTimingLog = {
  operation: string;
  route?: string;
  sessionId?: string | null;
  testRunId?: string | null;
  questionId?: string | null;
  durationMs: number;
  result: "success" | "conflict" | "failed" | "duplicate_noop";
  retryCount: number;
  conflict: boolean;
  stage?: SaveTimingStage;
};

export function createIdempotencyKey(prefix = "save"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function classifySaveError(error: unknown): {
  state: "conflict" | "failed";
  message: string;
} {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  if (
    code === "version_conflict" ||
    /another update was saved|version conflict|retry/i.test(message)
  ) {
    return {
      state: "conflict",
      message: "Another update was saved first. Retry to keep your answer.",
    };
  }
  return {
    state: "failed",
    message: message || "Couldn’t save. Your answer is still on this screen.",
  };
}

/** Safe timing log — Never includes answer text or secrets. */
export function logSaveTiming(entry: SaveTimingLog) {
  console.info("[save_timing]", {
    operation: entry.operation,
    route: entry.route ?? null,
    sessionId: entry.sessionId ?? null,
    testRunId: entry.testRunId ?? null,
    questionId: entry.questionId ?? null,
    durationMs: Math.round(entry.durationMs),
    result: entry.result,
    retryCount: entry.retryCount,
    conflict: entry.conflict,
    stage: entry.stage ?? "total",
  });
}

export const SLOW_SAVE_MS = 1500;
export const VERY_SLOW_SAVE_MS = 4000;
export const SAVED_FLASH_MS = 450;

export function saveButtonIdleLabel(state: SaveUiState, idleLabel: string): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "moving_to_next":
      return "Loading next question…";
    case "failed":
    case "conflict":
      return "Couldn’t save";
    default:
      return idleLabel;
  }
}

export function slowSaveMessage(tier: 0 | 1 | 2): string | null {
  if (tier === 1) return "Still saving securely…";
  if (tier === 2) {
    return "This is taking longer than usual. Your answer is still on this screen.";
  }
  return null;
}

/** Client-side submission lock used by save flows (testable without React). */
export class SubmissionLock {
  private locked = false;
  private key: string | null = null;

  tryAcquire(): { ok: true; key: string } | { ok: false } {
    if (this.locked) return { ok: false };
    this.locked = true;
    if (!this.key) this.key = createIdempotencyKey("mut");
    return { ok: true, key: this.key };
  }

  release(opts?: { mintNewKey?: boolean }) {
    this.locked = false;
    if (opts?.mintNewKey) this.key = null;
  }

  currentKey() {
    return this.key;
  }

  get isLocked() {
    return this.locked;
  }
}
