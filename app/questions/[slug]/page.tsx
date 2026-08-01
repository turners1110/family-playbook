import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge } from "@/components/shared/ui";
import {
  AnswerStatusBadge,
  AnswerStatusHeader,
} from "@/components/questions/AnswerStatusBadge";
import { readStore } from "@/lib/db/store";
import { AnswerEditor } from "@/components/questions/AnswerEditor";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
} from "@/lib/services/question-status";
import { getResearchForQuestion } from "@/lib/research/services";
import {
  RESEARCH_AVAILABILITY_LABELS,
  RESEARCH_EVIDENCE_RATING_LABELS,
} from "@/lib/research/types";

export const dynamic = "force-dynamic";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await readStore();
  const question = store.questions.find((q) => q.slug === slug);
  if (!question) notFound();

  const answers = store.answers.filter((a) => a.question_id === question.id);
  const status = getQuestionAnswerStatus(question.id, store);
  const statusIndex = buildQuestionStatusIndex(store);
  const versions = store.answer_versions
    .filter((v) => answers.some((a) => a.id === v.answer_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const related = question.related_questions
    .map((id) => store.questions.find((q) => q.id === id))
    .filter(Boolean);
  const knowledge = store.knowledge_items.filter((k) =>
    k.related_question_ids.includes(question.id),
  );
  const member = store.members.find((m) => m.user_id === store.current_user_id)!;
  const research = await getResearchForQuestion(question.id);

  return (
    <AppShell
      title={question.short_title}
      subtitle="Question detail, perspectives, and history"
      actions={
        <Link href={`/discuss?category=${question.categories[0]}`} className="btn btn-primary">
          Discuss related topic
        </Link>
      }
    >
      <section className="mb-5">
        <AnswerStatusHeader status={status} />
      </section>

      <section className="surface mb-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl">Relevant Research</h3>
          <Link href="/research/new" className="btn btn-ghost">
            {research.length ? "Add another source" : "Add source"}
          </Link>
        </div>
        {research.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No linked research yet.{" "}
            <Link href="/research/new" className="text-accent hover:underline">
              Add a source
            </Link>{" "}
            — evidence informs discussion and does not replace your answers.
          </p>
        ) : (
          <ul className="space-y-3">
            {research.map(({ link, source, shortFinding }) =>
              source ? (
                <li key={link.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/research/${source.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {source.title}
                    </Link>
                    {source.evidence_rating && (
                      <span className="badge badge-info">
                        {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
                      </span>
                    )}
                    <span className="badge">
                      {RESEARCH_AVAILABILITY_LABELS[source.availability_type]}
                    </span>
                  </div>
                  {(shortFinding || link.relevance_note) && (
                    <p className="mt-1 text-ink-muted line-clamp-2">
                      {shortFinding || link.relevance_note}
                    </p>
                  )}
                </li>
              ) : null,
            )}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-subtle">
          Outside evidence is separate from your family decision.
        </p>
      </section>

      <section className="surface p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <AnswerStatusBadge status={status} />
          <PriorityBadge priority={question.priority} />
          {question.babymoon_priority && <span className="badge badge-accent">Babymoon</span>}
          {question.required_before_birth && (
            <span className="badge badge-danger">Before birth</span>
          )}
        </div>
        <h2 className="font-display text-3xl leading-snug">{question.text}</h2>
        <p className="mt-3 text-ink-muted">{question.why_it_matters}</p>
        <p className="mt-3 text-sm text-ink-muted">
          <span className="font-semibold">Discussion guidance:</span>{" "}
          {question.discussion_guidance}
        </p>
        {question.follow_up_prompts.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {question.follow_up_prompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-2 text-sm text-ink-subtle sm:grid-cols-2">
          <div>
            Life stages:{" "}
            {question.life_stages.map((s) => LIFE_STAGE_LABELS[s]).join(", ")}
          </div>
          <div>Categories: {question.categories.join(", ")}</div>
          <div>Outcomes: {question.outcomes.join(", ") || "—"}</div>
          <div>
            Type: {question.question_type} · ~{question.estimated_minutes} min · Research:{" "}
            {question.research_mode.replaceAll("_", " ")}
          </div>
        </div>
        {question.evidence_summary && (
          <div className="mt-4 rounded-xl bg-info-soft p-3 text-sm text-info">
            <strong>Evidence summary (sample where noted):</strong> {question.evidence_summary}
          </div>
        )}
      </section>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Answer this question</h3>
        <AnswerEditor
          questionId={question.id}
          members={store.members}
          answers={answers}
          hideUntilBoth={store.settings.hide_partner_answers_until_both_saved}
          currentMemberId={member.id}
        />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Current perspectives</h3>
          <div className="mt-3 space-y-3">
            {answers.length === 0 && (
              <p className="text-sm text-ink-muted">No answers yet.</p>
            )}
            {answers.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="badge">{a.is_shared ? "Shared" : "Individual"}</span>
                </div>
                <p>{a.payload.text || a.payload.quick || "—"}</p>
                {a.payload.disagreement_notes && (
                  <p className="mt-2 text-ink-muted">
                    Disagreement: {a.payload.disagreement_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-xl">Answer history</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {versions.length === 0 && <li>No history yet.</li>}
            {versions.map((v) => (
              <li key={v.id} className="rounded-xl border border-border p-3">
                v{v.version} · {v.created_at.slice(0, 10)} · {v.change_reason}
                <div className="mt-1 text-ink">
                  {v.payload.text || v.payload.quick || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Related questions</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((q) =>
              q ? (
                <li key={q.id} className="flex flex-wrap items-center gap-2">
                  <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                  <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                    {q.short_title}
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
        <section className="surface p-5">
          <h3 className="font-display text-xl">Knowledge & evidence</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {knowledge.length === 0 && (
              <li className="text-ink-muted">No linked knowledge items.</li>
            )}
            {knowledge.map((k) => (
              <li key={k.id}>
                <Link href={`/knowledge/${k.id}`} className="hover:text-accent">
                  {k.title}
                </Link>
                {k.is_sample && <span className="badge ml-2">Sample</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-sm text-ink-muted">
            Principles:{" "}
            {question.related_principles.length
              ? question.related_principles.join(", ")
              : store.principles.map((p) => p.title).join(", ")}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
