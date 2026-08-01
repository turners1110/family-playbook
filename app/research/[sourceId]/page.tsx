import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  ResearchAvailabilityBadge,
  ResearchStatusBadge,
} from "@/components/research/ResearchSourceCard";
import {
  ApproveSummaryButton,
  ResearchDetailActions,
} from "@/components/research/ResearchDetailActions";
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
  "summary",
  "findings",
  "lessons",
  "chapters",
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

  const { source, files, summaries, notes, links } = detail;
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
              {source.evidence_rating && (
                <span className="badge badge-info">
                  Evidence: {RESEARCH_EVIDENCE_RATING_LABELS[source.evidence_rating]}
                  {source.evidence_rating_approved ? "" : " · needs approval"}
                </span>
              )}
            </div>
            {source.subtitle && <p className="text-ink-muted">{source.subtitle}</p>}
            <p className="mt-2 text-sm text-ink-subtle">
              Added {source.created_at.slice(0, 10)}
              {source.added_by_display_name
                ? ` by ${source.added_by_display_name}`
                : ""}
              {source.publisher ? ` · ${source.publisher}` : ""}
              {source.edition ? ` · ${source.edition}` : ""}
              {source.isbn ? ` · ISBN ${source.isbn}` : ""}
            </p>
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
        {DETAIL_TABS.map((key) => (
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
              {shortSummary?.content || source.description || "No short summary yet."}
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
              {source.evidence_rating_reason && (
                <div>
                  <dt className="text-ink-subtle">Rating explanation</dt>
                  <dd>{source.evidence_rating_reason}</dd>
                </div>
              )}
            </dl>
          </section>
          <ResearchDetailActions sourceId={sourceId} questions={questionOptions} />
        </div>
      )}

      {tab === "summary" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Summaries</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Manual summaries only in Phase 1. AI extraction arrives in Phase 2.
            Label whether content is source-stated, AI interpretation, or practical application.
          </p>
          <ul className="mt-4 space-y-3">
            {summaries.length === 0 && (
              <li className="text-sm text-ink-muted">No summaries yet.</li>
            )}
            {summaries.map((summary) => (
              <li key={summary.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge">{summary.summary_type.replaceAll("_", " ")}</span>
                  <span className="badge">{summary.content_basis.replaceAll("_", " ")}</span>
                  <span className="badge">{summary.review_status.replaceAll("_", " ")}</span>
                  {summary.review_status === "needs_review" && (
                    <ApproveSummaryButton summaryId={summary.id} sourceId={sourceId} />
                  )}
                </div>
                <p className="whitespace-pre-wrap text-ink">{summary.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(tab === "findings" || tab === "lessons" || tab === "chapters" || tab === "history") && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">{labelTab(tab)}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Automated {labelTab(tab).toLowerCase()} arrive in Phase 2. Use manual summaries and
            notes for now.
          </p>
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
                  {link.relevance_note && (
                    <p className="mt-1 text-ink-muted">{link.relevance_note}</p>
                  )}
                </li>
              ) : null,
            )}
          </ul>
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
              <li key={link.id}>
                {principle?.title ?? link.principle_id}
                {link.relevance_note ? ` — ${link.relevance_note}` : ""}
              </li>
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
                <div className="mb-1 flex flex-wrap gap-2">
                  <span className="badge">
                    {note.note_scope === "sam"
                      ? "Sam"
                      : note.note_scope === "michelle"
                        ? "Michelle"
                        : "Shared"}
                  </span>
                  {note.pinned && <span className="badge badge-warning">Pinned</span>}
                  {note.page_or_chapter && (
                    <span className="badge">{note.page_or_chapter}</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{note.text}</p>
                <p className="mt-2 text-xs text-ink-subtle">
                  {note.author_display_name} · {note.created_at.slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "file" && (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Source file</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Files are private. Raw storage URLs are never exposed. Signed downloads and the PDF
            viewer arrive with Phase 2/3 after Supabase Storage is configured.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {files.length === 0 && <li className="text-ink-muted">No uploaded file.</li>}
            {files.map((file) => (
              <li key={file.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{file.original_filename}</div>
                    <div className="text-ink-subtle">
                      {(file.file_size / 1024).toFixed(1)} KB · {file.mime_type} · hash{" "}
                      {file.file_hash.slice(0, 12)}… · extraction {file.extraction_status}
                    </div>
                  </div>
                  <ResearchFileDownloadButton sourceId={sourceId} fileId={file.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

function labelTab(key: string) {
  switch (key) {
    case "overview":
      return "Overview";
    case "summary":
      return "Summary";
    case "findings":
      return "Key Findings";
    case "lessons":
      return "Practical Lessons";
    case "chapters":
      return "Chapters";
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
