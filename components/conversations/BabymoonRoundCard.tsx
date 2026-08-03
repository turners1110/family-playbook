import Link from "next/link";
import type { RoundStatusView } from "@/lib/services/round-status";
import { roundStatusLabel } from "@/lib/services/round-status";
import { ModeStarter } from "@/components/conversations/ModeStarter";
import { estimateRoundSeconds } from "@/lib/conversations/babymoon-set";

export function BabymoonRoundCard({
  round,
  title,
  promptCount,
  view,
}: {
  round: 1 | 2 | 3;
  title: string;
  promptCount: number;
  view: RoundStatusView;
}) {
  const secs = estimateRoundSeconds(round);
  const status = view.status;
  const label = roundStatusLabel(status);
  const isCompleted =
    status === "completed" || status === "completed_with_followups";
  const isInProgress = status === "in_progress";
  const sessionId = view.session?.id ?? null;

  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            Round {round}: {title}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {promptCount} prompts · About {Math.round(secs / 60)} minutes
          </p>
        </div>
        <span
          className={
            isCompleted
              ? "rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong"
              : isInProgress
                ? "rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-ink"
                : "rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted"
          }
        >
          {label}
        </span>
      </div>

      {isInProgress ? (
        <div className="mt-3 space-y-1 text-sm text-ink-muted">
          <p>
            {view.completedItemCount} of {view.eligibleItemCount} completed
          </p>
          {view.lastActivityAt ? (
            <p>
              Last activity{" "}
              {new Date(view.lastActivityAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          {view.nextUnansweredTitle ? (
            <p className="text-ink">
              Next: {view.nextUnansweredTitle}
            </p>
          ) : null}
        </div>
      ) : null}

      {isCompleted ? (
        <div className="mt-3 space-y-1 text-sm text-ink-muted">
          <p>
            {view.completedItemCount} of {view.eligibleItemCount} completed
          </p>
          {view.openFollowupCount > 0 ? (
            <p className="text-ink">
              {view.openFollowupCount} follow-up
              {view.openFollowupCount === 1 ? "" : "s"} remain
            </p>
          ) : null}
          {view.completedAt ? (
            <p>
              Completed{" "}
              {new Date(view.completedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {sessionId ? (
              <>
                <Link
                  href={`/conversations/session/${sessionId}/summary`}
                  className="btn btn-primary"
                >
                  View summary
                </Link>
                <Link
                  href={`/conversations/session/${sessionId}/review`}
                  className="btn btn-secondary"
                >
                  Review conversation
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isCompleted ? (
        <ModeStarter
          mode="babymoon"
          defaultMinutes={15}
          babymoonRound={round}
          buttonLabel={isInProgress ? "Continue" : `Start round ${round}`}
          resumeSessionId={isInProgress ? sessionId : null}
          resumeLabel={
            isInProgress && sessionId
              ? `Continue (${view.completedItemCount}/${view.eligibleItemCount})`
              : undefined
          }
          hideStartNewWhenResuming
        />
      ) : (
        <ModeStarter
          mode="babymoon"
          defaultMinutes={15}
          babymoonRound={round}
          buttonLabel="Start again"
          forceSecondary
          requireStartAgainConfirm
          repeatsSessionId={sessionId}
          isRepeat
        />
      )}
    </div>
  );
}
