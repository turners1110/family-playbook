/**
 * Filter partner answers before sending to the client.
 * Never leak partner answer payloads until reveal rules pass.
 */
import type { Answer, AppStore, FamilyMember } from "@/lib/types/models";
import { canRevealPartnerAnswers } from "@/lib/services/answers";

export type FilteredAnswersResult = {
  answers: Answer[];
  reveal: boolean;
  samSaved: boolean;
  michelleSaved: boolean;
  hiddenPartnerIds: string[];
};

function isParentAnswer(
  answer: Answer,
  sam?: FamilyMember,
  michelle?: FamilyMember,
): boolean {
  if (answer.is_shared || !answer.member_id) return false;
  return answer.member_id === sam?.id || answer.member_id === michelle?.id;
}

/**
 * Redact partner individual answers when hide-until-both is on and both
 * parents have not yet saved. Shared answers always pass through.
 */
export function filterAnswersForClient(input: {
  answers: Answer[];
  members: FamilyMember[];
  hideUntilBoth: boolean;
  currentMemberId: string;
  /** When false (shared-first with no separate UI), skip redaction. */
  separateEditorsVisible?: boolean;
}): FilteredAnswersResult {
  const sam = input.members.find((m) => m.display_name === "Sam");
  const michelle = input.members.find((m) => m.display_name === "Michelle");
  const samAnswer = input.answers.find((a) => a.member_id === sam?.id);
  const michelleAnswer = input.answers.find(
    (a) => a.member_id === michelle?.id,
  );
  const samSaved = Boolean(samAnswer);
  const michelleSaved = Boolean(michelleAnswer);
  const reveal = canRevealPartnerAnswers(
    input.hideUntilBoth,
    samSaved,
    michelleSaved,
    false,
  );

  if (!input.separateEditorsVisible || reveal || !input.hideUntilBoth) {
    return {
      answers: input.answers,
      reveal: true,
      samSaved,
      michelleSaved,
      hiddenPartnerIds: [],
    };
  }

  const hiddenPartnerIds: string[] = [];
  const answers = input.answers.map((a) => {
    if (!isParentAnswer(a, sam, michelle)) return a;
    if (a.member_id === input.currentMemberId) return a;
    // Partner saved answer — redact payload before client.
    hiddenPartnerIds.push(a.id);
    return {
      ...a,
      payload: {
        ...a.payload,
        text: undefined,
        quick: undefined,
        notes: undefined,
        choice: undefined,
        ranking: undefined,
        scale: undefined,
        agreement_notes: undefined,
        disagreement_notes: undefined,
        matrix: undefined,
        named_people: undefined,
      },
      _partner_hidden: true,
    } as Answer & { _partner_hidden?: boolean };
  });

  return {
    answers,
    reveal: false,
    samSaved,
    michelleSaved,
    hiddenPartnerIds,
  };
}

export function filterAnswersForQuestionPage(
  store: AppStore,
  questionId: string,
  currentMemberId: string,
  separateEditorsVisible: boolean,
): FilteredAnswersResult {
  const answers = (store.answers ?? []).filter(
    (a) => a.question_id === questionId,
  );
  return filterAnswersForClient({
    answers,
    members: store.members,
    hideUntilBoth: store.settings.hide_partner_answers_until_both_saved,
    currentMemberId,
    separateEditorsVisible,
  });
}
