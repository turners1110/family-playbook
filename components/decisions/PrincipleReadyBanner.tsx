"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ProposedPrinciple } from "@/lib/knowledge/proposed-principles";
import { actionDeferPrincipleProposal } from "@/lib/actions/principle-proposals";

/**
 * Soft post-cluster prompt — does not block the session.
 */
export function PrincipleReadyBanner({
  proposals,
}: {
  proposals: ProposedPrinciple[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!proposals.length) return null;

  return (
    <section className="mb-5 space-y-3">
      {proposals.map((p) => (
        <div
          key={p.id}
          id={`principle-ready-${p.topicSlug}`}
          className="surface border-accent/40 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Family Principle ready to draft
          </p>
          <h3 className="mt-1 font-display text-xl text-ink">
            You’ve answered enough to draft a Family Principle on{" "}
            {p.title.replace(/^Family principle:\s*/i, "")}.
          </h3>
          {p.statement ? (
            <p className="mt-2 text-sm text-ink-muted line-clamp-3">
              “{p.statement}”
            </p>
          ) : null}
          <p className="mt-2 text-xs text-ink-subtle">
            Confidence {p.confidencePercent}% · {p.importantAnswered}/
            {p.importantTotal} important answers in this cluster
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/decisions#principle-${p.topicSlug}`}
              className="btn btn-primary"
            >
              Review proposed principle
            </Link>
            {p.questionsBeforeFinalizing[0] ? (
              <Link
                href={`/questions/${p.questionsBeforeFinalizing[0].slug}`}
                className="btn btn-secondary"
              >
                Answer missing questions first
              </Link>
            ) : (
              <Link href="/discuss" className="btn btn-secondary">
                Keep discussing
              </Link>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await actionDeferPrincipleProposal(p.topicSlug);
                  router.refresh();
                })
              }
            >
              Save for later
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
