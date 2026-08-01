import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { readStore } from "@/lib/db/store";
import { ProgressBar } from "@/components/shared/ui";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function OutcomeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await readStore();
  const outcome = store.outcomes.find((o) => o.slug === slug);
  if (!outcome) notFound();

  const statusIndex = buildQuestionStatusIndex(store);
  const questions = store.questions.filter((q) => q.outcomes.includes(outcome.slug));
  const decisions = store.decisions.filter((d) => d.outcome_ids.includes(outcome.id));
  const maps = store.development_maps.filter((m) => m.outcome_id === outcome.id);
  const covered = questions.filter((q) => statusIndex.get(q.id)?.fullyAnswered).length;
  const pct = questions.length ? Math.round((covered / questions.length) * 100) : 0;
  const conflicting = decisions.filter((d) => d.has_disagreement);
  return (
    <AppShell title={outcome.label} subtitle={outcome.definition}>
      <div className="surface mb-5 p-5">
        <p className="text-ink-muted">
          <strong>Why it matters:</strong> {outcome.why_it_matters}
        </p>
        <p className="mt-3 text-ink-muted">
          <strong>Healthy development:</strong> {outcome.healthy_development}
        </p>
        <div className="mt-4 max-w-md">
          <ProgressBar value={pct} label="Current coverage score" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">Related questions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {questions.slice(0, 20).map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2">
                <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                  {q.short_title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Related decisions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {decisions.length === 0 && <li className="text-ink-muted">None yet.</li>}
            {decisions.map((d) => (
              <li key={d.id}>
                <Link href={`/decisions/${d.id}`} className="hover:text-accent">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
          {conflicting.length > 0 && (
            <p className="mt-3 text-sm text-warning">
              Conflicting / disagreement-linked decisions: {conflicting.length}
            </p>
          )}
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Age-based development map</h2>
        {maps.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Placeholder: age-based guidance can be added per outcome. Sample maps exist for
            financial skills outcomes.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {maps.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <h3 className="font-semibold">{m.age_range}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {m.guidance.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Related principles</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          {store.principles.map((p) => (
            <li key={p.id}>
              <strong>{p.title}:</strong> {p.statement}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
