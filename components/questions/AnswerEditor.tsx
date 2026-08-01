"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionSaveAnswer,
  actionStartCoolingOff,
  actionScheduleReview,
  actionToggleBookmark,
} from "@/lib/actions";
import type { Answer, FamilyMember } from "@/lib/types/models";
import { DECISION_STATUSES, CONFIDENCE_LABELS } from "@/lib/constants/enums";
import type { SaveAnswerInput } from "@/lib/validation/schemas";

function newMutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `mut_${crypto.randomUUID()}`;
  }
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AnswerEditor({
  questionId,
  members,
  answers,
  hideUntilBoth,
  currentMemberId,
}: {
  questionId: string;
  members: FamilyMember[];
  answers: Answer[];
  hideUntilBoth: boolean;
  currentMemberId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sam = members.find((m) => m.display_name === "Sam");
  const michelle = members.find((m) => m.display_name === "Michelle");
  const shared = answers.find((a) => a.is_shared);
  const [text, setText] = useState(shared?.payload.text ?? "");
  const [samText, setSamText] = useState(
    answers.find((a) => a.member_id === sam?.id)?.payload.text ?? "",
  );
  const [michelleText, setMichelleText] = useState(
    answers.find((a) => a.member_id === michelle?.id)?.payload.text ?? "",
  );
  const [status, setStatus] = useState(shared?.status ?? "in_discussion");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(shared?.confidence ?? 3);
  const [notes, setNotes] = useState(shared?.payload.notes ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<SaveAnswerInput | null>(null);
  const bothSaved = Boolean(
    answers.find((a) => a.member_id === sam?.id) &&
      answers.find((a) => a.member_id === michelle?.id),
  );
  const reveal = !hideUntilBoth || bothSaved;

  function runSaveAnswer(input: SaveAnswerInput) {
    const payload: SaveAnswerInput = {
      ...input,
      mutation_id: input.mutation_id ?? newMutationId(),
    };
    setRetryPayload(payload);
    startTransition(async () => {
      setSaveError(null);
      const result = await actionSaveAnswer(payload);
      if (result && "ok" in result && result.ok === false) {
        setSaveError(result.error);
        // Keep form values and retry payload; do not refresh or redirect.
        return;
      }
      setRetryPayload(null);
      router.refresh();
    });
  }

  function saveOther(task: () => Promise<void>) {
    startTransition(async () => {
      setSaveError(null);
      await task();
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {saveError ? (
        <div
          className="rounded-lg border border-border bg-accent-soft px-3 py-3 text-sm text-ink"
          role="alert"
        >
          <p>{saveError}</p>
          {retryPayload ? (
            <button
              type="button"
              className="btn btn-secondary mt-2"
              disabled={pending}
              onClick={() =>
                runSaveAnswer({
                  ...retryPayload,
                  mutation_id: newMutationId(),
                })
              }
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="field">
          <label htmlFor="sam">Sam’s answer</label>
          <textarea
            id="sam"
            className="textarea"
            value={samText}
            onChange={(e) => setSamText(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || !sam}
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
          {!reveal ? (
            <p className="mb-2 text-sm text-ink-muted">
              Partner answers stay hidden until both are saved.
            </p>
          ) : null}
          <textarea
            id="michelle"
            className="textarea"
            value={michelleText}
            onChange={(e) => setMichelleText(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || !michelle}
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

      <div className="field">
        <label htmlFor="shared">Shared decision</label>
        <textarea
          id="shared"
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
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
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            runSaveAnswer({
              question_id: questionId,
              is_shared: true,
              payload: { text, notes: notes || undefined },
              status: status as never,
              confidence,
              change_reason: shared
                ? "Updated from question detail"
                : "Created from question detail",
            })
          }
        >
          Save shared answer
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
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
          disabled={pending}
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
          disabled={pending}
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
          disabled={pending}
          onClick={() =>
            saveOther(async () => {
              await actionToggleBookmark(questionId, currentMemberId);
            })
          }
        >
          Bookmark
        </button>
      </div>
    </div>
  );
}
