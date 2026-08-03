/**
 * Form identity + draft scoping for conversation / essentials editors.
 * Never reuse draft state across question or actor boundaries.
 */

export type FormIdentity = {
  sessionId: string;
  sessionItemId: string;
  questionId: string;
  actor?: string;
  screenGroup?: string;
};

export function formIdentityKey(id: FormIdentity): string {
  return [
    id.sessionId,
    id.sessionItemId,
    id.questionId,
    id.actor ?? "both",
    id.screenGroup ?? "",
  ].join(":");
}

export function draftStorageKey(
  familyId: string,
  identity: FormIdentity,
): string {
  return [
    "conversation-draft",
    familyId,
    identity.sessionId,
    identity.sessionItemId,
    identity.questionId,
    identity.actor ?? "both",
  ].join(":");
}

export type ConversationDraftPayload = {
  identityKey: string;
  samChoices: string[];
  michelleChoices: string[];
  samText: string;
  michelleText: string;
  samExplain: string;
  michelleExplain: string;
  samScale: number | null;
  michelleScale: number | null;
  customSam: string;
  customMichelle: string;
  sharedText: string;
  updatedAt: string;
};

const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function readDraft(key: string): ConversationDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationDraftPayload;
    if (!parsed?.identityKey || !parsed.updatedAt) return null;
    if (Date.now() - Date.parse(parsed.updatedAt) > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: ConversationDraftPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export type SavePayloadAssertionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function assertSaveIdentity(input: {
  expectedSessionId: string;
  expectedSessionItemId: string;
  expectedQuestionId: string;
  payloadSessionId: string;
  payloadSessionItemId: string;
  payloadQuestionId: string;
}): SavePayloadAssertionResult {
  if (input.payloadSessionId !== input.expectedSessionId) {
    return { ok: false, reason: "session_mismatch" };
  }
  if (input.payloadSessionItemId !== input.expectedSessionItemId) {
    return { ok: false, reason: "session_item_mismatch" };
  }
  if (input.payloadQuestionId !== input.expectedQuestionId) {
    return { ok: false, reason: "question_mismatch" };
  }
  return { ok: true };
}

export function assertSelectedOptionsValid(
  selected: string[],
  validValues: string[],
  allowCustom: boolean,
): SavePayloadAssertionResult {
  if (allowCustom || validValues.length === 0) return { ok: true };
  const allowed = new Set(validValues);
  for (const opt of selected) {
    if (!allowed.has(opt)) {
      return { ok: false, reason: "stale_option" };
    }
  }
  return { ok: true };
}

export const STALE_PAYLOAD_USER_MESSAGE =
  "This answer no longer matches the current question. Reload and retry.";
