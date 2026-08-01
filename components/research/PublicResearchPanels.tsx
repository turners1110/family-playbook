import type {
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
          label="Public sources reviewed"
          value={String(coverage.public_sources_reviewed)}
        />
        <MetaRow label="Uploaded files" value={String(coverage.uploaded_files)} />
        <MetaRow
          label="Book pages processed"
          value={String(coverage.book_pages_processed)}
        />
        <MetaRow
          label="Chapters processed"
          value={String(coverage.chapters_processed)}
        />
        <MetaRow
          label="Full book processed"
          value={coverage.full_book_processed ? "Yes" : "No"}
        />
        <MetaRow
          label="Public overview"
          value={coverage.public_overview.replaceAll("_", " ")}
        />
        <MetaRow
          label="Source-grounded analysis"
          value={coverage.source_grounded_analysis.replaceAll("_", " ")}
        />
      </dl>
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
        <MetaRow
          label="Confidence"
          value={overview.confidence}
        />
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

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="font-medium text-ink">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-subtle">
        Source basis: Public sources · Confidence: see overview · Review status: Needs
        review
      </p>
    </div>
  );
}

export function PreliminaryFindingsPanel({
  findings,
}: {
  findings: ResearchPreliminaryFinding[];
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl">Preliminary findings</h2>
      {findings.length === 0 ? (
        <p className="mt-3 text-ink-muted">No preliminary findings yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {findings.map((finding) => (
            <article key={finding.id} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="badge">{finding.finding_type}</span>
                <span className="badge badge-info">Preliminary</span>
                <span className="badge">Needs review</span>
                <span className="badge">
                  Confidence: {finding.confidence ?? "low"}
                </span>
              </div>
              <h3 className="font-display text-lg">{finding.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{finding.finding_text}</p>
              <p className="mt-2 text-xs text-ink-subtle">
                Source basis: {finding.source_basis.replaceAll("_", " ")} · Supporting
                public sources: {finding.external_source_ids.length}
              </p>
            </article>
          ))}
        </div>
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
        <p className="mt-3 text-ink-muted">No public sources stored yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sources.map((source) => (
            <li key={source.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="font-medium text-ink">{source.title}</div>
              <div className="text-ink-muted">
                {[source.author, source.publisher].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="badge">{source.source_type.replaceAll("_", " ")}</span>
                <span className="badge">
                  {source.reliability_rating.replaceAll("_", " ")}
                </span>
              </div>
              {source.url ? (
                <a
                  href={source.url}
                  className="mt-2 inline-block text-accent underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source
                </a>
              ) : null}
              {source.notes ? (
                <p className="mt-2 text-ink-subtle">{source.notes}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-subtle">
                Accessed {source.accessed_at.slice(0, 10)}
              </p>
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
              </span>
              <span className="badge">{job.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AddBookTextPanel({ sourceId }: { sourceId: string }) {
  return (
    <section className="surface space-y-4 p-5">
      <h2 className="font-display text-xl">Add book text</h2>
      <p className="text-sm text-ink-muted">
        Upload an EPUB, PDF, selected chapters, page scans, or paste notes/excerpts to
        improve analysis. The public overview is preserved; source-grounded analysis is
        stored separately.
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={`/research/${sourceId}?tab=file`}>
          Upload EPUB / PDF / chapters / scans
        </a>
        <a className="btn btn-secondary" href={`/research/${sourceId}?tab=notes`}>
          Paste notes or excerpts
        </a>
      </div>
      <p className="text-xs text-ink-subtle">
        Option: Add book text to improve this analysis
      </p>
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
