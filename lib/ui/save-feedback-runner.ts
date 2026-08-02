import {
  SAVED_FLASH_MS,
  SLOW_SAVE_MS,
  VERY_SLOW_SAVE_MS,
  SubmissionLock,
  classifySaveError,
  type SaveUiState,
} from "@/lib/ui/save-feedback";

export type SaveRunnerEvent =
  | { type: "state"; state: SaveUiState }
  | { type: "slow"; tier: 0 | 1 | 2 }
  | { type: "status"; message: string | null };

/**
 * Pure async save runner for unit tests and shared semantics with useSaveFeedback.
 * Keeps the card visible; never clears form values.
 */
export async function runSaveAttempt(args: {
  lock: SubmissionLock;
  execute: () => Promise<unknown>;
  advanceAfterSave?: boolean;
  onEvent?: (event: SaveRunnerEvent) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<{
  ok: boolean;
  duplicate?: boolean;
  state: SaveUiState;
  durationMs: number;
  mutationId?: string;
}> {
  const sleep = args.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = args.now ?? (() => Date.now());
  const emit = args.onEvent ?? (() => undefined);

  const acquired = args.lock.tryAcquire();
  if (!acquired.ok) {
    return { ok: false, duplicate: true, state: "saving", durationMs: 0 };
  }

  emit({ type: "state", state: "saving" });
  emit({ type: "status", message: "Saving…" });
  emit({ type: "slow", tier: 0 });

  const started = now();
  const slow1 = setTimeout(() => emit({ type: "slow", tier: 1 }), SLOW_SAVE_MS);
  const slow2 = setTimeout(() => emit({ type: "slow", tier: 2 }), VERY_SLOW_SAVE_MS);

  try {
    await args.execute();
    clearTimeout(slow1);
    clearTimeout(slow2);
    emit({ type: "slow", tier: 0 });
    emit({ type: "state", state: "saved" });
    emit({ type: "status", message: "Saved" });
    await sleep(SAVED_FLASH_MS);
    if (args.advanceAfterSave) {
      emit({ type: "state", state: "moving_to_next" });
      emit({ type: "status", message: "Loading next question…" });
    }
    args.lock.release({ mintNewKey: true });
    emit({ type: "state", state: "idle" });
    emit({ type: "status", message: null });
    return {
      ok: true,
      state: "idle",
      durationMs: now() - started,
      mutationId: acquired.key,
    };
  } catch (error) {
    clearTimeout(slow1);
    clearTimeout(slow2);
    const classified = classifySaveError(error);
    emit({ type: "slow", tier: 0 });
    emit({ type: "state", state: classified.state });
    emit({ type: "status", message: classified.message });
    args.lock.release({ mintNewKey: false });
    return {
      ok: false,
      state: classified.state,
      durationMs: now() - started,
      mutationId: acquired.key,
    };
  }
}
