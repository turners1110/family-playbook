"use client";

import Link from "next/link";
import type {
  ResearchAvailabilityType,
  ResearchEvidenceRating,
} from "@/lib/research/types";
import {
  RESEARCH_AVAILABILITY_LABELS,
  RESEARCH_EVIDENCE_RATING_LABELS,
} from "@/lib/research/types";

export type ResearchPanelItem = {
  link: {
    id: string;
    relevance_note?: string | null;
    link_type?: string | null;
  };
  source: {
    id: string;
    title: string;
    evidence_rating?: ResearchEvidenceRating | null;
    availability_type: ResearchAvailabilityType;
  } | null;
  shortFinding: string | null;
};

/**
 * Compact research panel — informs, does not decide.
 */
export function ResearchGuidancePanel({
  items,
  evidenceNeeded,
}: {
  items: ResearchPanelItem[];
  evidenceNeeded?: boolean;
}) {
  const linked = items.filter((i) => i.source);
  const ratings = linked
    .map((i) => i.source?.evidence_rating)
    .filter(Boolean) as ResearchEvidenceRating[];
  const moderateOrHigher = ratings.some((r) =>
    r === "high" || r === "moderate",
  );

  if (linked.length === 0) {
    return (
      <section className="surface mb-5 p-5">
        <h3 className="font-display text-xl">Research & guidance</h3>
        {evidenceNeeded ? (
          <p className="mt-2 text-sm text-ink-muted">
            Research would help here. Evidence informs your conversation — it does
            not decide for you.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            No linked research yet.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/research/new" className="btn btn-secondary">
            Add source
          </Link>
          <Link href="/research" className="btn btn-ghost">
            Search library
          </Link>
        </div>
      </section>
    );
  }

  const synthesis = linked
    .map((i) => i.shortFinding || i.link.relevance_note)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return (
    <section className="surface mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl">Research & guidance</h3>
        <Link href="/research/new" className="btn btn-ghost">
          Add source
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {linked.length} source{linked.length === 1 ? "" : "s"}
        {ratings.length
          ? ` · ${moderateOrHigher ? "Moderate+" : "Limited"} evidence signals`
          : ""}
      </p>
      {synthesis ? (
        <p className="mt-3 text-sm text-ink">{synthesis}</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {linked.slice(0, 3).map(({ link, source, shortFinding }) =>
          source ? (
            <li
              key={link.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/research/${source.id}`}
                  className="font-medium hover:text-accent"
                >
                  {source.title}
                </Link>
                {source.evidence_rating ? (
                  <span className="badge badge-info">
                    {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
                  </span>
                ) : null}
                <span className="badge">
                  {RESEARCH_AVAILABILITY_LABELS[source.availability_type]}
                </span>
                {link.link_type ? (
                  <span className="badge">{link.link_type}</span>
                ) : null}
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
      <div className="mt-3 grid gap-2 text-xs text-ink-subtle sm:grid-cols-2">
        <p>
          <span className="font-medium text-ink">What evidence says</span> — outside
          sources and books.
        </p>
        <p>
          <span className="font-medium text-ink">What you decide</span> — recorded
          below as your family position.
        </p>
      </div>
    </section>
  );
}
