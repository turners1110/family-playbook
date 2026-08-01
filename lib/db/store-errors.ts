import type { AppStore } from "@/lib/types/models";

/**
 * Minimal structural validation for AppStore JSON.
 * Rejects obvious garbage without pulling in the full Zod surface.
 */
export function assertValidAppStore(data: unknown): asserts data is AppStore {
  if (!data || typeof data !== "object") {
    throw new StoreValidationError("Store data must be a JSON object.");
  }
  const store = data as Record<string, unknown>;
  const requiredArrays = [
    "users",
    "members",
    "questions",
    "answers",
    "decisions",
    "sessions",
  ] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(store[key])) {
      throw new StoreValidationError(`Store is missing required array: ${key}.`);
    }
  }
  if (!store.family || typeof store.family !== "object") {
    throw new StoreValidationError("Store is missing family metadata.");
  }
  if (!store.settings || typeof store.settings !== "object") {
    throw new StoreValidationError("Store is missing settings.");
  }
  if (typeof store.current_user_id !== "string" || !store.current_user_id) {
    throw new StoreValidationError("Store is missing current_user_id.");
  }
}

export class StoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreValidationError";
  }
}

export class RemoteStoreError extends Error {
  code:
    | "unavailable"
    | "version_conflict"
    | "not_found"
    | "validation"
    | "config";

  constructor(
    code: RemoteStoreError["code"],
    message: string,
  ) {
    super(message);
    this.name = "RemoteStoreError";
    this.code = code;
  }
}

export const REMOTE_STORE_USER_MESSAGES = {
  unavailable:
    "Remote storage is temporarily unavailable. Do not enter new answers until storage is restored. Download a backup if you have recent changes.",
  version_conflict:
    "Someone else saved at the same time. Refresh the page and try again.",
  not_found:
    "Remote family store is not set up yet. Ask an administrator to run the upload script.",
  validation: "Saved data failed validation. Download a backup and contact support.",
  config: "Remote storage is not configured. Ask an administrator for help.",
} as const;

export function publicRemoteStoreMessage(error: unknown): string {
  if (error instanceof RemoteStoreError) {
    return REMOTE_STORE_USER_MESSAGES[error.code];
  }
  if (error instanceof StoreValidationError) {
    return REMOTE_STORE_USER_MESSAGES.validation;
  }
  return REMOTE_STORE_USER_MESSAGES.unavailable;
}

export function logStoreError(scope: string, error: unknown) {
  console.error(`[store] ${scope}`, {
    name: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : String(error),
    code: error instanceof RemoteStoreError ? error.code : undefined,
  });
}
