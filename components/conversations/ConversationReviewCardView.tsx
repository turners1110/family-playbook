"use client";

import { useState } from "react";
import Link from "next/link";
import type { ConversationReviewCard } from "@/lib/services/conversation-review";

export function ConversationReviewCardView({
  card,
}: {
  card: ConversationReviewCard;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <article
      id={`card-${card.itemId}`}
      className="surface scroll-mt-24 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-xl text-ink">{card.promptText}</h3>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
          {card.statusLabel}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {card.answerType.replace(/_/g, " ")}
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        {card.samAnswer ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Sam
            </dt>
            <dd className="mt-0.5 text-ink">{card.samAnswer}</dd>
          </div>
        ) : null}
        {card.michelleAnswer ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Michelle
            </dt>
            <dd className="mt-0.5 text-ink">{card.michelleAnswer}</dd>
          </div>
        ) : null}
        {card.sharedAnswer ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Shared answer
            </dt>
            <dd className="mt-0.5 text-ink">{card.sharedAnswer}</dd>
          </div>
        ) : null}
        {card.samNotes ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Sam notes
            </dt>
            <dd className="mt-0.5 text-ink-muted">{card.samNotes}</dd>
          </div>
        ) : null}
        {card.michelleNotes ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Michelle notes
            </dt>
            <dd className="mt-0.5 text-ink-muted">{card.michelleNotes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {card.discussLater ? (
          <span className="rounded-full bg-accent-soft px-2 py-1 text-accent-strong">
            Discuss later
          </span>
        ) : null}
        {card.waitingProvider ? (
          <span className="rounded-full bg-accent-soft px-2 py-1 text-accent-strong">
            Waiting for provider
          </span>
        ) : null}
        {card.needsResearch ? (
          <span className="rounded-full bg-accent-soft px-2 py-1 text-accent-strong">
            Needs research
          </span>
        ) : null}
        {card.keepSeparate ? (
          <span className="rounded-full border border-border px-2 py-1 text-ink-muted">
            Keep separate
          </span>
        ) : null}
        {card.resolved ? (
          <span className="rounded-full border border-border px-2 py-1 text-ink-muted">
            Resolved
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        Created {new Date(card.createdAt).toLocaleString()} · Updated{" "}
        {new Date(card.updatedAt).toLocaleString()}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={card.links.editAnswerHref} className="btn btn-secondary">
          Edit answer
        </Link>
        {card.links.canonicalQuestionHref ? (
          <Link
            href={card.links.canonicalQuestionHref}
            className="btn btn-ghost"
          >
            Open source question
          </Link>
        ) : null}
        {card.links.essentialsScreenHref ? (
          <Link
            href={card.links.essentialsScreenHref}
            className="btn btn-ghost"
          >
            Essentials screen
          </Link>
        ) : null}
        {card.links.checklistHref ? (
          <Link href={card.links.checklistHref} className="btn btn-ghost">
            Checklist
          </Link>
        ) : null}
        {card.links.researchHref ? (
          <Link href={card.links.researchHref} className="btn btn-ghost">
            Research
          </Link>
        ) : null}
        {card.links.booksHref ? (
          <Link href={card.links.booksHref} className="btn btn-ghost">
            Books
          </Link>
        ) : null}
        <Link
          href="/before-baby"
          className="btn btn-ghost"
        >
          Create follow-up task
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            const url = `${window.location.origin}${card.links.copyPath}`;
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {card.links.relatedConversationHrefs.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-ink-subtle">
            Related conversations
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {card.links.relatedConversationHrefs.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="text-accent hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
