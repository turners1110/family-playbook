import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge, ConfidenceBadge } from "@/components/shared/ui";
import { readStore } from "@/lib/db/local-store";
import { DecisionForm } from "@/components/decisions/DecisionForm";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = await readStore();
  let decisions = [...store.decisions];

  if (params.status) decisions = decisions.filter((d) => d.status === params.status);
  if (params.filter === "low_confidence") {
    decisions = decisions.filter((d) => d.confidence !== null && d.confidence <= 2);
  }
  if (params.filter === "disagreement") {
    decisions = decisions.filter((d) => d.has_disagreement);
  }
  if (params.filter === "review") {
    decisions = decisions.filter((d) => d.review_date || d.status === "review_scheduled");
  }

  return (
    <AppShell
      title="Decisions"
      subtitle="What the family currently believes or has chosen — separate from the questions that prompted discussion."
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
          <button
            key={label}
            formAction={`/decisions${value ? `?status=${value}` : ""}`}
            className="btn btn-secondary"
            formMethod="get"
            name="status"
            value={value}
          >
            {label}
          </button>
        ))}
        <Link href="/decisions?filter=low_confidence" className="btn btn-secondary">
          Low confidence
        </Link>
        <Link href="/decisions?filter=disagreement" className="btn btn-secondary">
          Disagreement
        </Link>
      </form>

      <div className="space-y-3">
        {decisions.map((d) => (
          <Link key={d.id} href={`/decisions/${d.id}`} className="surface block p-4 hover:border-accent">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={d.status} />
              <ConfidenceBadge confidence={d.confidence} />
              {d.has_disagreement && <span className="badge badge-warning">Disagreement</span>}
              <span className="badge">{d.evidence_strength}</span>
            </div>
            <h2 className="mt-2 font-display text-xl">{d.title}</h2>
            <p className="mt-1 text-sm text-ink-muted line-clamp-2">{d.statement}</p>
            <div className="mt-2 text-xs text-ink-subtle">
              Updated {d.updated_at.slice(0, 10)}
              {d.review_date ? ` · Review ${d.review_date}` : ""}
              {d.categories.length ? ` · ${d.categories.join(", ")}` : ""}
            </div>
          </Link>
        ))}
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
