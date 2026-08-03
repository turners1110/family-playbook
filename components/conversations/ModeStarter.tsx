"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationModeId } from "@/lib/types/models";
import { SESSION_LENGTH_OPTIONS } from "@/lib/conversations/modes";
import { actionStartConversation } from "@/lib/actions/conversations";

export function ModeStarter({
  mode,
  defaultMinutes,
  babymoonRound,
  buttonLabel = "Start",
  resumeSessionId,
  resumeLabel,
  hideStartNewWhenResuming = false,
  forceSecondary = false,
  requireStartAgainConfirm = false,
  isRepeat = false,
  repeatsSessionId = null,
}: {
  mode: ConversationModeId;
  defaultMinutes: number;
  babymoonRound?: 1 | 2 | 3;
  buttonLabel?: string;
  /** When set, Continue opens this session instead of creating a blank one. */
  resumeSessionId?: string | null;
  resumeLabel?: string;
  /** Hide the secondary “Start a new session instead” when continuing. */
  hideStartNewWhenResuming?: boolean;
  forceSecondary?: boolean;
  requireStartAgainConfirm?: boolean;
  isRepeat?: boolean;
  repeatsSessionId?: string | null;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canResume = Boolean(resumeSessionId);

  function startNew(forceNew: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await actionStartConversation({
          mode,
          plannedMinutes: babymoonRound ? 15 : minutes,
          babymoonRound,
          forceNew,
          isRepeat: forceNew && isRepeat ? true : undefined,
          repeatsSessionId:
            forceNew && isRepeat ? repeatsSessionId : undefined,
        });
        setConfirmOpen(false);
        router.push(`/conversations/session/${result.sessionId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start.");
      }
    });
  }

  return (
    <div className="mt-3 space-y-3">
      {!babymoonRound ? (
        <label className="block text-sm text-ink-muted">
          Session length
          <select
            className="mt-1 w-full rounded-xl border border-border bg-bg-elevated px-3 py-3 text-base"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {SESSION_LENGTH_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {canResume ? (
        <button
          type="button"
          className="btn btn-primary min-h-11 w-full"
          disabled={pending}
          onClick={() => {
            router.push(`/conversations/session/${resumeSessionId}`);
          }}
        >
          {resumeLabel ?? "Continue saved session"}
        </button>
      ) : null}
      {canResume && hideStartNewWhenResuming ? null : (
        <button
          type="button"
          className={
            canResume || forceSecondary
              ? "btn btn-secondary min-h-11 w-full"
              : "btn btn-primary min-h-11 w-full"
          }
          disabled={pending}
          onClick={() => {
            if (requireStartAgainConfirm) {
              setConfirmOpen(true);
              return;
            }
            startNew(canResume);
          }}
        >
          {pending
            ? "Starting…"
            : canResume
              ? "Start a new session instead"
              : buttonLabel}
        </button>
      )}

      {confirmOpen ? (
        <div
          className="rounded-xl border border-border bg-bg p-4"
          role="dialog"
          aria-labelledby="start-again-title"
        >
          <h3 id="start-again-title" className="font-display text-lg">
            Start this round again?
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            Your completed round will stay in History. A new session will be
            created.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => startNew(true)}
            >
              {pending ? "Starting…" : "Start again"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
