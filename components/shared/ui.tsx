import { STATUS_LABELS, PRIORITY_LABELS, CONFIDENCE_LABELS } from "@/lib/constants/enums";
import type { DecisionStatus, QuestionPriority } from "@/lib/constants/enums";
import { clsx } from "clsx";

export function StatusBadge({ status }: { status: DecisionStatus | string }) {
  const label = STATUS_LABELS[status as DecisionStatus] ?? status;
  const tone =
    status === "decided" || status === "tentatively_decided"
      ? "badge-accent"
      : status === "needs_research" || status === "cooling_off"
        ? "badge-warning"
        : status === "undecided" || status === "in_discussion"
          ? "badge-info"
          : "";
  return <span className={clsx("badge", tone)}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: QuestionPriority }) {
  const tone =
    priority === "essential_before_birth"
      ? "badge-danger"
      : priority === "high"
        ? "badge-warning"
        : "";
  return <span className={clsx("badge", tone)}>{PRIORITY_LABELS[priority]}</span>;
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: number | null | undefined;
}) {
  if (confidence == null) return <span className="badge">Not rated</span>;
  return (
    <span className="badge badge-info">
      {CONFIDENCE_LABELS[confidence] ?? `Confidence ${confidence}`}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface px-6 py-10 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-sm text-ink-muted">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="surface p-4">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="mt-1 font-display text-3xl text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-subtle">{hint}</div>}
    </div>
  );
}
