"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ResearchSourceCard } from "@/lib/research/types";
import {
  RESEARCH_AVAILABILITY_LABELS,
  RESEARCH_EVIDENCE_RATING_LABELS,
  RESEARCH_PROCESSING_LABELS,
  RESEARCH_SOURCE_TYPE_LABELS,
} from "@/lib/research/types";
import {
  actionAddRecommendedToLibrary,
  actionHideRecommended,
} from "@/lib/research/actions";
import {
  ResearchAvailabilityBadge,
  ResearchStatusBadge,
} from "@/components/research/ResearchSourceCard";

export function ResearchLibraryCard({
  source,
  layout = "list",
  writesAllowed,
}: {
  source: ResearchSourceCard;
  layout?: "list" | "shelf";
  writesAllowed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isRecommended = source.library_origin === "recommended";
  const href =
    isRecommended && source.added_source_id
      ? `/research/${source.added_source_id}`
      : isRecommended
        ? null
        : `/research/${source.id}`;

  function addToLibrary() {
    if (!source.recommended_slug) return;
    startTransition(async () => {
      setError(null);
      const result = await actionAddRecommendedToLibrary(source.recommended_slug!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function hide() {
    if (!source.recommended_slug) return;
    startTransition(async () => {
      setError(null);
      const result = await actionHideRecommended(source.recommended_slug!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const badges = (
    <div className="mb-2 flex flex-wrap gap-2">
      <span className="badge">
        {RESEARCH_SOURCE_TYPE_LABELS[source.source_type]}
      </span>
      {source.built_in ? <span className="badge badge-accent">Built in</span> : null}
      {source.ownership_status === "reference_only" ? (
        <span className="badge badge-info">Reference source</span>
      ) : (
        <ResearchStatusBadge status={source.processing_status} />
      )}
      {source.ownership_status !== "reference_only" ? (
        <ResearchAvailabilityBadge availability={source.availability_type} />
      ) : null}
      {source.evidence_rating ? (
        <span className="badge badge-info">
          Evidence: {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
          {!source.evidence_rating_approved ? " (pending)" : ""}
        </span>
      ) : null}
      {source.in_my_library && isRecommended ? (
        <span className="badge">In My Library</span>
      ) : null}
      {source.has_summary ? <span className="badge badge-accent">Summary</span> : null}
    </div>
  );

  const body = (
    <>
      {badges}
      <h2 className="font-display text-xl text-ink">{source.title}</h2>
      {source.subtitle ? (
        <p className="text-sm text-ink-muted">{source.subtitle}</p>
      ) : null}
      <p className="mt-1 text-sm text-ink-muted">
        {source.author_text || source.organization || "Unknown author"}
        {source.publication_year ? ` · ${source.publication_year}` : ""}
        {source.added_by_display_name
          ? ` · Added by ${source.added_by_display_name}`
          : ""}
      </p>
      {source.description ? (
        <p className="mt-2 text-sm text-ink-muted">{source.description}</p>
      ) : null}
      {!isRecommended ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-subtle">
          <span>{source.finding_count} findings</span>
          <span>{source.linked_question_count} questions</span>
          <span>{source.linked_principle_count} principles</span>
          <span>Added {source.created_at.slice(0, 10)}</span>
        </div>
      ) : null}
      {isRecommended && writesAllowed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {source.in_my_library ? (
            source.added_source_id ? (
              <Link
                href={`/research/${source.added_source_id}`}
                className="btn btn-secondary"
              >
                Open in My Library
              </Link>
            ) : (
              <span className="badge">Added</span>
            )
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={addToLibrary}
            >
              Add to My Library
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={hide}
          >
            Hide recommendation
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-warning">{error}</p> : null}
    </>
  );

  if (layout === "shelf") {
    const inner = (
      <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-bg-muted/30 transition hover:border-accent">
        <div className="relative aspect-[2/3] bg-gradient-to-br from-bg-muted to-border/60">
          <div className="flex h-full items-end p-3">
            <span className="font-display text-lg leading-tight text-ink">
              {source.title}
            </span>
          </div>
        </div>
        <div className="space-y-1 p-3">
          <div className="line-clamp-2 text-sm font-medium text-ink">{source.title}</div>
          <div className="text-xs text-ink-muted">
            {source.author_text || source.organization || "Unknown author"}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {source.built_in ? <span className="badge badge-accent">Built in</span> : null}
            <span className="badge">
              {source.ownership_status === "reference_only"
                ? "Reference source"
                : RESEARCH_PROCESSING_LABELS[source.processing_status]}
            </span>
            <span className="badge" title={RESEARCH_AVAILABILITY_LABELS[source.availability_type]}>
              {RESEARCH_AVAILABILITY_LABELS[source.availability_type]}
            </span>
          </div>
        </div>
      </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
  }

  if (href && !isRecommended) {
    return (
      <Link href={href} className="surface block p-4 transition hover:border-accent">
        {body}
      </Link>
    );
  }

  return <div className="surface p-4">{body}</div>;
}
