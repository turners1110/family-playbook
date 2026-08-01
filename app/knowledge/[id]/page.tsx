import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await readStore();
  const item = store.knowledge_items.find((k) => k.id === id);
  if (!item) notFound();
  const statusIndex = buildQuestionStatusIndex(store);
  return (
    <AppShell title={item.title} subtitle={`${item.item_type.replaceAll("_", " ")} · ${item.evidence_quality}`}>
      <article className="surface p-5">
        {item.is_sample && (
          <div className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
            Sample content for discussion — not personalized medical or legal advice.
          </div>
        )}
        <p className="text-ink">{item.summary}</p>
        <dl className="mt-5 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
          <div><dt className="font-semibold text-ink">Source</dt><dd>{item.source || "—"}</dd></div>
          <div><dt className="font-semibold text-ink">Author</dt><dd>{item.author || "—"}</dd></div>
          <div><dt className="font-semibold text-ink">Publication</dt><dd>{item.publication || "—"}</dd></div>
          <div><dt className="font-semibold text-ink">URL</dt><dd>{item.url || "—"}</dd></div>
          <div><dt className="font-semibold text-ink">Source type</dt><dd>{item.source_type || "—"}</dd></div>
          <div><dt className="font-semibold text-ink">Date added</dt><dd>{item.date_added.slice(0, 10)}</dd></div>
        </dl>
        {item.notes && <p className="mt-4 text-sm text-ink-muted">{item.notes}</p>}
      </article>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <section className="surface p-4 text-sm">
          <h3 className="font-display text-lg">Questions</h3>
          <ul className="mt-2 space-y-1">
            {item.related_question_ids.map((qid) => {
              const q = store.questions.find((itemQ) => itemQ.id === qid);
              return q ? (
                <li key={qid} className="flex flex-wrap items-center gap-2">
                  <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                  <Link href={`/questions/${q.slug}`} className="hover:text-accent">{q.short_title}</Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
        <section className="surface p-4 text-sm">
          <h3 className="font-display text-lg">Outcomes</h3>
          <ul className="mt-2 space-y-1">
            {item.related_outcome_ids.map((oid) => {
              const o = store.outcomes.find((itemO) => itemO.id === oid);
              return o ? (
                <li key={oid}>
                  <Link href={`/outcomes/${o.slug}`} className="hover:text-accent">{o.label}</Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
        <section className="surface p-4 text-sm text-ink-muted">
          <h3 className="font-display text-lg text-ink">Stages / categories</h3>
          <p className="mt-2">{item.life_stages.join(", ") || "—"}</p>
          <p className="mt-1">{item.categories.join(", ") || "—"}</p>
        </section>
      </div>
    </AppShell>
  );
}
