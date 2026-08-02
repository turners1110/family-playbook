"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SAVED_FLASH_MS,
  SLOW_SAVE_MS,
  VERY_SLOW_SAVE_MS,
  classifySaveError,
  createIdempotencyKey,
  logSaveTiming,
  type SaveTimingLog,
  type SaveUiState,
} from "@/lib/ui/save-feedback";

type RunOptions = {
  operation: string;
  route?: string;
  sessionId?: string | null;
  testRunId?: string | null;
  questionId?: string | null;
  /** When true, after saved flash move to moving_to_next. */
  advanceAfterSave?: boolean;
  onSuccess?: () => void | Promise<void>;
};

export function useSaveFeedback() {
  const [state, setState] = useState<SaveUiState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [slowTier, setSlowTier] = useState<0 | 1 | 2>(0);
  const [showLeaveGuard, setShowLeaveGuard] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const lockRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastRunRef = useRef<(() => Promise<unknown>) | null>(null);
  const lastOptionsRef = useRef<RunOptions | null>(null);
  const timersRef = useRef<number[]>([]);
  const leaveResolverRef = useRef<((stay: boolean) => void) | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const isBusy =
    state === "saving" || state === "saved" || state === "moving_to_next";

  const ensureIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey("mut");
    }
    return idempotencyKeyRef.current;
  }, []);

  const resetIdempotencyKey = useCallback(() => {
    idempotencyKeyRef.current = null;
  }, []);

  const runSave = useCallback(
    async (fn: () => Promise<unknown>, options: RunOptions) => {
      if (lockRef.current) return { ok: false as const, duplicate: true };
      lockRef.current = true;
      lastRunRef.current = fn;
      lastOptionsRef.current = options;
      clearTimers();
      setSlowTier(0);
      setStatusMessage(null);
      setState("saving");

      const key = ensureIdempotencyKey();
      const started = performance.now();
      timersRef.current.push(
        window.setTimeout(() => setSlowTier(1), SLOW_SAVE_MS),
        window.setTimeout(() => setSlowTier(2), VERY_SLOW_SAVE_MS),
      );

      try {
        await fn();
        clearTimers();
        const durationMs = performance.now() - started;
        const log: SaveTimingLog = {
          operation: options.operation,
          route: options.route,
          sessionId: options.sessionId,
          testRunId: options.testRunId,
          questionId: options.questionId,
          durationMs,
          result: "success",
          retryCount,
          conflict: false,
          stage: "total",
        };
        logSaveTiming(log);

        setState("saved");
        setStatusMessage("Saved");
        await new Promise((r) => {
          const t = window.setTimeout(r, SAVED_FLASH_MS);
          timersRef.current.push(t);
        });

        if (options.advanceAfterSave) {
          setState("moving_to_next");
          setStatusMessage("Loading next question…");
        }

        await options.onSuccess?.();
        resetIdempotencyKey();
        setState("idle");
        setStatusMessage(null);
        setSlowTier(0);
        setRetryCount(0);
        lockRef.current = false;
        return { ok: true as const, mutationId: key };
      } catch (error) {
        clearTimers();
        const classified = classifySaveError(error);
        const durationMs = performance.now() - started;
        logSaveTiming({
          operation: options.operation,
          route: options.route,
          sessionId: options.sessionId,
          testRunId: options.testRunId,
          questionId: options.questionId,
          durationMs,
          result: classified.state === "conflict" ? "conflict" : "failed",
          retryCount,
          conflict: classified.state === "conflict",
          stage: "total",
        });
        setState(classified.state);
        setStatusMessage(classified.message);
        setSlowTier(0);
        // Keep lock released so Retry works; keep same idempotency key for retry of same attempt
        // Spec: "Do not create a new idempotency key during automatic rerenders"
        // On explicit Retry we should mint a new key.
        lockRef.current = false;
        return { ok: false as const, error };
      }
    },
    [clearTimers, ensureIdempotencyKey, resetIdempotencyKey, retryCount],
  );

  const retry = useCallback(async () => {
    if (!lastRunRef.current || !lastOptionsRef.current) return;
    resetIdempotencyKey();
    setRetryCount((n) => n + 1);
    await runSave(lastRunRef.current, lastOptionsRef.current);
  }, [resetIdempotencyKey, runSave]);

  const requestLeave = useCallback(async (): Promise<boolean> => {
    if (!isBusy) return true;
    setShowLeaveGuard(true);
    return new Promise((resolve) => {
      leaveResolverRef.current = (stay) => {
        setShowLeaveGuard(false);
        resolve(!stay);
      };
    });
  }, [isBusy]);

  const confirmStay = useCallback(() => {
    leaveResolverRef.current?.(true);
    leaveResolverRef.current = null;
  }, []);

  const confirmLeave = useCallback(() => {
    leaveResolverRef.current?.(false);
    leaveResolverRef.current = null;
  }, []);

  useEffect(() => {
    if (!isBusy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isBusy]);

  return {
    state,
    statusMessage,
    slowTier,
    isBusy,
    showLeaveGuard,
    mutationId: ensureIdempotencyKey,
    runSave,
    retry,
    requestLeave,
    confirmStay,
    confirmLeave,
    setIdle: () => {
      setState("idle");
      setStatusMessage(null);
    },
  };
}
