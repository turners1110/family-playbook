import Link from "next/link";
import { clsx } from "clsx";
import type { ResearchSourceCard } from "@/lib/research/types";
import {
  RESEARCH_AVAILABILITY_LABELS,
  RESEARCH_EVIDENCE_RATING_LABELS,
  RESEARCH_PROCESSING_LABELS,
  RESEARCH_SOURCE_TYPE_LABELS,
} from "@/lib/research/types";

export function ResearchStatusBadge({
  status,
}: {
  status: ResearchSourceCard["processing_status"];
}) {
  const tone =
    status === "processed"
      ? "badge-accent"
      : status === "processing_failed"
        ? "badge-danger"
        : status === "needs_review" || status === "queued" || status === "processing"
          ? "badge-warning"
          : status === "metadata_only"
            ? "badge-info"
            : "";
  return (
    <span className={clsx("badge", tone)}>
      {RESEARCH_PROCESSING_LABELS[status]}
    </span>
  );
}

export function ResearchAvailabilityBadge({
  availability,
}: {
  availability: ResearchSourceCard["availability_type"];
}) {
  return (
    <span className="badge" title={RESEARCH_AVAILABILITY_LABELS[availability]}>
      {RESEARCH_AVAILABILITY_LABELS[availability]}
    </span>
  );
}

export function ResearchSourceCardView({
  source,
  layout = "list",
}: {
  source: ResearchSourceCard;
  layout?: "list" | "shelf";
}) {
  if (layout === "shelf") {
    return (
      <Link
        href={`/research/${source.id}`}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-bg-muted/30 transition hover:border-accent"
      >
        <div className="relative aspect-[2/3] bg-gradient-to-br from-bg-muted to-border/60">
          {source.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-end p-3">
              <span className="font-display text-lg leading-tight text-ink">
                {source.title}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <div className="line-clamp-2 text-sm font-medium text-ink">{source.title}</div>
          <div className="text-xs text-ink-muted">
            {source.author_text || source.organization || "Unknown author"}
            {source.publication_year ? ` · ${source.publication_year}` : ""}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <ResearchStatusBadge status={source.processing_status} />
            <ResearchAvailabilityBadge availability={source.availability_type} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/research/${source.id}`}
      className="surface block p-4 transition hover:border-accent"
    >
      <div className="flex gap-4">
        {source.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.cover_image_url}
            alt=""
            className="hidden h-24 w-16 shrink-0 rounded-md object-cover sm:block"
          />
        ) : (
          <div className="hidden h-24 w-16 shrink-0 rounded-md bg-bg-muted sm:block" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="badge">
              {RESEARCH_SOURCE_TYPE_LABELS[source.source_type]}
            </span>
            <ResearchStatusBadge status={source.processing_status} />
            <ResearchAvailabilityBadge availability={source.availability_type} />
            {source.evidence_rating && (
              <span className="badge badge-info">
                Evidence: {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
                {!source.evidence_rating_approved ? " (pending)" : ""}
              </span>
            )}
            {source.has_summary && <span className="badge badge-accent">Summary</span>}
          </div>
          <h2 className="font-display text-xl text-ink">{source.title}</h2>
          {source.subtitle && (
            <p className="text-sm text-ink-muted">{source.subtitle}</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {source.author_text || source.organization || "Unknown author"}
            {source.publication_year ? ` · ${source.publication_year}` : ""}
            {source.added_by_display_name
              ? ` · Added by ${source.added_by_display_name}`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-subtle">
            <span>{source.finding_count} findings</span>
            <span>{source.linked_question_count} questions</span>
            <span>{source.linked_principle_count} principles</span>
            <span>Added {source.created_at.slice(0, 10)}</span>
            {source.processed_at && (
              <span>Processed {source.processed_at.slice(0, 10)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
