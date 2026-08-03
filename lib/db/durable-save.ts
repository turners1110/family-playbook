import { createHash } from "crypto";
import type { AppStore } from "@/lib/types/models";
import { getStorageMode, usesRemoteJsonStore } from "@/lib/db/store";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import { RemoteStoreError } from "@/lib/db/store-errors";

export type DurableSaveAck = {
  ok: true;
  mutationSucceeded: true;
  verified: true;
  storageMode: "remote" | "local";
  version: number | null;
  questionId: string;
  sessionId: string;
  itemId: string;
  actors: Array<"sam" | "michelle" | "shared">;
  savedAt: string;
  advanced: boolean;
  currentItemIndex: number | null;
  durationMs: {
    mutation: number;
    verification: number;
    total: number;
  };
};

export type DurableSaveFailure = {
  ok: false;
  verified: false;
  error: string;
  code?: string;
};

/** Fingerprint of answer content without logging the text itself. */
export function answerContentFingerprint(input: {
  selectedOptions?: string[];
  shortText?: string | null;
  explanation?: string | null;
  scale?: number | null;
}): string {
  const payload = JSON.stringify({
    selectedOptions: input.selectedOptions ?? [],
    shortText: input.shortText ?? null,
    explanation: input.explanation ?? null,
    scale: input.scale ?? null,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function hashFamilyId(familyId: string): string {
  return createHash("sha256").update(familyId).digest("hex").slice(0, 12);
}

/**
 * Trip Mode must never accept writes against ephemeral local storage.
 * Production data loss root cause: UI said "Online Backup Enabled" while
 * USE_REMOTE_JSON_STORE was false → writes vanished after relaunch.
 */
export function assertDurableStorageForProductWrites(): void {
  if (isEmergencyAccessModeEnabled() && !usesRemoteJsonStore()) {
    throw new RemoteStoreError(
      "config",
      "Trip Mode is on but remote storage is not enabled. Answers would not survive app relaunch. Set USE_REMOTE_JSON_STORE=true.",
    );
  }
}

export function storageBackupLabel(): {
  tripMode: boolean;
  remote: boolean;
  label: string;
  warning: string | null;
} {
  const tripMode = isEmergencyAccessModeEnabled();
  const remote = usesRemoteJsonStore();
  if (!tripMode) {
    return {
      tripMode: false,
      remote,
      label: remote ? "Remote storage" : "Local storage",
      warning: null,
    };
  }
  if (remote) {
    return {
      tripMode: true,
      remote: true,
      label: "Trip Mode · Online backup on",
      warning: null,
    };
  }
  return {
    tripMode: true,
    remote: false,
    label: "Trip Mode · LOCAL ONLY",
    warning:
      "Online backup is OFF. Answers will not survive relaunch until USE_REMOTE_JSON_STORE=true.",
  };
}

export type VerifiedAnswerExpectation = {
  actor: "sam" | "michelle" | "shared";
  fingerprint: string;
};

/**
 * Read-back check: confirm saved records exist for the session item/actors.
 * Compares content fingerprints — never returns answer text.
 */
export function verifyConversationAnswersInStore(
  store: AppStore,
  input: {
    sessionId: string;
    itemId: string;
    promptId: string;
    expectations: VerifiedAnswerExpectation[];
    expectAdvanced?: boolean;
    previousIndex?: number;
  },
): {
  ok: boolean;
  reason?: string;
  versionHint?: number | null;
  currentItemIndex: number | null;
} {
  const session = store.conversation_sessions?.find(
    (s) => s.id === input.sessionId,
  );
  if (!session) {
    return { ok: false, reason: "session_missing", currentItemIndex: null };
  }
  if (session.family_id !== store.family.id) {
    return { ok: false, reason: "family_mismatch", currentItemIndex: null };
  }

  const item = store.conversation_session_items?.find(
    (i) => i.id === input.itemId && i.session_id === input.sessionId,
  );
  if (!item) {
    return {
      ok: false,
      reason: "item_missing",
      currentItemIndex: session.current_item_index,
    };
  }
  if (item.prompt_id !== input.promptId) {
    return {
      ok: false,
      reason: "prompt_mismatch",
      currentItemIndex: session.current_item_index,
    };
  }

  for (const expected of input.expectations) {
    const row = store.conversation_quick_answers?.find(
      (a) =>
        a.session_item_id === input.itemId && a.actor === expected.actor,
    );
    if (!row) {
      return {
        ok: false,
        reason: `answer_missing_${expected.actor}`,
        currentItemIndex: session.current_item_index,
      };
    }
    const fp = answerContentFingerprint({
      selectedOptions: row.selected_options,
      shortText: row.short_text,
      explanation: row.explanation,
      scale: row.scale,
    });
    if (fp !== expected.fingerprint) {
      return {
        ok: false,
        reason: `answer_mismatch_${expected.actor}`,
        currentItemIndex: session.current_item_index,
      };
    }
  }

  if (input.expectAdvanced && typeof input.previousIndex === "number") {
    if (session.current_item_index <= input.previousIndex) {
      return {
        ok: false,
        reason: "advance_not_applied",
        currentItemIndex: session.current_item_index,
      };
    }
  }

  return {
    ok: true,
    currentItemIndex: session.current_item_index,
  };
}

export function getPublicStorageMode() {
  return getStorageMode();
}
