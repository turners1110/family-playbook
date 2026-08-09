"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProposedPrinciple } from "@/lib/knowledge/proposed-principles";
import {
  actionAcceptPrincipleProposal,
  actionDeferPrincipleProposal,
  actionRejectPrincipleProposal,
  actionSavePrincipleProposalEdit,
} from "@/lib/actions/principle-proposals";
import { ConfidenceBadge } from "@/components/shared/ui";

export function ProposedPrincipleCard({
  proposal,
}: {
  proposal: ProposedPrinciple;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(proposal.statement ?? "");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <article
      id={`principle-${proposal.topicSlug}`}
      className="surface space-y-3 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-strong">
            {proposal.readyToDraft
              ? "Proposed Family Principle"
              : "Principle cluster forming"}
          </p>
          <h3 className="font-display text-xl text-ink">{proposal.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-info">
            {proposal.confidencePercent}% confidence
          </span>
          <ConfidenceBadge confidence={proposal.confidence} />
        </div>
      </div>

      <p className="text-xs text-ink-subtle">
        {proposal.importantAnswered} / {proposal.importantTotal} important
        questions answered · {proposal.answeredCount} answers in cluster
      </p>

      {proposal.statement ? (
        editing ? (
          <textarea
            className="input min-h-28 w-full"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            disabled={pending}
          />
        ) : (
          <p className="text-ink leading-relaxed">“{proposal.statement}”</p>
        )
      ) : (
        <p className="text-sm text-ink-muted">
          Not enough specific detail yet to draft a playbook-ready principle.
        </p>
      )}

      {proposal.missingExplanation ? (
        <div className="rounded-xl border border-border bg-bg-elevated/50 px-3 py-2 text-sm text-ink-muted">
          <span className="font-medium text-ink">What’s missing: </span>
          {proposal.missingExplanation}
        </div>
      ) : null}

      {(proposal.samThemes.length > 0 || proposal.michelleThemes.length > 0) && (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <h4 className="font-medium text-ink">Stronger themes from Sam</h4>
            <p className="mt-1 text-ink-muted">
              {proposal.samThemes.length
                ? proposal.samThemes.join(" · ")
                : "—"}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-ink">Stronger themes from Michelle</h4>
            <p className="mt-1 text-ink-muted">
              {proposal.michelleThemes.length
                ? proposal.michelleThemes.join(" · ")
                : "—"}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <h4 className="font-medium text-ink">Answers that led here</h4>
          <ul className="mt-1 space-y-1 text-ink-muted">
            {proposal.sourceAnswers.slice(0, 5).map((s) => (
              <li key={s.questionId}>
                <Link
                  href={`/questions/${s.questionSlug}`}
                  className="font-medium text-ink underline decoration-border"
                >
                  {s.questionText}
                </Link>
                : {s.preview}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-ink">Where you agree</h4>
            {proposal.agreements.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
                {proposal.agreements.slice(0, 4).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-ink-subtle">No clear shared answers yet.</p>
            )}
          </div>
          <div>
            <h4 className="font-medium text-ink">Unresolved disagreements</h4>
            {proposal.disagreements.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
                {proposal.disagreements.slice(0, 4).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-ink-subtle">None detected in this cluster.</p>
            )}
          </div>
        </div>
      </div>

      {proposal.questionsBeforeFinalizing.length > 0 ? (
        <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-sm">
          <h4 className="font-medium text-ink">
            Highest-value questions before finalizing
          </h4>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {proposal.questionsBeforeFinalizing.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.slug}`}
                  className="underline decoration-border hover:text-accent"
                  title={q.reason}
                >
                  {q.text}
                </Link>
                <span className="text-ink-subtle"> — {q.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {proposal.statement ? (
          editing ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending || !statement.trim()}
              onClick={() =>
                run(async () => {
                  await actionSavePrincipleProposalEdit(
                    proposal.topicSlug,
                    statement,
                  );
                  setEditing(false);
                })
              }
            >
              Save edit
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )
        ) : null}
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || (!proposal.statement && !statement.trim())}
          onClick={() =>
            run(async () => {
              const res = await actionAcceptPrincipleProposal({
                topicSlug: proposal.topicSlug,
                statement: statement || proposal.statement || undefined,
              });
              if (res.decisionId) {
                router.push(`/decisions/${res.decisionId}`);
              }
            })
          }
        >
          Accept
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() =>
            run(() => actionDeferPrincipleProposal(proposal.topicSlug))
          }
        >
          Save for later
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() =>
            run(() => actionRejectPrincipleProposal(proposal.topicSlug))
          }
        >
          Reject
        </button>
      </div>
    </article>
  );
}
