import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationReviewCardView } from "@/components/conversations/ConversationReviewCardView";
import { ConversationReviewExport } from "@/components/conversations/ConversationReviewExport";
import { readStore } from "@/lib/db/store";
import {
  buildConversationReview,
  exportConversationReviewHtml,
  exportConversationReviewJson,
  exportConversationReviewMarkdown,
} from "@/lib/services/conversation-review";

export const dynamic = "force-dynamic";

export default async function ConversationSessionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const store = await readStore();
  const model = buildConversationReview(store, sessionId);
  if (!model) notFound();

  const markdown = exportConversationReviewMarkdown(model);
  const json = exportConversationReviewJson(model);
  const html = exportConversationReviewHtml(model);

  return (
    <AppShell
      title={model.title}
      subtitle="Conversation record — read first, edit when you need to."
    >
      <section className="surface mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
              {model.statusLabel}
            </p>
            <h2 className="mt-1 font-display text-3xl text-ink">
              {model.session.title}
            </h2>
            {model.completedAt ? (
              <p className="mt-2 text-sm text-ink-muted">
                Completed{" "}
                {new Date(model.completedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Participants</dt>
            <dd>{model.participants.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Duration</dt>
            <dd>{model.durationLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Questions answered
            </dt>
            <dd>
              {model.questionsAnswered} of {model.itemCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Shared decisions
            </dt>
            <dd>{model.sharedDecisions}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Open follow-ups</dt>
            <dd>{model.openFollowUps}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {model.incomplete ? (
            <Link href={model.flowHref} className="btn btn-primary">
              Resume
            </Link>
          ) : null}
          <Link href={model.summaryHref} className="btn btn-secondary">
            Summary
          </Link>
          {model.tasks.length > 0 ? (
            <Link href="/before-baby" className="btn btn-ghost">
              Tasks created ({model.tasks.length})
            </Link>
          ) : null}
          <Link href="/research" className="btn btn-ghost">
            Research
          </Link>
          <Link href="/conversations/history" className="btn btn-ghost">
            History
          </Link>
          <Link href="/conversations" className="btn btn-ghost">
            Conversations
          </Link>
        </div>

        <div className="mt-4">
          <ConversationReviewExport
            title={model.title}
            markdown={markdown}
            json={json}
            html={html}
          />
        </div>
      </section>

      <section className="surface mb-5 p-5">
        <h2 className="font-display text-xl">Conversation timeline</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {model.timeline.map((ev) => (
            <li key={ev.id} className="flex flex-wrap gap-2">
              <span className="text-ink-subtle">
                {new Date(ev.at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <span className="text-ink">{ev.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {model.tasks.length > 0 ? (
        <section className="surface mb-5 p-5">
          <h2 className="font-display text-xl">Tasks created</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {model.tasks.map((t) => (
              <li key={t.id}>
                <Link href={t.href} className="text-accent hover:underline">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-xl">Answers</h2>
        {model.cards.length === 0 ? (
          <p className="text-ink-muted">No prompts in this conversation yet.</p>
        ) : (
          model.cards.map((card) => (
            <ConversationReviewCardView key={card.itemId} card={card} />
          ))
        )}
      </section>
    </AppShell>
  );
}
