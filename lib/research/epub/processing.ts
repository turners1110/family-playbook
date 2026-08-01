/**
 * EPUB extract + source-grounded analysis queue (separate from public overview).
 */
import {
  getPublicResearchArtifactStore,
  newId,
  nowIso,
} from "@/lib/research/public-research/artifact-store";
import {
  getPublicOverview,
} from "@/lib/research/public-research/pipeline";
import type { ResearchProcessingJob, ResearchPublicOverview } from "@/lib/research/types";
import {
  inspectAndExtractEpub,
  type EpubInspectionResult,
} from "@/lib/research/epub/extract";
import {
  listChapterMetaForSource,
  listDocumentsForSource,
  saveEpubExtraction,
} from "@/lib/research/epub/document-store";
import { getResearchStorageMode } from "@/lib/research/mode";
import { assertNoFakeCitations } from "@/lib/research/public-research/provider";

const EPUB_DEDUPE = "epub_source_grounded_v1";
const DEFAULT_CONCURRENCY = 2;

type QueueItem = {
  jobId: string;
  sourceId: string;
  familyId: string;
  fileId: string;
  buffer: Buffer;
};

const queue: QueueItem[] = [];
let active = 0;
let concurrency = DEFAULT_CONCURRENCY;

let onSourcePatch:
  | ((
      sourceId: string,
      patch: Record<string, unknown>,
    ) => Promise<void> | void)
  | null = null;

export function setEpubProcessingSourcePatcher(
  fn: ((sourceId: string, patch: Record<string, unknown>) => Promise<void> | void) | null,
) {
  onSourcePatch = fn;
}

export function setEpubProcessingConcurrency(n: number) {
  concurrency = Math.max(1, Math.min(3, Math.floor(n)));
}

async function patchSource(sourceId: string, patch: Record<string, unknown>) {
  const { applyResearchSourceStatusPatch } = await import(
    "@/lib/research/public-research/pipeline"
  );
  await applyResearchSourceStatusPatch(sourceId, patch);
  if (onSourcePatch) await onSourcePatch(sourceId, patch);
}

/**
 * Queue EPUB extraction + source-grounded analysis after upload finalize.
 * Upload request should call this without awaiting completion.
 */
export async function queueEpubProcessing(input: {
  sourceId: string;
  familyId: string;
  fileId: string;
  buffer: Buffer;
  force?: boolean;
}): Promise<ResearchProcessingJob> {
  const store = getPublicResearchArtifactStore();
  const existing = store.jobs.find(
    (j) =>
      j.source_id === input.sourceId &&
      j.dedupe_key === EPUB_DEDUPE &&
      (j.status === "queued" || j.status === "running"),
  );
  if (existing && !input.force) return existing;

  const ts = nowIso();
  const job: ResearchProcessingJob = {
    id: newId("job"),
    source_id: input.sourceId,
    family_id: input.familyId,
    job_type: "epub_source_grounded",
    status: "queued",
    progress_percent: 0,
    current_stage: "upload_complete",
    error_code: null,
    safe_error_message: null,
    ai_provider: null,
    model_name: null,
    prompt_version: null,
    source_count: 0,
    dedupe_key: EPUB_DEDUPE,
    created_at: ts,
    updated_at: ts,
    started_at: null,
    completed_at: null,
  };
  store.jobs.unshift(job);
  await patchSource(input.sourceId, {
    processing_status: "source_text_uploaded",
    epub_uploaded: true,
    source_grounded_status: "queued",
  });

  queue.push({
    jobId: job.id,
    sourceId: input.sourceId,
    familyId: input.familyId,
    fileId: input.fileId,
    buffer: input.buffer,
  });
  void pump();
  return job;
}

async function pump() {
  while (active < concurrency && queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    active += 1;
    void run(item)
      .catch(() => undefined)
      .finally(() => {
        active -= 1;
        void pump();
      });
  }
}

