import Link from "next/link";
import type { TopicCoverage } from "@/lib/knowledge/topic-coverage";
import type { NextQuestionRecommendation } from "@/lib/knowledge/topic-coverage";

export function TopicCoveragePanel({ rows }: { rows: TopicCoverage[] }) {
  const visible = rows.filter((r) => r.importantTotal > 0).slice(0, 10);
  if (!visible.length) return null;

  return (
    <section className="surface mb-6 p-5">
      <h2 className="font-display text-2xl text-ink">Topic coverage</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Where your parenting philosophy is developed versus still open.
      </p>
      <ul className="mt-4 space-y-3">
        {visible.map((row) => {
          const pct = row.importantTotal
            ? Math.round((row.importantAnswered / row.importantTotal) * 100)
            : 0;
          return (
            <li
              key={row.topicSlug}
              className="rounded-xl border border-border px-3 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-ink">{row.shortLabel}</h3>
                <span className="text-xs text-ink-subtle">
                  {row.importantAnswered} / {row.importantTotal} important
                  answered
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span>{row.unresolvedDisagreements} unresolved disagreements</span>
                <span>
                  Principle confidence:{" "}
                  {row.principleConfidencePercent != null
                    ? `${row.principleConfidencePercent}%`
                    : "—"}
                </span>
                <span>
                  {row.highImpactRemaining} high-impact remaining
                </span>
                <span className="capitalize">
                  Status: {row.principleStatus.replaceAll("_", " ")}
                </span>
                {row.principleHref ? (
                  <Link href={row.principleHref} className="underline">
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NextQuestionsPanel({
  items,
}: {
  items: NextQuestionRecommendation[];
}) {
  if (!items.length) return null;
  return (
    <section className="surface mb-6 p-5">
      <h2 className="font-display text-2xl text-ink">
        Most valuable next discussions
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ranked for Sam and Michelle right now—importance, relevance, gaps, and
        unanswered status.
      </p>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item.questionId}>
            <Link
              href={`/questions/${item.slug}`}
              className="block rounded-xl border border-border px-3 py-3 hover:border-accent"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-accent-strong">
                  #{index + 1}
                </span>
                <span className="font-medium text-ink">{item.text}</span>
                {item.estimatedMinutes != null ? (
                  <span className="text-xs text-ink-subtle">
                    ~{item.estimatedMinutes} min
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {item.reasons.map((r) => (
                  <li
                    key={r}
                    className="rounded-md border border-border bg-bg-elevated px-2 py-0.5 text-xs text-ink-muted"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
