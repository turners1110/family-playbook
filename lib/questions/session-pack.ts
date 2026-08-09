/**
 * Pack library questions into a time budget using estimated_minutes.
 * Avoids starting a major discussion when little time remains.
 */
import type { Question } from "@/lib/types/models";

export function packQuestionsByMinutes(
  candidates: Question[],
  budgetMinutes: number,
): Question[] {
  if (budgetMinutes <= 0) return candidates;
  const selected: Question[] = [];
  let used = 0;

  for (const q of candidates) {
    const minutes = Math.max(1, q.estimated_minutes || 8);
    if (selected.length === 0) {
      selected.push(q);
      used += minutes;
      if (minutes >= budgetMinutes * 0.7) break;
      continue;
    }
    // Don't start a deep question with only a few minutes left
    if (minutes >= 15 && budgetMinutes - used < 8) break;
    if (used + minutes > budgetMinutes + 2) break;
    selected.push(q);
    used += minutes;
    if (used >= budgetMinutes) break;
  }
  return selected;
}

export function aboutMinutesForQuestions(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + Math.max(1, q.estimated_minutes || 8), 0);
}
