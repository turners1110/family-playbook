/**
 * Privacy guard for research/Decision synthesis contexts.
 * Hidden partner answer text must never enter AI/research/export payloads.
 */
import type { Answer, AnswerPayload } from "@/lib/types/models";
import { formatAnswerPayload } from "@/lib/questions/answer-display";

export function isPartnerHiddenAnswer(
  answer: Answer & { _partner_hidden?: boolean },
): boolean {
  return Boolean(answer._partner_hidden);
}

/** Strip payloads that must not reach synthesis / exports / search. */
export function sanitizeAnswersForResearchContext(
  answers: Array<Answer & { _partner_hidden?: boolean }>,
): Array<{ id: string; is_shared: boolean; readable: string }> {
  return answers
    .filter((a) => !isPartnerHiddenAnswer(a))
    .map((a) => ({
      id: a.id,
      is_shared: a.is_shared,
      readable: formatAnswerPayload(a.payload as AnswerPayload),
    }))
    .filter((a) => a.readable.trim().length > 0);
}

export function assertNoHiddenPartnerLeak(blob: string, forbiddenSnippets: string[]) {
  for (const snippet of forbiddenSnippets) {
    if (!snippet.trim()) continue;
    if (blob.includes(snippet)) {
      throw new Error("Hidden partner answer leaked into research context");
    }
  }
}
