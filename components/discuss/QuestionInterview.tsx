"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionSaveAnswer,
  actionAdvanceSession,
  actionStartCoolingOff,
  actionScheduleReview,
  actionToggleBookmark,
} from "@/lib/actions";
import type { Answer, Question, FamilyMember } from "@/lib/types/models";
import { DECISION_STATUSES, CONFIDENCE_LABELS, QUICK_DECISION_OPTIONS } from "@/lib/constants/enums";
import { StatusBadge, PriorityBadge, ConfidenceBadge } from "@/components/shared/ui";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import {
  discussionModeIcon,
  resolveDiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { QuestionContextPanel } from "@/components/questions/QuestionContextPanel";
import { sharedContextFromLibraryQuestion } from "@/lib/content/resolve-question-context";
import { previewLibraryAnswerText } from "@/lib/services/previously-answered";
import { classifySaveError } from "@/lib/ui/save-feedback";
import { SaveStatus } from "@/components/ui/save-feedback";

export function QuestionInterview({
  sessionId,
  question,
  index,
  total,
  members,
  answers,
  revealSeparate,
  bookmarked,
  currentMemberId,
  answerStatusLabel,
}: {
  sessionId: string;
  question: Question;
  index: number;
  total: number;
  members: FamilyMember[];
  answers: Answer[];
  revealSeparate: boolean;
  bookmarked: boolean;
  currentMemberId: string;
  answerStatusLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const discussion = resolveDiscussionMode({
    question,
    hasSeparateAnswers: answers.some((a) => !a.is_shared),
    preferExistingSeparate: true,
  });
  const discussionMode = discussion.mode;
  const [mode, setMode] = useState<"shared" | "separate" | "quick">(
    discussionMode === "separate_first" ? "separate" : "shared",
  );
  const modeIcon = discussionModeIcon(discussionMode);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [sharedText, setSharedText] = useState(
    answers.find((a) => a.is_shared)?.payload.text ?? "",
  );
  const [sharedNotes, setSharedNotes] = useState(
    answers.find((a) => a.is_shared)?.payload.notes ?? "",
  );
  const [status, setStatus] = useState(
    answers.find((a) => a.is_shared)?.status ?? "in_discussion",
  );
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(
    answers.find((a) => a.is_shared)?.confidence ?? 3,
  );
  const [quick, setQuick] = useState(
    answers.find((a) => a.is_shared)?.payload.quick ?? "",
  );
  const [scale, setScale] = useState(
    answers.find((a) => a.is_shared)?.payload.scale ?? 5,
  );
  const sam = members.find((m) => m.display_name === "Sam");
  const michelle = members.find((m) => m.display_name === "Michelle");
  const [samText, setSamText] = useState(
    answers.find((a) => a.member_id === sam?.id)?.payload.text ?? "",
  );
  const [michelleText, setMichelleText] = useState(
    answers.find((a) => a.member_id === michelle?.id)?.payload.text ?? "",
  );
  const [agreement, setAgreement] = useState("");
  const [disagreement, setDisagreement] = useState("");
  const [message, setMessage] = useState("");

  const progress = useMemo(
    () => Math.round(((index + 1) / Math.max(total, 1)) * 100),
    [index, total],
  );
  const questionContext = useMemo(() => {
    const hasPrior = answers.length > 0;
    return sharedContextFromLibraryQuestion(question, {
      previouslyAnswered: hasPrior
        ? {
            label: answers.some((a) => a.is_shared)
              ? "Previously answered"
              : "Partially answered before",
            previewText: previewLibraryAnswerText(answers),
            fullyAnswered: answers.some((a) => a.is_shared),
          }
        : null,
      whySeeingThis: "Included in your current discuss session.",
    });
  }, [question, answers]);

  function newMutationId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `mut_${crypto.randomUUID()}`;
    }
    return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function run(task: () => Promise<void>, options?: { allowRetry?: boolean }) {
    setSaveStatus("saving");
    setSaveError(null);
    if (options?.allowRetry) {
      setRetryAction(() => task);
    }
    startTransition(async () => {
      try {
        await task();
        setSaveStatus("saved");
        setRetryAction(null);
        router.refresh();
      } catch (error) {
        const classified = classifySaveError(error);
        setSaveStatus("error");
        setSaveError(classified.message);
      }
    });
  }

  async function assertSaveOk(
    result: { ok: true } | { ok: false; error: string; code?: string } | void,
  ) {
    if (result && "ok" in result && result.ok === false) {
      throw new Error(result.error);
    }
  }

  async function saveSharedAndContinue() {
    run(async () => {
      await assertSaveOk(
        await actionSaveAnswer({
          question_id: question.id,
          is_shared: true,
          mutation_id: newMutationId(),
          payload: {
            text: sharedText || undefined,
            notes: sharedNotes || undefined,
            quick: (quick || undefined) as never,
            scale: question.question_type === "scale" ? scale : undefined,
          },
          status: status as never,
          confidence,
        }),
      );
      await actionAdvanceSession(sessionId, "answered");
      if (index >= total - 1) {
        router.push(`/discuss/${sessionId}/summary`);
      }
    }, { allowRetry: true });
  }

  async function saveSeparate(who: "sam" | "michelle" | "shared") {
    run(async () => {
      if (who === "sam" && sam) {
        await assertSaveOk(
          await actionSaveAnswer({
            question_id: question.id,
            is_shared: false,
            member_id: sam.id,
            mutation_id: newMutationId(),
            payload: { text: samText },
            status: "in_discussion",
            confidence: null,
          }),
        );
      } else if (who === "michelle" && michelle) {
        await assertSaveOk(
          await actionSaveAnswer({
            question_id: question.id,
            is_shared: false,
            member_id: michelle.id,
            mutation_id: newMutationId(),
            payload: { text: michelleText },
            status: "in_discussion",
            confidence: null,
          }),
        );
      } else {
        await assertSaveOk(
          await actionSaveAnswer({
            question_id: question.id,
            is_shared: true,
            mutation_id: newMutationId(),
            payload: {
              text: sharedText,
              agreement_notes: agreement || undefined,
              disagreement_notes: disagreement || undefined,
              notes: sharedNotes || undefined,
            },
            status: status as never,
            confidence,
          }),
        );
        await actionAdvanceSession(sessionId, "answered");
        if (index >= total - 1) router.push(`/discuss/${sessionId}/summary`);
      }
    }, { allowRetry: true });
  }

  return (
    <div className="space-y-5">
      <div className="surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
          <span>
            Question {index + 1} of {total}
          </span>
          <SaveStatus
            state={
              saveStatus === "saving"
                ? "saving"
                : saveStatus === "saved"
                  ? "saved"
                  : saveStatus === "error"
                    ? "failed"
                    : "idle"
            }
            message={saveError}
            onRetry={
              retryAction
                ? () => run(retryAction, { allowRetry: true })
                : undefined
            }
          />
        </div>
        <div className="progress-track mb-4">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {answerStatusLabel && (
          <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
            Status: <span className="font-medium text-ink">{answerStatusLabel}</span>
          </p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          <PriorityBadge priority={question.priority} />
          {question.babymoon_priority && <span className="badge badge-accent">Babymoon</span>}
          <span className="badge badge-info" title={modeIcon.label}>
            {modeIcon.symbol} {modeIcon.label}
          </span>
          {question.evidence_summary && <span className="badge">Evidence available</span>}
          {bookmarked && <span className="badge badge-warning">Bookmarked</span>}
        </div>
        <h2 className="font-display text-2xl leading-snug text-ink sm:text-3xl">
          {question.text}
        </h2>
        <div className="mt-4 grid gap-2 text-sm text-ink-subtle sm:grid-cols-2">
          <div>
            Life stages:{" "}
            {question.life_stages.map((s) => LIFE_STAGE_LABELS[s]).join(", ")}
          </div>
          <div>Topics: {question.categories.join(", ")}</div>
          <div>Type: {question.question_type.replaceAll("_", " ")}</div>
          <div>~{question.estimated_minutes} min</div>
        </div>
      </div>

      <QuestionContextPanel context={questionContext} />

      <div className="surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["shared", "separate", "quick"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn ${mode === m ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode(m)}
            >
              {m === "shared"
                ? "Shared answer"
                : m === "separate"
                  ? "Separate perspectives"
                  : "Quick decision"}
            </button>
          ))}
        </div>

        {mode === "shared" && (
          <div className="space-y-4">
            {question.question_type === "scale" && (
              <div className="field">
                <label htmlFor="scale">Scale (1–10)</label>
                <input
                  id="scale"
                  className="input"
                  type="range"
                  min={1}
                  max={10}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
                <div className="text-sm text-ink-muted">Selected: {scale}</div>
              </div>
            )}
            <div className="field">
              <label htmlFor="sharedText">Shared answer</label>
              <textarea
                id="sharedText"
                className="textarea"
                value={sharedText}
                onChange={(e) => setSharedText(e.target.value)}
                placeholder="What are we leaning toward?"
              />
            </div>
            <div className="field">
              <label htmlFor="sharedNotes">Notes (optional)</label>
              <textarea
                id="sharedNotes"
                className="textarea"
                value={sharedNotes}
                onChange={(e) => setSharedNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {mode === "separate" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field">
                <label htmlFor="samText">Sam’s view</label>
                <textarea
                  id="samText"
                  className="textarea"
                  value={samText}
                  onChange={(e) => setSamText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending}
                  onClick={() => saveSeparate("sam")}
                >
                  Save Sam’s view
                </button>
              </div>
              <div className="field">
                <label htmlFor="michelleText">Michelle’s view</label>
                {!revealSeparate && samText && !michelleText ? (
                  <div className="rounded-xl border border-border bg-bg-muted p-4 text-sm text-ink-muted">
                    Hidden until both answers are saved. You can still type Michelle’s answer
                    below.
                  </div>
                ) : null}
                <textarea
                  id="michelleText"
                  className="textarea"
                  value={michelleText}
                  onChange={(e) => setMichelleText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending}
                  onClick={() => saveSeparate("michelle")}
                >
                  Save Michelle’s view
                </button>
              </div>
            </div>
            {revealSeparate && (
              <div className="rounded-xl border border-border bg-accent-soft/40 p-4 text-sm">
                Both perspectives are available. Capture agreement and remaining disagreement
                below, then save a shared decision.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field">
                <label htmlFor="agreement">Areas of agreement</label>
                <textarea
                  id="agreement"
                  className="textarea"
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="disagreement">Areas of disagreement</label>
                <textarea
                  id="disagreement"
                  className="textarea"
                  value={disagreement}
                  onChange={(e) => setDisagreement(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sharedDecision">Shared decision</label>
              <textarea
                id="sharedDecision"
                className="textarea"
                value={sharedText}
                onChange={(e) => setSharedText(e.target.value)}
              />
            </div>
          </div>
        )}

        {mode === "quick" && (
          <div className="flex flex-wrap gap-2">
            {QUICK_DECISION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`btn ${quick === opt ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setQuick(opt);
                  if (opt === "undecided") setStatus("undecided");
                  if (opt === "not_relevant") setStatus("not_relevant");
                  if (opt === "revisit_later") setStatus("review_scheduled");
                }}
              >
                {opt.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="status">Decision status</label>
            <select
              id="status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {DECISION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
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

        <div className="mt-5 flex flex-wrap gap-2">
          {mode === "separate" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => saveSeparate("shared")}
            >
              Save shared decision & continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={saveSharedAndContinue}
            >
              Save and continue
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await actionAdvanceSession(sessionId, "skipped");
                if (index >= total - 1) router.push(`/discuss/${sessionId}/summary`);
              })
            }
          >
            Skip for now
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await assertSaveOk(
                  await actionSaveAnswer({
                    question_id: question.id,
                    is_shared: true,
                    mutation_id: newMutationId(),
                    payload: {
                      text: sharedText || undefined,
                      notes: sharedNotes || undefined,
                    },
                    status: "needs_research",
                    confidence,
                    needs_research: true,
                  }),
                );
                setMessage("Marked for research.");
              }, { allowRetry: true })
            }
          >
            Mark for research
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await actionStartCoolingOff({
                  question_id: question.id,
                  wait_days: 7,
                  reason: "Cooling-off started from discussion session",
                });
                setMessage("Cooling-off started (still editable).");
              })
            }
          >
            Start cooling-off
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const date = new Date(Date.now() + 30 * 86400000)
                  .toISOString()
                  .slice(0, 10);
                await actionScheduleReview({
                  entity_type: "question",
                  entity_id: question.id,
                  review_date: date,
                  reason: "Review later from session",
                });
                setMessage(`Review set for ${date}.`);
              })
            }
          >
            Add review date
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await actionToggleBookmark(question.id, currentMemberId);
              })
            }
          >
            Bookmark
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await actionAdvanceSession(sessionId, "pause");
                router.push("/home");
              })
            }
          >
            Pause session
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-accent-strong">{message}</p>}
      </div>

      {answers.length > 0 && (
        <div className="surface p-4">
          <h3 className="font-display text-lg">Current answers</h3>
          <div className="mt-3 space-y-3">
            {answers.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap gap-2">
                  <span className="badge">{a.is_shared ? "Shared" : "Individual"}</span>
                  <StatusBadge status={a.status} />
                  <ConfidenceBadge confidence={a.confidence} />
                </div>
                <p className="text-ink-muted">
                  {a.payload.text || a.payload.quick || "No text"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
