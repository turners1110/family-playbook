import { clsx } from "clsx";
import type { QuestionAnswerStatus, QuestionStatusKey } from "@/lib/services/question-status";
import { QUESTION_STATUS_LABELS } from "@/lib/services/question-status";

const TONE: Record<QuestionStatusKey, string> = {
  unanswered: "",
  sam_answered: "badge-info",
  michelle_answered: "badge-info",
  both_answered: "badge-accent",
  shared_answer_saved: "badge-accent",
  undecided: "badge-warning",
  needs_review: "badge-warning",
  cooling_off: "badge-warning",
  answer_changed: "badge-danger",
};

const ICON: Record<QuestionStatusKey, string> = {
  unanswered: "○",
  sam_answered: "S",
  michelle_answered: "M",
  both_answered: "◎",
  shared_answer_saved: "◆",
  undecided: "?",
  needs_review: "↻",
  cooling_off: "❄",
  answer_changed: "Δ",
};

export function AnswerStatusBadge({
  status,
  compact = false,
}: {
  status: QuestionAnswerStatus | QuestionStatusKey;
  compact?: boolean;
}) {
  const key = typeof status === "string" ? status : status.primary;
  const label = QUESTION_STATUS_LABELS[key];
  return (
    <span
      className={clsx("badge inline-flex items-center gap-1", TONE[key])}
      title={label}
    >
      <span aria-hidden="true">{ICON[key]}</span>
      <span>{compact ? shortLabel(key) : label}</span>
    </span>
  );
}

function shortLabel(key: QuestionStatusKey): string {
  switch (key) {
    case "shared_answer_saved":
      return "Shared";
    case "both_answered":
      return "Both";
    case "sam_answered":
      return "Sam";
    case "michelle_answered":
      return "Michelle";
    case "needs_review":
      return "Review";
    case "cooling_off":
      return "Cooling";
    case "answer_changed":
      return "Changed";
    default:
      return QUESTION_STATUS_LABELS[key];
  }
}

export function AnswerStatusHeader({
  status,
}: {
  status: QuestionAnswerStatus;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <AnswerStatusBadge status={status} />
        <span className="font-medium text-ink">{status.label}</span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">Sam</dt>
          <dd className="text-ink">{personLabel(status.sam)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">Michelle</dt>
          <dd className="text-ink">{personLabel(status.michelle)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Shared decision
          </dt>
          <dd className="text-ink">{status.sharedDecisionLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-subtle">
            Last updated
          </dt>
          <dd className="text-ink">
            {formatLocal(status.lastUpdatedAt) ?? "—"}
          </dd>
        </div>
        {status.confidence != null && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Confidence
            </dt>
            <dd className="text-ink">{status.confidence} / 5</dd>
          </div>
        )}
        {status.reviewDate && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Review date
            </dt>
            <dd className="text-ink">
              {status.reviewDate}
              {status.reviewDue ? " · due" : ""}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function personLabel(state: "unanswered" | "answered" | "draft") {
  if (state === "answered") return "Answered";
  if (state === "draft") return "Draft started";
  return "Unanswered";
}

function formatLocal(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
