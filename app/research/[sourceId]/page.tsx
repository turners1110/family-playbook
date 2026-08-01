import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  ResearchAvailabilityBadge,
  ResearchStatusBadge,
} from "@/components/research/ResearchSourceCard";
import {
  ResearchDetailActions,
} from "@/components/research/ResearchDetailActions";
import {
  AddBookTextPanel,
  PreliminaryFindingsPanel,
  ProcessingHistoryPanel,
  PublicOverviewPanel,
  PublicResearchControls,
  PublicSourcesPanel,
  SourceCoveragePanel,
} from "@/components/research/PublicResearchPanels";
import { getResearchSource } from "@/lib/research/services";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { availabilityDisclosure } from "@/lib/research/validation";
import {
  RESEARCH_EVIDENCE_RATING_LABELS,
  RESEARCH_SOURCE_TYPE_LABELS,
  RESEARCH_TOPIC_LABELS,
  type ResearchTopicKey,
} from "@/lib/research/types";
import { readStore } from "@/lib/db/store";
import { LIFE_STAGE_LABELS, type LifeStage } from "@/lib/constants/enums";
import { ResearchFileDownloadButton } from "@/components/research/ResearchFileDownloadButton";

export const dynamic = "force-dynamic";

const DETAIL_TABS = [
  "overview",
  "public-overview",
  "findings",
  "lessons",
  "public-sources",
  "add-text",
  "source-grounded",
  "coverage",
  "questions",
  "principles",
  "notes",
  "file",
  "history",
] as const;