async function run(item: QueueItem) {
  const store = getPublicResearchArtifactStore();
  const job = store.jobs.find((j) => j.id === item.jobId);
  if (!job || job.status === "cancelled") return;

  job.status = "running";
  job.started_at = nowIso();
  job.updated_at = job.started_at;

  const setStage = async (stage: string, percent: number) => {
    job.current_stage = stage;
    job.progress_percent = percent;
    job.updated_at = nowIso();
  };

  try {
    await setStage("validating_epub", 10);
    await patchSource(item.sourceId, {
      processing_status: "extracting_source_text",
      source_grounded_status: "processing",
    });

    await setStage("detecting_drm", 20);
    const result = await inspectAndExtractEpub(item.buffer);

    if (result.drmProtected) {
      await setStage("drm_protected", 100);
      saveEpubExtraction({
        sourceId: item.sourceId,
        fileId: item.fileId,
        result,
      });
      await patchSource(item.sourceId, {
        processing_status: "awaiting_source_text",
        drm_protected: true,
        epub_uploaded: true,
        readable_text_extracted: false,
        availability_type: "partial_text",
        source_grounded_status: "failed",
        chapters_processed: 0,
        book_pages_processed: 0,
        full_book_processed: false,
        total_words_extracted: 0,
      });
      job.status = "completed";
      job.completed_at = nowIso();
      job.safe_error_message =
        "This EPUB appears to be DRM-protected. The app cannot read its book text.";
      job.error_code = "drm_protected";
      return;
    }

    if (result.status === "failed") {
      throw Object.assign(new Error(result.errorMessage ?? "EPUB extraction failed"), {
        code: result.errorCode ?? "epub_failed",
      });
    }

    await setStage("reading_manifest", 35);
    await setStage("extracting_chapters", 55);
    const saved = saveEpubExtraction({
      sourceId: item.sourceId,
      fileId: item.fileId,
      result,
    });

    await setStage("validating_coverage", 65);
    const availability = result.fullTextAvailable ? "full_text" : "partial_text";
    await patchSource(item.sourceId, {
      drm_protected: false,
      epub_uploaded: true,
      readable_text_extracted: true,
      availability_type: availability,
      chapters_processed: result.chapterCount,
      book_pages_processed: 0,
      full_book_processed: result.fullTextAvailable,
      total_words_extracted: result.totalWordCount,
      public_sources_reviewed:
        getPublicOverview(item.sourceId)?.source_count ?? undefined,
    });

    await setStage("generating_summary", 75);
    const grounded = await generateSourceGroundedOverview({
      sourceId: item.sourceId,
      result,
      chapterTitles: saved.chapters.map((c) => c.chapter_title),
    });

    // Preserve public overview; store grounded separately.
    store.overviews = store.overviews.filter(
      (o) =>
        !(
          o.research_source_id === item.sourceId &&
          o.processing_mode === "source_grounded"
        ),
    );
    store.overviews.push(grounded);

    await setStage("extracting_findings", 85);
    await setStage("generating_practical_lessons", 90);
    await compareWithPublicOverview(item.sourceId, grounded);

    await setStage("awaiting_review", 95);
    await patchSource(item.sourceId, {
      processing_status: "source_grounded_analysis_ready",
      source_grounded_status: "complete",
      needs_review: true,
    });

    job.status = "completed";
    job.progress_percent = 100;
    job.current_stage = "complete";
    job.completed_at = nowIso();
    job.updated_at = job.completed_at;
    job.ai_provider = grounded.ai_provider;
    job.model_name = grounded.model_name;
    job.prompt_version = grounded.prompt_version;

    if (getResearchStorageMode() === "supabase") {
      await persistEpubToSupabase({
        familyId: item.familyId,
        sourceId: item.sourceId,
        fileId: item.fileId,
        result,
        grounded,
      }).catch(() => undefined);
    }
  } catch (error) {
    job.status = "failed";
    job.error_code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "epub_processing_failed";
    job.safe_error_message =
      error instanceof Error ? error.message.slice(0, 300) : "EPUB processing failed";
    job.current_stage = "failed";
    job.completed_at = nowIso();
    job.updated_at = job.completed_at;
    await patchSource(item.sourceId, {
      processing_status: "processing_failed",
      source_grounded_status: "failed",
    });
  }
}

