import { readStore, updateStore, nowIso, id } from "@/lib/db/local-store";
import type { Answer, AnswerVersion } from "@/lib/types/models";
import { saveAnswerSchema, type SaveAnswerInput } from "@/lib/validation/schemas";

export async function listAnswersForQuestion(questionId: string) {
  const store = await readStore();
  return store.answers.filter((a) => a.question_id === questionId);
}

export async function getAnswerHistory(answerId: string) {
  const store = await readStore();
  return store.answer_versions
    .filter((v) => v.answer_id === answerId)
    .sort((a, b) => a.version - b.version);
}

export async function saveAnswer(input: SaveAnswerInput, actorId?: string) {
  const data = saveAnswerSchema.parse(input);
  const timestamp = nowIso();

  return updateStore((store) => {
    const changedBy = actorId ?? store.current_user_id;
    const existing = store.answers.find((a) => {
      if (a.question_id !== data.question_id) return false;
      if (data.is_shared) return a.is_shared;
      return !a.is_shared && a.member_id === data.member_id;
    });

    if (existing) {
      const nextVersion = existing.version + 1;
      const version: AnswerVersion = {
        id: id("av"),
        answer_id: existing.id,
        version: nextVersion,
        payload: data.payload,
        status: data.status,
        confidence: data.confidence,
        changed_by: changedBy,
        change_reason: data.change_reason ?? "Updated answer",
        created_at: timestamp,
      };
      store.answer_versions.push(version);
      existing.payload = data.payload;
      existing.status = data.status;
      existing.confidence = data.confidence;
      existing.needs_research = data.needs_research ?? existing.needs_research;
      existing.review_date =
        data.review_date !== undefined ? data.review_date : existing.review_date;
      existing.bookmarked =
        data.bookmarked !== undefined ? data.bookmarked : existing.bookmarked;
      existing.version = nextVersion;
      existing.updated_at = timestamp;
      store.activity_log.unshift({
        id: id("act"),
        family_id: store.family.id,
        actor_id: changedBy,
        event_type: "answer_updated",
        entity_type: "answer",
        entity_id: existing.id,
        metadata: { question_id: data.question_id, version: nextVersion },
        created_at: timestamp,
      });
      return store;
    }

    const answer: Answer = {
      id: id("answer"),
      family_id: store.family.id,
      question_id: data.question_id,
      member_id: data.is_shared ? null : (data.member_id ?? null),
      is_shared: data.is_shared,
      payload: data.payload,
      status: data.status,
      confidence: data.confidence,
      bookmarked: data.bookmarked ?? false,
      needs_research: data.needs_research ?? false,
      review_date: data.review_date ?? null,
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.answers.push(answer);
    store.answer_versions.push({
      id: id("av"),
      answer_id: answer.id,
      version: 1,
      payload: data.payload,
      status: data.status,
      confidence: data.confidence,
      changed_by: changedBy,
      change_reason: data.change_reason ?? "Initial answer",
      created_at: timestamp,
    });
    store.activity_log.unshift({
      id: id("act"),
      family_id: store.family.id,
      actor_id: changedBy,
      event_type: "answer_created",
      entity_type: "answer",
      entity_id: answer.id,
      metadata: { question_id: data.question_id },
      created_at: timestamp,
    });
    return store;
  });
}

export function canRevealPartnerAnswers(
  hideUntilBoth: boolean,
  samSaved: boolean,
  michelleSaved: boolean,
  forceReveal: boolean,
) {
  if (forceReveal) return true;
  if (!hideUntilBoth) return true;
  return samSaved && michelleSaved;
}

export async function getSeparateAnswerState(questionId: string) {
  const store = await readStore();
  const sam = store.members.find((m) => m.display_name === "Sam");
  const michelle = store.members.find((m) => m.display_name === "Michelle");
  const answers = store.answers.filter((a) => a.question_id === questionId);
  const samAnswer = answers.find((a) => a.member_id === sam?.id);
  const michelleAnswer = answers.find((a) => a.member_id === michelle?.id);
  const shared = answers.find((a) => a.is_shared);
  const reveal = canRevealPartnerAnswers(
    store.settings.hide_partner_answers_until_both_saved,
    Boolean(samAnswer),
    Boolean(michelleAnswer),
    false,
  );
  return { sam, michelle, samAnswer, michelleAnswer, shared, reveal };
}
