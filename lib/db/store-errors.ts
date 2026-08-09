import type { AppStore } from "@/lib/types/models";
import { ensureConversationQuestionOptions } from "@/lib/conversations/ensure-options";

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

  // Checklist collections are optional on older stores — normalize in place.
  if (!Array.isArray(store.checklist_instances)) {
    (store as { checklist_instances: unknown[] }).checklist_instances = [];
  }
  if (!Array.isArray(store.checklist_tasks)) {
    (store as { checklist_tasks: unknown[] }).checklist_tasks = [];
  }
  if (!Array.isArray(store.conversation_sessions)) {
    (store as { conversation_sessions: unknown[] }).conversation_sessions = [];
  }
  if (!Array.isArray(store.conversation_session_items)) {
    (store as { conversation_session_items: unknown[] }).conversation_session_items =
      [];
  }
  if (!Array.isArray(store.conversation_quick_answers)) {
    (store as { conversation_quick_answers: unknown[] }).conversation_quick_answers =
      [];
  }
  if (!Array.isArray(store.conversation_differences)) {
    (store as { conversation_differences: unknown[] }).conversation_differences =
      [];
  }
  if (!Array.isArray(store.qa_runs)) {
    (store as { qa_runs: unknown[] }).qa_runs = [];
  }
  if (!Array.isArray(store.principle_proposal_feedback)) {
    (store as { principle_proposal_feedback: unknown[] }).principle_proposal_feedback =
      [];
  }

  // Soft-normalize Before Baby scheduling settings on older stores.
  const settings = store.settings as Record<string, unknown>;
  if (!("expected_due_date" in settings)) settings.expected_due_date = null;
  if (!("before_baby_scheduling_mode" in settings)) {
    settings.before_baby_scheduling_mode = "recommended";
  }
  if (!("before_baby_preferred_task_days" in settings)) {
    settings.before_baby_preferred_task_days = [1, 2, 3, 4, 5];
  }
  if (!("before_baby_max_tasks_per_week" in settings)) {
    settings.before_baby_max_tasks_per_week = 8;
  }
  if (!("before_baby_weekend_heavy" in settings)) {
    settings.before_baby_weekend_heavy = false;
  }
  if (!("before_baby_include_post_birth" in settings)) {
    settings.before_baby_include_post_birth = true;
  }
  if (!("before_baby_hide_completed" in settings)) {
    settings.before_baby_hide_completed = false;
  }
  if (!("before_baby_avoid_travel_dates" in settings)) {
    settings.before_baby_avoid_travel_dates = [];
  }

  // Idempotent option backfill for known empty choice questions.
  if (Array.isArray(store.questions) && Array.isArray(store.question_options)) {
    ensureConversationQuestionOptions(store as unknown as AppStore);
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
    | "config"
    | "setup";

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
    "Another update was saved at the same time. Please retry.",
  not_found:
    "Remote family store is not set up yet. Ask an administrator to run the upload script.",
  validation: "Saved data failed validation. Download a backup and contact support.",
  config: "Remote storage is not configured. Ask an administrator for help.",
  setup:
    "Family storage is not set up yet. Ask an administrator to run family setup and upload the remote store.",
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

/** Safe structured fields from Supabase/Postgrest-like errors (never secrets). */
export function serializeStoreError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number | string;
} {
  if (error instanceof RemoteStoreError || error instanceof StoreValidationError) {
    return {
      name: error.name,
      message: error.message,
      code: error instanceof RemoteStoreError ? error.code : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name : "PostgrestError",
      message:
        typeof record.message === "string"
          ? record.message
          : "Unknown store error",
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
      status:
        typeof record.status === "number" || typeof record.status === "string"
          ? record.status
          : undefined,
    };
  }

  return {
    name: "unknown",
    message: String(error),
  };
}

export function logStoreError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[store] ${scope}`, {
    ...serializeStoreError(error),
    ...extra,
  });
}
