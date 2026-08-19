import type { BeforeBabyAttention } from "@/lib/checklists/attention";
import { EmptyState } from "@/components/shared/ui";

export function BeforeBabyAttentionSummary({
  attention,
}: {
  attention: BeforeBabyAttention;
}) {
  const { summary, stage, daysRemaining } = attention;
  const weeks =
    daysRemaining != null && daysRemaining > 0
      ? Math.ceil(daysRemaining / 7)
      : null;

  return (
    <section className="surface p-4 sm:p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        What needs attention
      </p>
      <h2 className="mt-1 font-display text-2xl text-ink">{summary.headline}</h2>
      {stage === "no_due_date" ? (
        <p className="mt-2 text-sm text-ink-muted">
          Open Settings to add your expected due date. We will not invent pregnancy timing.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {weeks != null && stage !== "final_week" ? (
            <li className="badge">{weeks} weeks until due date</li>
          ) : null}
          <li className="badge">
            {summary.thisWeekCount} this week
          </li>
          {summary.overdueCount > 0 ? (
            <li className="badge badge-warning">{summary.overdueCount} overdue</li>
          ) : (
            <li className="badge">{summary.nowCount} now</li>
          )}
          <li className="badge">{summary.comingNextCount} coming next</li>
        </ul>
      )}
    </section>
  );
}

export function BeforeBabyCaughtUp({
  nextTitle,
  allComplete = false,
}: {
  nextTitle: string | null;
  allComplete?: boolean;
}) {
  if (allComplete) {
    return (
      <EmptyState
        title="Before Baby is complete."
        body="Every open task on this checklist is done."
      />
    );
  }
  return (
    <EmptyState
      title="You're caught up."
      body={
        nextTitle
          ? `Next up: ${nextTitle}`
          : "No open Before Baby tasks need attention right now."
      }
    />
  );
}
