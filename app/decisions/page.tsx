import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge, ConfidenceBadge } from "@/components/shared/ui";
import { readStore } from "@/lib/db/store";
import { DecisionForm } from "@/components/decisions/DecisionForm";
import {
  decisionHref,
  listFamilyDecisions,
  type FamilyDecisionNode,
} from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = await readStore();
  let decisions = listFamilyDecisions(store);

  if (params.status) {
    decisions = decisions.filter((d) => d.status === params.status);
  }
  if (params.filter === "low_confidence") {
    decisions = decisions.filter(
      (d) => d.confidence !== null && (d.confidence ?? 0) <= 2,
    );
  }
  if (params.filter === "disagreement") {
    decisions = decisions.filter((d) => !d.health.noConflicts);
  }
  if (params.filter === "review") {
    decisions = decisions.filter(
      (d) =>
        d.nextReviewDate ||
        d.status === "review_scheduled" ||
        d.health.grade === "needs_attention",
    );
  }
  if (params.filter === "needs_attention") {
    decisions = decisions.filter((d) => d.health.grade === "needs_attention");
  }

  return (
    <AppShell
      title="Decisions"
      subtitle="What the family currently believes — with conversations, questions, tasks, and research gathered in one place."
      actions={
        <a href="#new-decision" className="btn btn-primary">
          New decision
        </a>
      }
    >
      <form className="mb-5 flex flex-wrap gap-2">
        {[
          ["", "All"],
          ["decided", "Decided"],
          ["undecided", "Undecided"],
          ["cooling_off", "Cooling off"],
          ["needs_research", "Research needed"],
          ["review_scheduled", "Review scheduled"],
          ["superseded", "Superseded"],
        ].map(([value, label]) => (
          <Link
            key={label}
            href={`/decisions${value ? `?status=${value}` : ""}`}
            className="btn btn-secondary"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/decisions?filter=needs_attention"
          className="btn btn-secondary"
        >
          Needs attention
        </Link>
        <Link
          href="/decisions?filter=low_confidence"
          className="btn btn-secondary"
        >
          Low confidence
        </Link>
        <Link
          href="/decisions?filter=disagreement"
          className="btn btn-secondary"
        >
          Disagreement
        </Link>
      </form>

      <div className="space-y-3">
        {decisions.map((d) => (
          <DecisionListCard key={d.id} decision={d} />
        ))}
        {decisions.length === 0 ? (
          <p className="text-ink-muted">No decisions match this filter.</p>
        ) : null}
      </div>

      <section id="new-decision" className="surface mt-8 p-5">
        <h2 className="font-display text-2xl">Create a decision</h2>
        <DecisionForm
          outcomes={store.outcomes}
          principles={store.principles}
          questions={store.questions.slice(0, 80)}
        />
      </section>
    </AppShell>
  );
}

function DecisionListCard({ decision }: { decision: FamilyDecisionNode }) {
  return (
    <Link
      href={decisionHref(decision)}
      className="surface block p-4 transition hover:border-accent"
    >
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={decision.status} />
        {decision.confidence != null ? (
          <ConfidenceBadge confidence={decision.confidence} />
        ) : null}
        {!decision.health.noConflicts ? (
          <span className="badge badge-warning">Disagreement</span>
        ) : null}
        <span className="badge">
          {decision.health.grade.replace(/_/g, " ")}
        </span>
        {decision.source === "synthesized" ? (
          <span className="badge">From your answers</span>
        ) : null}
      </div>
      <h2 className="mt-2 font-display text-xl">{decision.title}</h2>
      <p className="mt-1 text-sm text-ink-muted line-clamp-2">
        {decision.currentPosition}
      </p>
      <div className="mt-2 text-xs text-ink-subtle">
        {decision.questions.length} questions ·{" "}
        {decision.conversations.length} conversations ·{" "}
        {decision.tasks.length} tasks
        {decision.categories.length
          ? ` · ${decision.categories.slice(0, 3).join(", ")}`
          : ""}
      </div>
    </Link>
  );
}
