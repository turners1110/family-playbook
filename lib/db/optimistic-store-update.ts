import type { AppStore } from "@/lib/types/models";
import { assertValidAppStore, RemoteStoreError } from "@/lib/db/store-errors";

export const MAX_UPDATE_RETRIES = 5;

export type UpdateStoreOptions = {
  operation?: string;
  mutationId?: string;
};

export type OptimisticReplaceArgs = {
  familyId: string;
  expectedVersion: number;
  store: AppStore;
  createdBy: string;
  mutationId: string;
};

export type OptimisticReplaceResult = {
  version: number;
  /** True when this mutation_id was already applied; caller should re-read. */
  idempotentReplay?: boolean;
};

export type OptimisticUpdateDeps = {
  readRow: (familyId: string) => Promise<{
    store_data: unknown;
    version: number | string;
  }>;
  replace: (args: OptimisticReplaceArgs) => Promise<OptimisticReplaceResult>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  log?: (fields: MutationLogFields) => void;
};

export type MutationLogFields = {
  mutationId: string;
  operation: string;
  startingVersion: number;
  attemptedVersion: number;
  retryNumber: number;
  conflict: boolean;
  finalSavedVersion: number | null;
  durationMs: number;
  skippedUnchanged?: boolean;
  idempotentReplay?: boolean;
};

export function asStoreVersion(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new RemoteStoreError("validation", "Invalid store version.");
  }
  return n;
}

/** attempt is 1-based; attempt 1 is immediate, later attempts use 40–250ms jitter. */
export function conflictBackoffMs(attempt: number, random: () => number = Math.random): number {
  if (attempt <= 1) return 0;
  return 40 + Math.floor(random() * 211);
}

export function storesStructurallyEqual(a: AppStore, b: AppStore): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultLog(fields: MutationLogFields) {
  console.info("[store] mutation", fields);
}

/**
 * Optimistic update loop:
 * read latest → apply mutation → validate → conditional replace.
 * On version_conflict only: backoff, reread, reapply (never reuse stale snapshot/version/JSON).
 */
export async function runOptimisticStoreUpdate(
  familyId: string,
  updater: (store: AppStore) => AppStore | void,
  options: UpdateStoreOptions | undefined,
  deps: OptimisticUpdateDeps,
): Promise<AppStore> {
  const mutationId = options?.mutationId ?? `mut_${Date.now().toString(36)}`;
  const operation = options?.operation ?? "updateStore";
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? defaultLog;
  const startedAt = now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPDATE_RETRIES; attempt += 1) {
    if (attempt > 1) {
      await sleep(conflictBackoffMs(attempt, random));
    }

    const row = await deps.readRow(familyId);
    const startingVersion = asStoreVersion(row.version);
    assertValidAppStore(row.store_data);
    const baseline = structuredClone(row.store_data);
    const draft = structuredClone(row.store_data);
    const result = updater(draft) ?? draft;
    assertValidAppStore(result);

    if (storesStructurallyEqual(baseline, result)) {
      log({
        mutationId,
        operation,
        startingVersion,
        attemptedVersion: startingVersion,
        retryNumber: attempt,
        conflict: false,
        finalSavedVersion: startingVersion,
        durationMs: now() - startedAt,
        skippedUnchanged: true,
      });
      return structuredClone(result);
    }

    try {
      const replaced = await deps.replace({
        familyId,
        expectedVersion: startingVersion,
        store: result,
        createdBy: operation,
        mutationId,
      });

      if (replaced.idempotentReplay) {
        const latest = await deps.readRow(familyId);
        assertValidAppStore(latest.store_data);
        log({
          mutationId,
          operation,
          startingVersion,
          attemptedVersion: startingVersion,
          retryNumber: attempt,
          conflict: false,
          finalSavedVersion: asStoreVersion(latest.version),
          durationMs: now() - startedAt,
          idempotentReplay: true,
        });
        return structuredClone(latest.store_data);
      }

      log({
        mutationId,
        operation,
        startingVersion,
        attemptedVersion: startingVersion,
        retryNumber: attempt,
        conflict: false,
        finalSavedVersion: replaced.version,
        durationMs: now() - startedAt,
      });
      return structuredClone(result);
    } catch (error) {
      lastError = error;
      const isConflict =
        error instanceof RemoteStoreError && error.code === "version_conflict";

      log({
        mutationId,
        operation,
        startingVersion,
        attemptedVersion: startingVersion,
        retryNumber: attempt,
        conflict: isConflict,
        finalSavedVersion: null,
        durationMs: now() - startedAt,
      });

      if (isConflict && attempt < MAX_UPDATE_RETRIES) {
        continue;
      }
      break;
    }
  }

  if (lastError instanceof RemoteStoreError) throw lastError;
  throw new RemoteStoreError(
    "version_conflict",
    "Could not save after repeated version conflicts.",
  );
}
