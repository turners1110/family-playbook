import { getQaQuestion } from "@/lib/qa/question-pack";

export function validateShortTextLength(
  promptId: string,
  text: string,
): { ok: true } | { ok: false; message: string } {
  const q = getQaQuestion(promptId);
  const max = q?.short_text_max_length ?? q?.max_length;
  if (max != null && text.length > max) {
    return {
      ok: false,
      message: `Answer must be at most ${max} characters (got ${text.length}). Nothing was saved.`,
    };
  }
  return { ok: true };
}