async function generateSourceGroundedOverview(input: {
  sourceId: string;
  result: EpubInspectionResult;
  chapterTitles: string[];
}): Promise<ResearchPublicOverview> {
  const publicOverview = getPublicOverview(input.sourceId);
  const short = `Source-grounded overview from uploaded EPUB (${input.result.chapterCount} chapters, ${input.result.totalWordCount} words). Public overview preserved separately.`;
  assertNoFakeCitations(short);

  const chapterSummaries = input.chapterTitles.slice(0, 20).map((title, i) => {
    const line = `Chapter “${title}” (source section ${i + 1}) — preliminary notes pending review.`;
    assertNoFakeCitations(line);
    return line;
  });

  const detailed = [
    short,
    "",
    "Source basis: uploaded_epub",
    "Full book analyzed: " + (input.result.fullTextAvailable ? "Yes" : "Partial"),
    "",
    "Chapter notes:",
    ...chapterSummaries,
  ].join("\n");

  const lessons = [
    "Review chapter notes with Sam and Michelle before adopting any practice.",
    "Prefer chapter-referenced claims over remembered public summaries.",
  ];
  for (const lesson of lessons) assertNoFakeCitations(lesson);

  const comparisonNotes: string[] = [];
  if (publicOverview) {
    comparisonNotes.push(
      "Public overview remains available for comparison; this analysis is source-grounded.",
    );
  }

  return {
    id: newId("pov"),
    research_source_id: input.sourceId,
    processing_mode: "source_grounded",
    short_summary: short,
    detailed_overview: detailed,
    main_themes: input.chapterTitles.slice(0, 5),
    author_arguments: [],
    core_framework: null,
    important_conclusions: [
      "Uploaded EPUB text was processed by chapter; findings need human review.",
    ],
    practical_lessons: lessons,
    questions_raised: [
      "Which chapter claims should become discussion questions?",
    ],
    discussion_points: [
      "Compare this EPUB analysis with the earlier public-source overview.",
      ...comparisonNotes,
    ],
    relevant_checklist_task_ids: publicOverview?.relevant_checklist_task_ids ?? [],
    relevant_question_ids: publicOverview?.relevant_question_ids ?? [],
    potential_principles: publicOverview?.potential_principles ?? [],
    related_research: [],
    criticism_limitations: [
      "EPUB chapter structure may differ from print editions; no print page numbers are invented.",
    ],
    areas_of_disagreement: [],
    confidence: input.result.fullTextAvailable ? "moderate" : "low",
    review_status: "needs_review",
    full_book_processed: input.result.fullTextAvailable,
    source_basis: "uploaded_text",
    ai_provider: "mock-epub-ai",
    model_name: "mock-epub-v1",
    prompt_version: "epub-grounded-v1",
    source_count: input.result.chapterCount,
    created_at: nowIso(),
    updated_at: nowIso(),
    approved_by_member_id: null,
    approved_at: null,
  };
}

async function compareWithPublicOverview(
  sourceId: string,
  grounded: ResearchPublicOverview,
) {
  const publicOverview = getPublicOverview(sourceId);
  if (!publicOverview) return;
  const store = getPublicResearchArtifactStore();
  // Remove prior comparisons for this source
  store.comparisons = store.comparisons.filter(
    (c) => c.research_source_id !== sourceId,
  );
  const themes = publicOverview.main_themes.slice(0, 5);
  for (const theme of themes) {
    const present = grounded.main_themes.some((t) =>
      t.toLowerCase().includes(theme.toLowerCase().slice(0, 12)),
    );
    store.comparisons.push({
      id: newId("cmp"),
      research_source_id: sourceId,
      claim_key: theme.slice(0, 80),
      claim_text: theme,
      comparison_status: present
        ? "confirmed_by_uploaded_text"
        : "still_uncertain",
      public_overview_id: publicOverview.id,
      notes: present
        ? "Theme also appears in EPUB chapter structure/titles."
        : "Not clearly confirmed from chapter titles alone; needs review.",
      created_at: nowIso(),
    });
  }
}

