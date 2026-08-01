import type {
  ResearchCoverageComparison,
  ResearchExternalSource,
  ResearchPreliminaryFinding,
  ResearchProcessingJob,
  ResearchPublicOverview,
  ResearchSourceCoverage,
} from "@/lib/research/types";
import { researchPlaybookGateNotice } from "@/lib/research/public-research/pipeline";
import {
  CancelPublicOverviewButton,
  GeneratePublicOverviewButton,
} from "@/components/research/PublicResearchActions";
import { AddBookTextPanel } from "@/components/research/AddBookTextPanel";

export { AddBookTextPanel };

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="text-sm">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function PublicResearchNotice() {
  return (
    <div className="rounded-xl border border-border bg-warning-soft px-3 py-3 text-sm text-warning">
      <p className="font-medium">
        This overview was generated from public sources about the book. The full
        book has not been processed.
      </p>
      <p className="mt-2 text-ink-muted">{researchPlaybookGateNotice()}</p>
    </div>
  );
}

export function SourceCoveragePanel({ coverage }: { coverage: ResearchSourceCoverage }) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Source coverage</h2>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <MetaRow
          label="EPUB uploaded"
          value={coverage.epub_uploaded ? "Yes" : "No"}
        />
        <MetaRow
          label="DRM protected"
          value={coverage.drm_protected ? "Yes" : "No"}
        />
        <MetaRow
          label="Readable text extracted"
          value={coverage.readable_text_extracted ? "Yes" : "No"}
        />
        <MetaRow
          label="Chapters detected"
          value={String(coverage.chapters_detected ?? 0)}
        />
        <MetaRow
          label="Chapters processed"
          value={String(coverage.chapters_processed)}
        />
        <MetaRow
          label="Total words extracted"
          value={String(coverage.total_words_extracted ?? 0)}
        />
        <MetaRow
          label="Full book processed"
          value={coverage.full_book_processed ? "Yes" : "No"}
        />
        <MetaRow
          label="Public overview available"
          value={
            coverage.public_overview_available ||
            coverage.public_overview === "complete"
              ? "Yes"
              : "No"
          }
        />
        <MetaRow
          label="Source-grounded analysis status"
          value={coverage.source_grounded_analysis.replaceAll("_", " ")}
        />
        <MetaRow
          label="Public sources reviewed"
          value={String(coverage.public_sources_reviewed)}
        />
        <MetaRow label="Uploaded files" value={String(coverage.uploaded_files)} />
      </dl>
    </section>
  );
}

function comparisonLabel(
  status: ResearchCoverageComparison["comparison_status"],
) {
  switch (status) {
    case "confirmed_by_uploaded_text":
      return "Confirmed by EPUB";
    case "expanded_by_uploaded_text":
      return "Expanded by EPUB";
    case "not_supported_by_uploaded_text":
      return "Not found in uploaded text";
    case "contradicted_by_uploaded_text":
      return "Contradicted by EPUB";
    case "still_uncertain":
    default:
      return "Still uncertain";
  }
}

