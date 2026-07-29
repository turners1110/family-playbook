import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge, ConfidenceBadge } from "@/components/shared/ui";
import { getDecision } from "@/lib/services/decisions";
import { readStore } from "@/lib/db/local-store";
import { DecisionForm } from "@/components/decisions/DecisionForm";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDecision(id);
  if (!result) notFound();
  const { decision, versions } = result;
  const store = await readStore();
  const outcomes = store.outcomes.filter((o) => decision.outcome_ids.includes(o.id));
  const principles = store.principles.filter((p) => decision.principle_ids.includes(p.id));
  const sourceQuestions = store.questions.filter((q) =>
    decision.source_question_ids.includes(q.id),
  );

  return (
    <AppShell
      title={decision.title}
      subtitle="Decision detail and version history"
      actions={<Link href="/decisions" className="btn btn-secondary">All decisions</Link>}
    >
      <section className="surface p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusBadge status={decision.status} />
          <ConfidenceBadge confidence={decision.confidence} />
          <span className="badge">{decision.decision_type}</span>
          <span className="badge">Evidence: {decision.evidence_strength}</span>
          {decision.has_disagreement && <span className="badge badge-warning">Disagreement remains</span>}
        </div>
        <p className="text-lg text-ink">{decision.statement}</p>
        {decision.problem && (
          <p className="mt-3 text-sm text-ink-muted">
            <strong>Problem:</strong> {decision.problem}
          </p>
        )}
        {decision.reasoning && (
          <p className="mt-2 text-sm text-ink-muted">
            <strong>Reasoning:</strong> {decision.reasoning}
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="font-semibold">Sam</div>
            <p className="mt-1 text-ink-muted">{decision.sam_perspective || "—"}</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="font-semibold">Michelle</div>
            <p className="mt-1 text-ink-muted">{decision.michelle_perspective || "—"}</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="font-semibold">Shared conclusion</div>
            <p className="mt-1 text-ink-muted">{decision.shared_conclusion || "—"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
          <div>Agreement: {decision.agreement_notes || "—"}</div>
          <div>Disagreement: {decision.disagreement_notes || "—"}</div>
          <div>Implementation: {decision.implementation_notes || "—"}</div>
          <div>Exceptions: {decision.exceptions || "—"}</div>
          <div>Risks: {decision.risks || "—"}</div>
          <div>Warning signs: {decision.warning_signs || "—"}</div>
          <div>Reconsider when: {decision.reconsideration_conditions || "—"}</div>
          <div>Review date: {decision.review_date || "—"}</div>
          <div>Reversibility: {decision.reversibility || "—"}</div>
          <div>Child-dependent: {decision.child_dependent ? "Yes" : "No"}</div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="surface p-4">
          <h3 className="font-display text-lg">Outcomes</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {outcomes.map((o) => (
              <li key={o.id}>
                <Link href={`/outcomes/${o.slug}`} className="hover:text-accent">{o.label}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface p-4">
          <h3 className="font-display text-lg">Principles</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {principles.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ul>
        </section>
        <section className="surface p-4">
          <h3 className="font-display text-lg">Source questions</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {sourceQuestions.map((q) => (
              <li key={q.id}>
                <Link href={`/questions/${q.slug}`} className="hover:text-accent">{q.short_title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Version history</h3>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          {versions.map((v) => (
            <li key={v.id} className="rounded-xl border border-border p-3">
              v{v.version} · {v.created_at.slice(0, 10)} · {v.change_reason}
            </li>
          ))}
        </ul>
      </section>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Edit decision</h3>
        <DecisionForm
          decision={decision}
          outcomes={store.outcomes}
          principles={store.principles}
          questions={store.questions.slice(0, 100)}
        />
      </section>
    </AppShell>
  );
}