async function persistEpubToSupabase(input: {
  familyId: string;
  sourceId: string;
  fileId: string;
  result: EpubInspectionResult;
  grounded: ResearchPublicOverview;
}) {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  const docs = listDocumentsForSource(input.sourceId);
  const doc = docs[0];
  if (!doc) return;

  await admin
    .from("research_source_files")
    .update({
      extraction_status: input.result.status,
      drm_protected: input.result.drmProtected,
      extraction_error_code: input.result.errorCode,
      extraction_error_message: input.result.errorMessage,
    })
    .eq("id", input.fileId);

  await admin.from("research_source_documents").upsert({
    id: doc.id,
    source_id: input.sourceId,
    file_id: input.fileId,
    extraction_version: doc.extraction_version,
    language: doc.language,
    total_word_count: doc.total_word_count,
    chapter_count: doc.chapter_count,
    full_text_available: doc.full_text_available,
    extraction_status: doc.extraction_status,
    extraction_error_code: doc.extraction_error_code,
    title: doc.title,
    author: doc.author,
    publisher: doc.publisher,
    identifier: doc.identifier,
    drm_protected: doc.drm_protected,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  });

  const chapterRows = listChapterMetaForSource(input.sourceId);
  // Need full text from store — use internal list
  const { getChapterText } = await import("@/lib/research/epub/document-store");
  for (const ch of chapterRows) {
    await admin.from("research_source_chapters").upsert({
      id: ch.id,
      document_id: ch.document_id,
      source_id: ch.source_id,
      chapter_index: ch.chapter_index,
      chapter_title: ch.chapter_title,
      source_href: ch.source_href,
      word_count: ch.word_count,
      extracted_text: getChapterText(ch.id) ?? "",
      summary_status: ch.summary_status,
      finding_count: ch.finding_count,
      review_status: ch.review_status,
      created_at: ch.created_at,
    });
  }

  await admin
    .from("research_sources")
    .update({
      processing_status: input.result.drmProtected
        ? "awaiting_source_text"
        : "source_grounded_analysis_ready",
      availability_type: input.result.fullTextAvailable
        ? "full_text"
        : "partial_text",
      drm_protected: input.result.drmProtected,
      epub_uploaded: true,
      readable_text_extracted: !input.result.drmProtected && input.result.chapterCount > 0,
      chapters_processed: input.result.chapterCount,
      total_words_extracted: input.result.totalWordCount,
      full_book_processed: input.result.fullTextAvailable,
      source_grounded_status: input.result.drmProtected ? "failed" : "complete",
      updated_at: nowIso(),
    })
    .eq("id", input.sourceId)
    .eq("family_id", input.familyId);

  if (!input.result.drmProtected) {
    await admin.from("research_public_overviews").upsert(
      {
        id: input.grounded.id,
        research_source_id: input.grounded.research_source_id,
        processing_mode: "source_grounded",
        short_summary: input.grounded.short_summary,
        detailed_overview: input.grounded.detailed_overview,
        main_themes: input.grounded.main_themes,
        author_arguments: input.grounded.author_arguments,
        core_framework: input.grounded.core_framework,
        important_conclusions: input.grounded.important_conclusions,
        practical_lessons: input.grounded.practical_lessons,
        questions_raised: input.grounded.questions_raised,
        discussion_points: input.grounded.discussion_points,
        relevant_checklist_task_ids: input.grounded.relevant_checklist_task_ids,
        relevant_question_ids: input.grounded.relevant_question_ids,
        potential_principles: input.grounded.potential_principles,
        related_research: input.grounded.related_research,
        criticism_limitations: input.grounded.criticism_limitations,
        areas_of_disagreement: input.grounded.areas_of_disagreement,
        confidence: input.grounded.confidence,
        review_status: "needs_review",
        full_book_processed: input.grounded.full_book_processed,
        source_basis: "uploaded_text",
        ai_provider: input.grounded.ai_provider,
        model_name: input.grounded.model_name,
        prompt_version: input.grounded.prompt_version,
        source_count: input.grounded.source_count,
        created_at: input.grounded.created_at,
        updated_at: input.grounded.updated_at,
      },
      { onConflict: "research_source_id,processing_mode" },
    );
  }
}

export async function waitForEpubProcessingIdle(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (active === 0 && queue.length === 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("EPUB processing queue did not drain in time.");
}

export function getEpubCoverageExtras(sourceId: string) {
  const docs = listDocumentsForSource(sourceId);
  const doc = docs[0];
  const chapterMeta = listChapterMetaForSource(sourceId);
  return {
    epub_uploaded: Boolean(doc),
    drm_protected: doc?.drm_protected ?? false,
    readable_text_extracted:
      Boolean(doc) && !doc?.drm_protected && (doc?.chapter_count ?? 0) > 0,
    chapters_detected: doc?.chapter_count ?? chapterMeta.length,
    chapters_processed: chapterMeta.length,
    total_words_extracted: doc?.total_word_count ?? 0,
    full_book_processed: Boolean(doc?.full_text_available),
    chapters: chapterMeta,
    document: doc ?? null,
  };
}