export function CoverageComparisonPanel({
  comparisons,
}: {
  comparisons: ResearchCoverageComparison[];
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Coverage comparison</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Public-source overview vs source-grounded EPUB analysis. Labels do not
        invent page numbers.
      </p>
      {comparisons.length === 0 ? (
        <p className="mt-3 text-ink-muted">
          No comparison yet. Upload a readable EPUB after a public overview is
          ready.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {comparisons.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{row.claim_text}</span>
                <span className="badge">{comparisonLabel(row.comparison_status)}</span>
              </div>
              {row.notes ? (
                <p className="mt-1 text-ink-muted">{row.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChaptersPanel({
  chapters,
}: {
  chapters: Array<{
    id: string;
    chapter_index: number;
    chapter_title: string;
    word_count: number;
    summary_status: string;
    finding_count: number;
    review_status: string;
  }>;
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Chapters</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Full chapter text is not shown by default. Summaries and findings remain
        private until reviewed.
      </p>
      {chapters.length === 0 ? (
        <p className="mt-3 text-ink-muted">No chapters extracted yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {chapters.map((ch) => (
            <li
              key={ch.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div className="font-medium">
                {ch.chapter_index + 1}. {ch.chapter_title}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-ink-subtle">
                <span>{ch.word_count} words</span>
                <span>Summary: {ch.summary_status.replaceAll("_", " ")}</span>
                <span>Findings: {ch.finding_count}</span>
                <span>Review: {ch.review_status.replaceAll("_", " ")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SourceGroundedSummaryPanel({
  overview,
  drmProtected,
  jobMessage,
}: {
  overview: ResearchPublicOverview | null;
  drmProtected?: boolean;
  jobMessage?: string | null;
}) {
  if (drmProtected) {
    return (
      <section className="surface space-y-3 p-5">
        <h2 className="font-display text-xl">Source-grounded summary</h2>
        <div className="rounded-xl border border-border bg-warning-soft px-3 py-3 text-sm text-warning">
          This EPUB appears to be DRM-protected. The app cannot read its book
          text. You can still add Kobo highlights, notes, excerpts, or selected
          page scans.
        </div>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="surface space-y-3 p-5">
        <h2 className="font-display text-xl">Source-grounded summary</h2>
        <p className="text-ink-muted">
          {jobMessage ||
            "Not started. Upload book text to create a separate source-grounded analysis. The public overview stays preserved."}
        </p>
      </section>
    );
  }

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">Source-grounded summary</h2>
        <span className="badge badge-accent">uploaded_epub</span>
        <span className="badge">Needs review</span>
      </div>
      <p className="text-ink-muted">{overview.short_summary}</p>
      <div>
        <h3 className="font-medium text-ink">Detailed summary</h3>
        <p className="mt-1 whitespace-pre-wrap text-ink-muted">
          {overview.detailed_overview}
        </p>
      </div>
      <ListBlock title="Important conclusions" items={overview.important_conclusions} />
      <ListBlock title="Practical lessons" items={overview.practical_lessons} />
      <ListBlock title="Questions raised" items={overview.questions_raised} />
      <ListBlock
        title="Points Sam and Michelle should discuss"
        items={overview.discussion_points}
      />
      <p className="text-xs text-ink-subtle">
        Source basis: uploaded_epub · Provider {overview.ai_provider} · model{" "}
        {overview.model_name} · prompt {overview.prompt_version}
      </p>
    </section>
  );
}

export function PublicOverviewPanel({
  overview,
  sourceId,
}: {
  overview: ResearchPublicOverview | null;
  sourceId: string;
}) {
  if (!overview) {
    return (
      <section className="surface space-y-4 p-5">
        <h2 className="font-display text-xl">Public-source overview</h2>
        <p className="text-ink-muted">
          No public overview yet. Generate one from lawful public sources without
          uploading the book.
        </p>
        <GeneratePublicOverviewButton sourceId={sourceId} />
      </section>
    );
  }

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">Public-source overview</h2>
        <span className="badge badge-info">Public overview available</span>
      </div>
      <PublicResearchNotice />
      <dl className="grid gap-2 sm:grid-cols-3">
        <MetaRow label="Source basis" value="Public sources only" />
        <MetaRow label="Full book analyzed" value="No" />
        <MetaRow label="Confidence" value={overview.confidence} />
        <MetaRow label="Review status" value="Needs review" />
      </dl>
      <div>
        <h3 className="font-medium text-ink">Short summary</h3>
        <p className="mt-1 text-ink-muted">{overview.short_summary}</p>
      </div>
      <div>
        <h3 className="font-medium text-ink">Detailed overview</h3>
        <p className="mt-1 whitespace-pre-wrap text-ink-muted">
          {overview.detailed_overview}
        </p>
      </div>
      <ListBlock title="Main themes" items={overview.main_themes} />
      <ListBlock
        title="Author’s publicly stated arguments"
        items={overview.author_arguments}
      />
      {overview.core_framework ? (
        <div>
          <h3 className="font-medium text-ink">Core framework</h3>
          <p className="mt-1 text-ink-muted">{overview.core_framework}</p>
        </div>
      ) : null}
      <ListBlock title="Important conclusions" items={overview.important_conclusions} />
      <ListBlock title="Preliminary practical lessons" items={overview.practical_lessons} />
      <ListBlock title="Questions raised" items={overview.questions_raised} />
      <ListBlock
        title="Points Sam and Michelle should discuss"
        items={overview.discussion_points}
      />
      <ListBlock title="Potential family principles" items={overview.potential_principles} />
      <ListBlock title="Related research" items={overview.related_research} />
      <ListBlock title="Criticism and limitations" items={overview.criticism_limitations} />
      <ListBlock title="Areas of disagreement" items={overview.areas_of_disagreement} />
      <p className="text-xs text-ink-subtle">
        Provider {overview.ai_provider} · model {overview.model_name} · prompt{" "}
        {overview.prompt_version} · {overview.source_count} sources
      </p>
    </section>
  );
}

export function PreliminaryFindingsPanel({
  findings,
}: {
  findings: ResearchPreliminaryFinding[];
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Key findings</h2>
      {findings.length === 0 ? (
        <p className="mt-3 text-ink-muted">No findings yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-xl border border-border px-3 py-3 text-sm"
            >
              <div className="font-medium">{finding.title}</div>
              <p className="mt-1 text-ink-muted">{finding.finding_text}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-subtle">
                <span>Basis: {finding.source_basis}</span>
                <span>Review: {finding.review_status}</span>
                {finding.is_preliminary ? <span>Preliminary</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PublicSourcesPanel({
  sources,
}: {
  sources: ResearchExternalSource[];
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Public sources</h2>
      {sources.length === 0 ? (
        <p className="mt-3 text-ink-muted">No public sources recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sources.map((source) => (
            <li
              key={source.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div className="font-medium">{source.title || source.url}</div>
              <div className="text-ink-subtle">
                {source.source_type} · {source.publisher || "Unknown publisher"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProcessingHistoryPanel({ jobs }: { jobs: ResearchProcessingJob[] }) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Processing history</h2>
      {jobs.length === 0 ? (
        <p className="mt-3 text-ink-muted">No jobs yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <span>
                {job.job_type.replaceAll("_", " ")} · {job.current_stage ?? job.status}
                {job.safe_error_message ? ` — ${job.safe_error_message}` : ""}
              </span>
              <span className="badge">{job.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PublicResearchControls({
  sourceId,
  hasOverview,
  busy,
}: {
  sourceId: string;
  hasOverview: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <GeneratePublicOverviewButton
        sourceId={sourceId}
        label={hasOverview ? "Regenerate public overview" : "Generate public overview"}
        force={hasOverview}
      />
      {busy ? <CancelPublicOverviewButton sourceId={sourceId} /> : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="font-medium text-ink">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
