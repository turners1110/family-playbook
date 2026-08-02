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
}: {
  mode: ConversationModeId;
  defaultMinutes: number;
  babymoonRound?: 1 | 2 | 3;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      <button
        type="button"
        className="btn btn-primary min-h-11 w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await actionStartConversation({
                mode,
                plannedMinutes: babymoonRound ? 15 : minutes,
                babymoonRound,
              });
              router.push(`/conversations/session/${result.sessionId}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not start.");
            }
          });
        }}
      >
        {pending ? "Starting…" : buttonLabel}
      </button>
    </div>
  );
}