export default async function ResearchSourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireFamilyContext();
  const { sourceId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = (DETAIL_TABS.includes(rawTab as never) ? rawTab : "overview") as
    | (typeof DETAIL_TABS)[number];
  const detail = await getResearchSource(sourceId, ctx);
  if (!detail) notFound();

  const {
    source,
    files,
    summaries,
    notes,
    links,
    externalSources = [],
    publicOverview = null,
    sourceGroundedOverview = null,
    preliminaryFindings = [],
    jobs = [],
    coverage = {
      public_sources_reviewed: 0,
      uploaded_files: 0,
      book_pages_processed: 0,
      chapters_processed: 0,
      full_book_processed: false,
      public_overview: "not_started" as const,
      source_grounded_analysis: "not_started" as const,
    },
  } = detail;
  const store = await readStore();
  const questionOptions = store.questions
    .filter((q) => q.active)
    .map((q) => ({ id: q.id, short_title: q.short_title }))
    .slice(0, 400);
  const linkedQuestions = links
    .filter((l) => l.question_id)
    .map((l) => ({
      link: l,
      question: store.questions.find((q) => q.id === l.question_id),
    }));
  const linkedPrinciples = links
    .filter((l) => l.principle_id)
    .map((l) => ({
      link: l,
      principle: store.principles.find((p) => p.id === l.principle_id),
    }));

  const shortSummary = summaries.find((s) => s.summary_type === "short_summary");
  const why = summaries.find((s) => s.summary_type === "why_it_matters");
  const isBook = source.source_type === "book";
  const busy = ["queued", "running"].some((status) =>
    jobs.some((j) => j.status === status),
  );

  return (
    <AppShell
      title={source.title}
      subtitle={[
        source.author_text || source.organization,
        source.publication_year,
        RESEARCH_SOURCE_TYPE_LABELS[source.source_type],
      ]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <Link href="/research" className="btn btn-ghost">
          Library
        </Link>
      }
    >
      <section className="surface mb-5 p-5">
        <div className="flex flex-wrap gap-4">
          {source.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.cover_image_url}
              alt=""
              className="h-40 w-28 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-40 w-28 items-end rounded-md bg-bg-muted p-2 font-display text-sm">
              {source.title}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2">
              <ResearchStatusBadge status={source.processing_status} />
              <ResearchAvailabilityBadge availability={source.availability_type} />
              {publicOverview ? (
                <span className="badge badge-accent">Public overview available</span>
              ) : null}
              {source.evidence_rating && (
                <span className="badge badge-info">
                  Evidence: {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
                  {source.evidence_rating_approved ? "" : " · needs approval"}
                </span>
              )}
            </div>
            {source.subtitle && <p className="text-ink-muted">{source.subtitle}</p>}
            {isBook ? (
              <div className="mt-3 space-y-2">
                <dl className="grid gap-1 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-subtle">Source basis</dt>
                    <dd>Public sources only</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Full book analyzed</dt>
                    <dd>{coverage.full_book_processed ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Public overview</dt>
                    <dd>{coverage.public_overview.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
                <PublicResearchControls
                  sourceId={sourceId}
                  hasOverview={Boolean(publicOverview)}
                  busy={busy}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {source.topics.map((topic) => (
                <span key={topic} className="badge">
                  {RESEARCH_TOPIC_LABELS[topic as ResearchTopicKey] ?? topic}
                </span>
              ))}
              {source.life_stages.map((stage) => (
                <span key={stage} className="badge badge-info">
                  {LIFE_STAGE_LABELS[stage as LifeStage] ?? stage}
                </span>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
              {availabilityDisclosure(source.availability_type)}
            </p>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {DETAIL_TABS.filter((key) => {
          if (!isBook && ["public-overview", "public-sources", "add-text", "source-grounded", "coverage"].includes(key)) {
            return false;
          }
          if (!sourceGroundedOverview && key === "source-grounded") {
            return coverage.uploaded_files > 0 || coverage.source_grounded_analysis !== "not_started";
          }
          return true;
        }).map((key) => (
          <Link
            key={key}
            href={`/research/${sourceId}?tab=${key}`}
            className={`badge ${tab === key ? "badge-accent" : ""}`}
          >
            {labelTab(key)}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="surface p-5">
            <h2 className="font-display text-xl">Overview</h2>
            <p className="mt-3 text-ink-muted">
              {publicOverview?.short_summary ||
                shortSummary?.content ||
                source.description ||
                "No overview yet."}
            </p>
            {why && (
              <p className="mt-4 text-sm text-ink-muted">
                <strong>Why it matters:</strong> {why.content}
              </p>
            )}
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-ink-subtle">Source type</dt>
                <dd>{RESEARCH_SOURCE_TYPE_LABELS[source.source_type]}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Evidence basis</dt>
                <dd>{source.evidence_basis?.replaceAll("_", " ") ?? "Unset"}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Text available</dt>
                <dd>{availabilityDisclosure(source.availability_type)}</dd>
              </div>
            </dl>
          </section>
          <div className="space-y-5">
            {isBook ? <SourceCoveragePanel coverage={coverage} /> : null}
            <ResearchDetailActions sourceId={sourceId} questions={questionOptions} />
          </div>
        </div>
      )}

      {tab === "public-overview" && isBook && (
        <PublicOverviewPanel overview={publicOverview} sourceId={sourceId} />
      )}

      {tab === "findings" && (
        <PreliminaryFindingsPanel findings={preliminaryFindings} />
      )}

      {tab === "lessons" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Preliminary practical lessons</h2>
          {publicOverview?.practical_lessons?.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-muted">
              {publicOverview.practical_lessons.map((lesson) => (
                <li key={lesson}>{lesson}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-muted">No preliminary lessons yet.</p>
          )}
          <p className="mt-3 text-xs text-ink-subtle">
            Source basis: Public sources · Review status: Needs review
          </p>
        </section>
      )}

      {tab === "public-sources" && isBook && (
        <PublicSourcesPanel sources={externalSources} />
      )}

      {tab === "add-text" && isBook && <AddBookTextPanel sourceId={sourceId} />}

      {tab === "coverage" && isBook && <SourceCoveragePanel coverage={coverage} />}

      {tab === "source-grounded" && (
        <section className="surface space-y-4 p-5">
          <h2 className="font-display text-xl">Source-grounded analysis</h2>
          {sourceGroundedOverview ? (
            <p className="text-ink-muted">{sourceGroundedOverview.short_summary}</p>
          ) : (
            <p className="text-ink-muted">
              Not started. Upload book text to create a separate source-grounded analysis.
              The public overview stays preserved for comparison.
            </p>
          )}
          {publicOverview && sourceGroundedOverview ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <h3 className="font-medium">Public overview</h3>
                <p className="mt-2 text-sm text-ink-muted">{publicOverview.short_summary}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <h3 className="font-medium">Source-grounded analysis</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {sourceGroundedOverview.short_summary}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {tab === "questions" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Linked questions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {linkedQuestions.length === 0 && (
              <li className="text-ink-muted">No linked questions yet.</li>
            )}
            {linkedQuestions.map(({ link, question }) =>
              question ? (
                <li key={link.id} className="rounded-xl border border-border px-3 py-2">
                  <Link href={`/questions/${question.slug}`} className="hover:text-accent">
                    {question.short_title}
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
          {publicOverview?.relevant_question_ids?.length ? (
            <p className="mt-4 text-sm text-ink-muted">
              Likely relevant question IDs from public overview (needs review):{" "}
              {publicOverview.relevant_question_ids.length}
            </p>
          ) : null}
        </section>
      )}

      {tab === "principles" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Linked principles</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {linkedPrinciples.length === 0 && (
              <li className="text-ink-muted">No linked principles yet.</li>
            )}
            {linkedPrinciples.map(({ link, principle }) => (
              <li key={link.id}>{principle?.title ?? link.principle_id}</li>
            ))}
          </ul>
        </section>
      )}

      {tab === "notes" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Notes</h2>
          <ul className="mt-3 space-y-3">
            {notes.length === 0 && <li className="text-sm text-ink-muted">No notes yet.</li>}
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="whitespace-pre-wrap">{note.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "file" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Source file</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Upload EPUB, PDF, selected chapters, or scans to improve analysis. Public
            overview remains separate.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {files.length === 0 && <li className="text-ink-muted">No uploaded file.</li>}
            {files.map((file) => (
              <li key={file.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{file.original_filename}</div>
                    <div className="text-ink-subtle">
                      {(file.file_size / 1024).toFixed(1)} KB · {file.mime_type}
                    </div>
                  </div>
                  <ResearchFileDownloadButton sourceId={sourceId} fileId={file.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "history" && <ProcessingHistoryPanel jobs={jobs} />}
    </AppShell>
  );
}

function labelTab(key: string) {
  switch (key) {
    case "overview":
      return "Overview";
    case "public-overview":
      return "Public Overview";
    case "findings":
      return "Preliminary Findings";
    case "lessons":
      return "Practical Lessons";
    case "public-sources":
      return "Public Sources";
    case "add-text":
      return "Add Book Text";
    case "source-grounded":
      return "Source-Grounded Summary";
    case "coverage":
      return "Coverage Comparison";
    case "questions":
      return "Linked Questions";
    case "principles":
      return "Linked Principles";
    case "notes":
      return "Notes";
    case "file":
      return "Source File";
    case "history":
      return "Processing History";
    default:
      return key;
  }
}
