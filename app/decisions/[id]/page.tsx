import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge, ConfidenceBadge } from "@/components/shared/ui";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { DecisionForm } from "@/components/decisions/DecisionForm";
import { getDecision } from "@/lib/services/decisions";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";
import {
  decisionHref,
  getFamilyDecisionBySlugOrId,
  getRelatedDecisions,
} from "@/lib/knowledge";

export const dynamic = "force-dynamic";

function HealthBadge({
  grade,
  score,
}: {
  grade: string;
  score: number;
}) {
  const cls =
    grade === "excellent"
      ? "bg-accent-soft text-accent-strong"
      : grade === "good"
        ? "border border-border text-ink"
        : "border border-danger/40 text-danger";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {grade.replace(/_/g, " ")} · {score}%
    </span>
  );
}

function LinkSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <h3 className="font-display text-xl">{title}</h3>
      <div className="mt-3">{children ?? <p className="text-sm text-ink-muted">{empty}</p>}</div>
    </section>
  );
}

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await readStore();
  const hub = getFamilyDecisionBySlugOrId(store, id);
  const persisted = await getDecision(id);
  if (!hub && !persisted) notFound();

  const decision = persisted?.decision ?? null;
  const versions = persisted?.versions ?? [];
  const node = hub;
  const statusIndex = buildQuestionStatusIndex(store);
  const related = node ? getRelatedDecisions(store, node.id) : [];
  const outcomes = decision
    ? store.outcomes.filter((o) => decision.outcome_ids.includes(o.id))
    : [];
  const principles = decision
    ? store.principles.filter((p) => decision.principle_ids.includes(p.id))
    : [];

  const title = node?.title ?? decision!.title;
  const position =
    node?.currentPosition ??
    decision?.shared_conclusion ??
    decision?.statement ??
    "";

  return (
    <AppShell
      title={title}
      subtitle="Your family's current position and everything connected to it."
      actions={
        <Link href="/decisions" className="btn btn-secondary">
          All decisions
        </Link>
      }
    >
      <section className="surface mb-5 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusBadge status={node?.status ?? decision!.status} />
          {(node?.confidence ?? decision?.confidence) != null ? (
            <ConfidenceBadge
              confidence={(node?.confidence ?? decision?.confidence)!}
            />
          ) : null}
          {node ? <HealthBadge grade={node.health.grade} score={node.health.score} /> : null}
          {node?.source === "synthesized" ? (
            <span className="badge">Built from your answers</span>
          ) : null}
        </div>
        <h2 className="font-display text-2xl text-ink">Current position</h2>
        <p className="mt-2 text-lg text-ink">{position}</p>
        {node?.health.insights.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {node.health.insights.map((insight) => (
              <li
                key={insight}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted"
              >
                {insight}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
          <div>
            Updated{" "}
            {new Date(node?.updatedAt ?? decision!.updated_at).toLocaleString()}
          </div>
          {(node?.nextReviewDate ?? decision?.review_date) ? (
            <div>
              Next review: {node?.nextReviewDate ?? decision?.review_date}
            </div>
          ) : null}
          <div>
            Questions: {node?.questions.length ?? decision?.source_question_ids.length ?? 0}
          </div>
          <div>Conversations: {node?.conversations.length ?? 0}</div>
          {decision?.started_mode ? (
            <div>
              {decision.started_mode === "separate_first"
                ? "Started separately"
                : decision.started_mode === "either"
                  ? "Either mode"
                  : "Started together"}
            </div>
          ) : null}
          {decision?.merged_at ? (
            <div>
              Merged later · {decision.merged_at.slice(0, 10)}
              {decision.merge_initiated_by
                ? ` · ${decision.merge_initiated_by}`
                : ""}
            </div>
          ) : null}
        </div>
      </section>

      {(decision?.sam_perspective || decision?.michelle_perspective) && (
        <section className="surface mb-5 p-5">
          <h3 className="font-display text-xl">Separate perspectives</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {decision.sam_perspective ? (
              <div>
                <p className="text-sm font-medium">Sam</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {decision.sam_perspective}
                </p>
              </div>
            ) : null}
            {decision.michelle_perspective ? (
              <div>
                <p className="text-sm font-medium">Michelle</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {decision.michelle_perspective}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <LinkSection title="Conversations" empty="No linked conversations yet.">
          {node?.conversations.length ? (
            <ul className="space-y-2 text-sm">
              {node.conversations.map((c) => (
                <li key={c.id}>
                  <Link href={c.href} className="font-medium hover:text-accent">
                    {c.title}
                  </Link>
                  <span className="text-ink-muted"> · {c.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </LinkSection>

        <LinkSection title="Questions" empty="No linked questions yet.">
          {(node?.questions.length
            ? node.questions
            : decision
              ? store.questions
                  .filter((q) => decision.source_question_ids.includes(q.id))
                  .map((q) => ({
                    id: q.id,
                    slug: q.slug,
                    title: q.short_title,
                    href: `/questions/${q.slug}`,
                  }))
              : []
          ).length ? (
            <ul className="space-y-2">
              {(node?.questions.length
                ? node.questions
                : decision
                  ? store.questions
                      .filter((q) =>
                        decision.source_question_ids.includes(q.id),
                      )
                      .map((q) => ({
                        id: q.id,
                        slug: q.slug,
                        title: q.short_title,
                        href: `/questions/${q.slug}`,
                      }))
                  : []
              ).map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  {statusIndex.get(q.id) ? (
                    <AnswerStatusBadge
                      status={statusIndex.get(q.id)!}
                      compact
                    />
                  ) : null}
                  <Link href={q.href} className="hover:text-accent">
                    {q.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </LinkSection>

        <LinkSection title="Checklist" empty="No linked tasks yet.">
          {node?.tasks.length ? (
            <ul className="space-y-2 text-sm">
              {node.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="hover:text-accent">
                    {t.completed ? "✓ " : ""}
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </LinkSection>

        <LinkSection title="Research & books" empty="No linked research yet.">
          {[...(node?.books ?? []), ...(node?.research ?? [])].length ? (
            <ul className="space-y-2 text-sm">
              {[...(node?.books ?? []), ...(node?.research ?? [])].map((k) => (
                <li key={k.id}>
                  <Link href={k.href} className="hover:text-accent">
                    {k.title}
                  </Link>
                  <span className="text-ink-muted"> · {k.itemType}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </LinkSection>

        <LinkSection
          title="Provider questions"
          empty="No provider questions linked yet."
        >
          {node?.linkedProviderNotes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {node.linkedProviderNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </LinkSection>

        <LinkSection title="Related topics" empty="No related topics yet.">
          {related.length ? (
            <ul className="space-y-2 text-sm">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={decisionHref(r)} className="hover:text-accent">
                    {r.title}
                  </Link>
                  <span className="text-ink-muted">
                    {" "}
                    · {r.health.grade.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </LinkSection>
      </div>

      {(outcomes.length > 0 || principles.length > 0) && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          {outcomes.length > 0 ? (
            <section className="surface p-5">
              <h3 className="font-display text-xl">Outcomes</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {outcomes.map((o) => (
                  <li key={o.id}>
                    <Link href={`/outcomes/${o.slug}`} className="hover:text-accent">
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {principles.length > 0 ? (
            <section className="surface p-5">
              <h3 className="font-display text-xl">Principles</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                {principles.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {versions.length > 0 ? (
        <section className="surface mb-5 p-5">
          <h3 className="font-display text-xl">History</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {versions.map((v) => (
              <li key={v.id} className="rounded-xl border border-border p-3">
                v{v.version} · {v.created_at.slice(0, 10)} · {v.change_reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {decision ? (
        <section className="surface p-5">
          <h3 className="font-display text-xl">Edit decision</h3>
          <DecisionForm
            decision={decision}
            outcomes={store.outcomes}
            principles={store.principles}
            questions={store.questions.slice(0, 100)}
          />
        </section>
      ) : (
        <section className="surface p-5">
          <p className="text-sm text-ink-muted">
            This topic is assembled from your existing answers and conversations.
            Save a formal decision anytime from the Decisions page.
          </p>
          <Link href="/decisions#new-decision" className="btn btn-secondary mt-3">
            Create decision record
          </Link>
        </section>
      )}
    </AppShell>
  );
}
