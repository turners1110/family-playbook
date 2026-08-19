"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionSaveAnswer,
  actionStartCoolingOff,
  actionScheduleReview,
  actionToggleBookmark,
} from "@/lib/actions";
import type { Answer, FamilyMember, Question } from "@/lib/types/models";
import { DECISION_STATUSES, CONFIDENCE_LABELS } from "@/lib/constants/enums";
import type { SaveAnswerInput } from "@/lib/validation/schemas";
import {
  discussionModeIcon,
  resolveDiscussionMode,
  shouldShowSeparateEditors,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { parseResponseSchema } from "@/lib/questions/response-schema";
import { formatAnswerPayload } from "@/lib/questions/answer-display";
import { clientValidateStructuredAnswer } from "@/lib/questions/structured-client-validation";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  PendingNavigationGuard,
  SaveButton,
  SaveStatus,
} from "@/components/ui/save-feedback";
import {
  StructuredAnswerFields,
  structuredValueFromPayload,
  structuredValueToPayload,
  type StructuredAnswerValue,
} from "@/components/questions/StructuredAnswerFields";

type DiffLevel = "none" | "minor" | "major" | null;
type UiMode = "shared" | "separate";

export function AnswerEditor({
  question,
  questionId,
  members,
  answers,
  hideUntilBoth,
  currentMemberId,
}: {
  question?: Pick<
    Question,
    | "discussion_mode"
    | "discussion_reason"
    | "separate_answers_recommended"
    | "id"
    | "slug"
    | "short_title"
    | "text"
    | "categories"
    | "why_it_matters"
    | "response_schema"
  >;
  questionId: string;
  members: FamilyMember[];
  answers: Answer[];
  hideUntilBoth: boolean;
  currentMemberId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = useSaveFeedback();
  const busy = pending || save.isBusy;
  const sam = members.find((m) => m.display_name === "Sam");
  const michelle = members.find((m) => m.display_name === "Michelle");
  const shared = answers.find((a) => a.is_shared);
  const samAnswer = answers.find((a) => a.member_id === sam?.id);
  const michelleAnswer = answers.find((a) => a.member_id === michelle?.id);
  const hasSeparateAnswers = Boolean(samAnswer || michelleAnswer);

  const resolved = resolveDiscussionMode({
    question: question
      ? {
          id: question.id,
          slug: question.slug,
          short_title: question.short_title,
          text: question.text,
          categories: question.categories,
          why_it_matters: question.why_it_matters,
          separate_answers_recommended: question.separate_answers_recommended,
          discussion_mode: question.discussion_mode,
          discussion_reason: question.discussion_reason,
        }
      : null,
    hasSeparateAnswers,
    preferExistingSeparate: true,
  });
  const recommended = resolved.mode;

  const [eitherChoice, setEitherChoice] = useState<DiscussionMode | null>(
    () => {
      if (recommended !== "either") return null;
      if (typeof window === "undefined") return "shared_first";
      const pref = window.localStorage.getItem(
        "discussion_mode_pref_either",
      ) as DiscussionMode | null;
      if (pref === "shared_first" || pref === "separate_first") return pref;
      return null;
    },
  );

  const activeMode: DiscussionMode =
    recommended === "either"
      ? (eitherChoice ?? "shared_first")
      : recommended;

  const [uiMode, setUiMode] = useState<UiMode>(() =>
    shouldShowSeparateEditors({
      resolvedMode: activeMode,
      hasSeparateAnswers,
    })
      ? "separate"
      : "shared",
  );

  const schema = parseResponseSchema(question?.response_schema);
  const hasGuidedFormat =
    schema.mode !== "open_or_policy" && schema.version === 2;

  const [text, setText] = useState(shared?.payload.text ?? "");
  const [structured, setStructured] = useState<StructuredAnswerValue>(() =>
    structuredValueFromPayload(shared?.payload, schema),
  );
  const [useGuided, setUseGuided] = useState(true);
  const [samText, setSamText] = useState(samAnswer?.payload.text ?? "");
  const [michelleText, setMichelleText] = useState(
    michelleAnswer?.payload.text ?? "",
  );
  const [status, setStatus] = useState(shared?.status ?? "in_discussion");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(
    shared?.confidence ?? 3,
  );
  const [notes, setNotes] = useState(shared?.payload.notes ?? "");
  const [clientHint, setClientHint] = useState<string | null>(null);
  const [diffPrompt, setDiffPrompt] = useState<DiffLevel>(null);
  const [mergeNotes, setMergeNotes] = useState("");

  const priorOpenText =
    hasGuidedFormat &&
    shared?.payload.text &&
    !shared.payload.ranking &&
    !shared.payload.matrix &&
    !shared.payload.choice
      ? shared.payload.text
      : null;

  const bothSaved = Boolean(samAnswer && michelleAnswer);
  const reveal = !hideUntilBoth || bothSaved;
  const icon = discussionModeIcon(activeMode);

  const samVisible =
    reveal || currentMemberId === sam?.id || !samAnswer;
  const michelleVisible =
    reveal || currentMemberId === michelle?.id || !michelleAnswer;

  const agreementPreview = useMemo(() => {
    if (!samText.trim() || !michelleText.trim()) return null;
    if (samText.trim() === michelleText.trim()) {
      return { same: true as const, summary: samText.trim() };
    }
    return { same: false as const, summary: null };
  }, [samText, michelleText]);

  function runSaveAnswer(input: SaveAnswerInput, after?: () => void) {
    if (hasGuidedFormat && useGuided && input.is_shared) {
      const hint = clientValidateStructuredAnswer(schema, structured);
      if (hint) {
        setClientHint(hint);
        return;
      }
    }
    setClientHint(null);
    const payload: SaveAnswerInput = {
      ...input,
      mutation_id: input.mutation_id ?? save.mutationId(),
    };
    void save.runSave(async () => {
      const result = await actionSaveAnswer(payload);
      if (result && "ok" in result && result.ok === false) {
        throw new Error(result.error);
      }
      return result;
    }, {
      operation: "save_answer",
      route: "/questions",
      questionId,
      onSuccess: async () => {
        after?.();
        router.refresh();
      },
    });
  }

  function saveOther(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  function chooseEither(next: DiscussionMode) {
    setEitherChoice(next);
    setUiMode(next === "separate_first" ? "separate" : "shared");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("discussion_mode_pref_either", next);
    }
  }

  function captureSeparate() {
    setUiMode("separate");
    if (!samText && text) setSamText(text);
    if (!michelleText && text) setMichelleText(text);
  }

  function saveShared(options?: { afterSave?: () => void }) {
    const payload =
      hasGuidedFormat && useGuided
        ? structuredValueToPayload(
            structured,
            question?.response_schema,
            notes,
          )
        : { text, notes: notes || undefined };
    runSaveAnswer(
      {
        question_id: questionId,
        is_shared: true,
        payload: payload as SaveAnswerInput["payload"],
        status: status as never,
        confidence,
        change_reason: shared
          ? "Updated shared family decision"
          : "Created shared family decision",
      },
      options?.afterSave,
    );
  }

  const needsEitherChoice = recommended === "either" && eitherChoice === null;

  return (
    <div className="mt-4 space-y-4">
      <SaveStatus
        state={save.state}
        message={clientHint ?? save.statusMessage}
        slowTier={save.slowTier}
        onRetry={() => void save.retry()}
      />
      {clientHint ? (
        <p className="text-sm text-danger" role="alert">
          {clientHint}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span aria-hidden className="text-base">
          {icon.symbol}
        </span>
        <span>{icon.label}</span>
        {resolved.reason ? (
          <span className="text-ink-subtle">· {resolved.reason}</span>
        ) : null}
        {process.env.NODE_ENV === "development" ? (
          <span className="text-xs text-ink-subtle">
            · {resolved.source}
            {question?.discussion_mode
              ? ` · stored:${question.discussion_mode}`
              : " · stored:missing"}
          </span>
        ) : null}
      </div>

      {recommended === "either" ? (
        <fieldset className="surface space-y-2 p-4">
          <legend className="font-medium text-ink">
            How would you like to answer?
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="either-mode"
              checked={eitherChoice === "shared_first"}
              onChange={() => chooseEither("shared_first")}
            />
            Together
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="either-mode"
              checked={eitherChoice === "separate_first"}
              onChange={() => chooseEither("separate_first")}
            />
            Separately
          </label>
          <p className="text-xs text-ink-subtle">
            We remember this preference for similar questions on this device.
          </p>
        </fieldset>
      ) : null}

      {!needsEitherChoice && uiMode === "shared" ? (
        <section className="space-y-3">
          {priorOpenText ? (
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-sm">
              <p className="font-medium text-ink">Previous response</p>
              <p className="mt-1 text-ink-muted">
                This question now has a guided format. Your earlier answer is
                preserved.
              </p>
              <p className="mt-2 whitespace-pre-wrap text-ink">{priorOpenText}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setUseGuided(false);
                    setText(priorOpenText);
                  }}
                >
                  Use previous response
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setUseGuided(true)}
                >
                  Answer guided version
                </button>
              </div>
            </div>
          ) : null}
          <div className="field">
            <label className="font-display text-lg">
              Shared family decision
            </label>
            {hasGuidedFormat && useGuided ? (
              <div className="mt-2">
                <StructuredAnswerFields
                  schemaRaw={question?.response_schema}
                  value={structured}
                  onChange={setStructured}
                  disabled={busy}
                />
                {shared ? (
                  <p className="mt-2 text-xs text-ink-subtle whitespace-pre-wrap">
                    Saved view:{" "}
                    {formatAnswerPayload(
                      structuredValueToPayload(
                        structured,
                        question?.response_schema,
                        "",
                      ),
                      question?.response_schema,
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <textarea
                id="shared"
                className="textarea mt-2 min-h-40"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write what you decide together…"
              />
            )}
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {DECISION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="confidence">Confidence</label>
              <select
                id="confidence"
                className="select"
                value={confidence ?? ""}
                onChange={(e) =>
                  setConfidence(
                    e.target.value === ""
                      ? null
                      : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
                  )
                }
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {CONFIDENCE_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SaveButton
              state={save.state}
              idleLabel="Save"
              onClick={() =>
                saveShared({
                  afterSave: () => setDiffPrompt("none"),
                })
              }
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={captureSeparate}
            >
              Capture separate perspectives
            </button>
          </div>
        </section>
      ) : null}

      {diffPrompt !== null && uiMode === "shared" ? (
        <section className="surface space-y-3 p-4" role="status">
          <p className="font-medium">
            Did this discussion uncover meaningful differences?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDiffPrompt(null)}
            >
              No
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDiffPrompt("minor")}
            >
              Minor differences
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDiffPrompt("major");
                captureSeparate();
              }}
            >
              Major differences
            </button>
          </div>
          {diffPrompt === "minor" ? (
            <div className="field">
              <label htmlFor="minor-notes">Optional notes</label>
              <textarea
                id="minor-notes"
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary mt-2"
                disabled={busy}
                onClick={() => {
                  saveShared({ afterSave: () => setDiffPrompt(null) });
                }}
              >
                Save notes
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!needsEitherChoice && uiMode === "separate" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg">Separate perspectives</h3>
            {activeMode !== "separate_first" || hasSeparateAnswers ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setUiMode("shared")}
              >
                Back to shared
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="sam">Sam’s answer</label>
              {!samVisible ? (
                <p className="mb-2 text-sm text-ink-muted">
                  Partner answers stay hidden until both are saved.
                </p>
              ) : null}
              <textarea
                id="sam"
                className="textarea"
                value={samVisible ? samText : ""}
                onChange={(e) => setSamText(e.target.value)}
                disabled={!samVisible && Boolean(samAnswer)}
                placeholder={
                  !samVisible ? "Hidden until both answers are saved" : undefined
                }
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !sam || (!samVisible && Boolean(samAnswer))}
                onClick={() =>
                  runSaveAnswer({
                    question_id: questionId,
                    is_shared: false,
                    member_id: sam!.id,
                    payload: { text: samText },
                    status: "in_discussion",
                    confidence: null,
                  })
                }
              >
                Save Sam
              </button>
            </div>
            <div className="field">
              <label htmlFor="michelle">Michelle’s answer</label>
              {!michelleVisible ? (
                <p className="mb-2 text-sm text-ink-muted">
                  Partner answers stay hidden until both are saved.
                </p>
              ) : null}
              <textarea
                id="michelle"
                className="textarea"
                value={michelleVisible ? michelleText : ""}
                onChange={(e) => setMichelleText(e.target.value)}
                disabled={!michelleVisible && Boolean(michelleAnswer)}
                placeholder={
                  !michelleVisible
                    ? "Hidden until both answers are saved"
                    : undefined
                }
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={
                  busy ||
                  !michelle ||
                  (!michelleVisible && Boolean(michelleAnswer))
                }
                onClick={() =>
                  runSaveAnswer({
                    question_id: questionId,
                    is_shared: false,
                    member_id: michelle!.id,
                    payload: { text: michelleText },
                    status: "in_discussion",
                    confidence: null,
                  })
                }
              >
                Save Michelle
              </button>
            </div>
          </div>

          {bothSaved && reveal ? (
            <div className="surface space-y-3 p-4">
              <h4 className="font-medium">Merge into family decision</h4>
              {agreementPreview?.same ? (
                <p className="text-sm text-ink-muted">
                  Areas of agreement: your answers match.
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  Areas of difference: review both perspectives, then write a
                  shared summary.
                </p>
              )}
              <div className="field">
                <label htmlFor="merge-shared">Shared summary</label>
                <textarea
                  id="merge-shared"
                  className="textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    agreementPreview?.same
                      ? agreementPreview.summary ?? ""
                      : "Create or update the family decision…"
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="merge-notes">Merge notes</label>
                <textarea
                  id="merge-notes"
                  className="textarea"
                  value={mergeNotes || notes}
                  onChange={(e) => {
                    setMergeNotes(e.target.value);
                    setNotes(e.target.value);
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  runSaveAnswer({
                    question_id: questionId,
                    is_shared: true,
                    payload: {
                      text:
                        text ||
                        agreementPreview?.summary ||
                        `${samText}\n\n${michelleText}`,
                      notes: notes || undefined,
                      agreement_notes: agreementPreview?.same
                        ? "Answers matched"
                        : undefined,
                      disagreement_notes: agreementPreview?.same
                        ? undefined
                        : "Differences captured in separate perspectives",
                    },
                    status: "decided",
                    confidence,
                    change_reason: "Merged separate perspectives",
                  })
                }
              >
                Create or update family decision
              </button>
              <p className="text-xs text-ink-subtle">
                Separate perspectives stay attached. Nothing is overwritten.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            runSaveAnswer({
              question_id: questionId,
              is_shared: true,
              payload: { text, notes: notes || undefined },
              status: "needs_research",
              confidence,
              needs_research: true,
            })
          }
        >
          Mark research
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            saveOther(async () => {
              await actionStartCoolingOff({
                question_id: questionId,
                wait_days: 7,
                reason: "Cooling-off from question detail",
              });
            })
          }
        >
          Cooling-off
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            saveOther(async () => {
              await actionScheduleReview({
                entity_type: "question",
                entity_id: questionId,
                review_date: new Date(Date.now() + 30 * 86400000)
                  .toISOString()
                  .slice(0, 10),
              });
            })
          }
        >
          Set review
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() =>
            saveOther(async () => {
              await actionToggleBookmark(questionId, currentMemberId);
            })
          }
        >
          Bookmark
        </button>
      </div>
      <PendingNavigationGuard
        open={save.showLeaveGuard}
        onStay={save.confirmStay}
        onLeave={save.confirmLeave}
      />
    </div>
  );
}
