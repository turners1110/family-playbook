/**
 * Backend-neutral Research & Books service layer (Phase 1.5).
 * Pages/components import only from here — not local-store or Supabase clients.
 */
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  assertCanWriteResearch,
  resolveResearchFamilyId,
} from "@/lib/research/access";
import { ResearchUnavailableError } from "@/lib/research/errors";
import type { ResearchListFilters } from "@/lib/research/filters";
import { createLocalResearchRepository } from "@/lib/research/local-repository";
import {
  getResearchStorageMode,
  researchStorageLabel,
  researchWritesAllowed,
  type ResearchStorageMode,
} from "@/lib/research/mode";
import type { ResearchRepository } from "@/lib/research/repository";
import { createSupabaseResearchRepository } from "@/lib/research/supabase-repository";
import {
  clearRecommendedPrefsForTests,
  setRecommendedPrefsModeForTests,
} from "@/lib/research/recommended-prefs";
import {
  addResearchNoteSchema,
  addResearchSummarySchema,
  createResearchSourceSchema,
  linkResearchSourceSchema,
  validateResearchUpload,
  type CreateResearchSourceInput,
} from "@/lib/research/validation";

let overrideRepository: ResearchRepository | null = null;
let overrideMode: ResearchStorageMode | null = null;

export function setResearchRepositoryForTests(
  repo: ResearchRepository | null,
  mode: ResearchStorageMode | null = null,
) {
  overrideRepository = repo;
  overrideMode = mode;
  setRecommendedPrefsModeForTests(mode);
  if (!repo) clearRecommendedPrefsForTests();
}

export function getResearchStorageStatus(): {
  mode: ResearchStorageMode;
  label: string;
  writesAllowed: boolean;
} {
  const mode = overrideMode ?? getResearchStorageMode();
  return {
    mode,
    label: researchStorageLabel(mode),
    writesAllowed: researchWritesAllowed(mode),
  };
}

function getRepository(): ResearchRepository {
  if (overrideRepository) return overrideRepository;
  const mode = getResearchStorageMode();
  if (mode === "local") return createLocalResearchRepository();
  if (mode === "supabase") return createSupabaseResearchRepository();
  throw new ResearchUnavailableError();
}

async function familyIdFor(ctx?: FamilyContext | null) {
  if (!ctx) {
    // Read-only paths that need family without write context (Trip Mode emergency
    // still goes through requireFamilyContext at the page layer).
    const { resolveTurnerFamilyId } = await import("@/lib/db/remote-json-store");
    const mode = overrideMode ?? getResearchStorageMode();
    if (mode === "local") return "family_turner";
    return resolveTurnerFamilyId();
  }
  const mode = overrideMode ?? getResearchStorageMode();
  if (mode === "local") return ctx.family.id;
  return resolveResearchFamilyId(ctx);
}

function assertWritable() {
  const status = getResearchStorageStatus();
  if (!status.writesAllowed) throw new ResearchUnavailableError();
}

export async function listResearchSources(
  filters?: ResearchListFilters,
  ctx?: FamilyContext,
) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    const familySources = await repo.listSources(familyId, {
      ...filters,
      // Fetch full family list; composeLibraryList applies tab filters.
      tab: undefined,
    });
    const { loadRecommendedPrefs } = await import("@/lib/research/recommended-prefs");
    const { composeLibraryList } = await import("@/lib/research/recommended");
    const prefs = await loadRecommendedPrefs(familyId);
    return composeLibraryList({
      familyId,
      familySources,
      prefs,
      filters,
    });
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return [];
    throw error;
  }
}

export async function addRecommendedToLibrary(ctx: FamilyContext, slug: string) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const { getRecommendedBySlug } = await import("@/lib/research/recommended-seed");
  const entry = getRecommendedBySlug(slug);
  if (!entry) throw new Error("Recommendation not found.");

  const familyId = await familyIdFor(ctx);
  const {
    loadRecommendedPrefs,
    markRecommendedAdded,
  } = await import("@/lib/research/recommended-prefs");
  const prefs = await loadRecommendedPrefs(familyId);
  if (prefs.added[slug]) return prefs.added[slug];

  const sourceId = await createResearchSource(ctx, {
    title: entry.title,
    source_type: entry.source_type,
    author_text: entry.author_text,
    organization: entry.organization,
    publication_year: entry.publication_year,
    description: entry.description,
    topics: entry.topics,
    life_stages: entry.life_stages,
    evidence_basis: entry.evidence_basis ?? undefined,
    evidence_rating: entry.evidence_rating ?? undefined,
    ownership_status: entry.ownership_status ?? undefined,
    ingestion_path: "metadata_only",
    rights_attested: false,
    recommended_slug: entry.slug,
  });
  await markRecommendedAdded(familyId, slug, sourceId);
  return sourceId;
}

export async function hideRecommendedLibraryItem(
  ctx: FamilyContext,
  slug: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const familyId = await familyIdFor(ctx);
  const { hideRecommendedSource } = await import("@/lib/research/recommended-prefs");
  await hideRecommendedSource(familyId, slug);
}

export async function getResearchSource(sourceId: string, ctx?: FamilyContext) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    const detail = await repo.getSource(familyId, sourceId);
    if (!detail) return null;

    const {
      getPublicOverview,
      listExternalSources,
      listPreliminaryFindings,
      listJobsForSource,
      getResearchCoverage,
      getCachedSourceResearchStatus,
    } = await import("@/lib/research/public-research/pipeline");

    const cached = getCachedSourceResearchStatus(sourceId);
    const coverageBase = getResearchCoverage(sourceId);
    const {
      getEpubCoverageExtras,
      hydrateEpubArtifactsFromSupabase,
      describeEpubProcessStatus,
    } = await import("@/lib/research/epub/processing");
    await hydrateEpubArtifactsFromSupabase(sourceId);
    const epub = getEpubCoverageExtras(sourceId);
    const coverage = {
      ...coverageBase,
      epub_uploaded: epub.epub_uploaded || coverageBase.epub_uploaded,
      drm_protected: epub.drm_protected || coverageBase.drm_protected,
      readable_text_extracted:
        epub.readable_text_extracted || coverageBase.readable_text_extracted,
      chapters_detected: Math.max(
        epub.chapters_detected,
        coverageBase.chapters_detected ?? 0,
      ),
      chapters_processed: Math.max(
        epub.chapters_processed,
        coverageBase.chapters_processed,
      ),
      total_words_extracted: Math.max(
        epub.total_words_extracted,
        coverageBase.total_words_extracted ?? 0,
      ),
      full_book_processed:
        epub.full_book_processed || coverageBase.full_book_processed,
      public_overview_available: Boolean(
        getPublicOverview(sourceId, "public_sources_only"),
      ),
    };
    const source = {
      ...detail.source,
      ...(cached ?? {}),
      public_sources_reviewed: coverage.public_sources_reviewed,
      uploaded_file_count: coverage.uploaded_files,
      book_pages_processed: coverage.book_pages_processed,
      chapters_processed: coverage.chapters_processed,
      full_book_processed: coverage.full_book_processed,
      public_overview_status: coverage.public_overview,
      source_grounded_status: coverage.source_grounded_analysis,
      finding_count: listPreliminaryFindings(sourceId).length,
    };

    const { getPublicResearchArtifactStore } = await import(
      "@/lib/research/public-research/artifact-store"
    );
    const comparisons = getPublicResearchArtifactStore().comparisons.filter(
      (c) => c.research_source_id === sourceId,
    );

    const jobs = listJobsForSource(sourceId);
    const sourceGroundedOverview = getPublicOverview(sourceId, "source_grounded");
    const processStatus = describeEpubProcessStatus({
      jobs,
      hasEpubFile:
        detail.files.some(
          (f) =>
            f.mime_type.includes("epub") ||
            f.original_filename.toLowerCase().endsWith(".epub"),
        ) || epub.epub_uploaded,
      drmProtected: coverage.drm_protected,
      readableExtracted: coverage.readable_text_extracted,
      hasGroundedOverview: Boolean(sourceGroundedOverview),
    });

    return {
      ...detail,
      source,
      externalSources: listExternalSources(sourceId),
      publicOverview: getPublicOverview(sourceId, "public_sources_only"),
      sourceGroundedOverview,
      preliminaryFindings: listPreliminaryFindings(sourceId),
      jobs,
      coverage,
      chapters: epub.chapters,
      epubDocument: epub.document,
      comparisons,
      epubProcessStatus: processStatus,
    };
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return null;
    throw error;
  }
}

export async function createResearchSource(
  ctx: FamilyContext,
  raw: CreateResearchSourceInput,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = createResearchSourceSchema.parse({
    ...raw,
    rights_attested: raw.rights_attested === true,
  });
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  const sourceId = await repo.createSource(familyId, ctx, data);

  if (data.source_type === "book") {
    await queuePublicResearchForSource(ctx, familyId, sourceId);
  }

  return sourceId;
}

async function queuePublicResearchForSource(
  ctx: FamilyContext,
  familyId: string,
  sourceId: string,
) {
  const repo = getRepository();
  const detail = await repo.getSource(familyId, sourceId);
  if (!detail) return;

  const {
    queuePublicBookResearch,
    setPublicResearchSourcePatcher,
  } = await import("@/lib/research/public-research/pipeline");

  setPublicResearchSourcePatcher(async (id, patch) => {
    try {
      await repo.updateSource(familyId, id, patch);
    } catch {
      // Local/memory may not persist every coverage column yet.
    }
  });

  let questionIds: string[] = [];
  let checklistTaskIds: string[] = [];
  try {
    const { readStore } = await import("@/lib/db/store");
    const store = await readStore();
    questionIds = store.questions.filter((q) => q.active).map((q) => q.id);
    checklistTaskIds = (store.checklist_tasks ?? [])
      .filter((t) => !t.archived)
      .map((t) => t.id);
  } catch {
    // Store may be unavailable in some test modes.
  }

  await queuePublicBookResearch({
    source: detail.source,
    familyId,
    questionIds,
    checklistTaskIds,
  });
}

export async function generatePublicOverviewForSource(
  ctx: FamilyContext,
  sourceId: string,
  options?: { force?: boolean },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const familyId = await familyIdFor(ctx);
  const detail = await getResearchSource(sourceId, ctx);
  if (!detail) throw new Error("Source not found.");
  if (detail.source.source_type !== "book") {
    throw new Error("Public overview is only available for books.");
  }

  const {
    queuePublicBookResearch,
    retryPublicBookResearch,
    setPublicResearchSourcePatcher,
  } = await import("@/lib/research/public-research/pipeline");
  const repo = getRepository();
  setPublicResearchSourcePatcher(async (id, patch) => {
    try {
      await repo.updateSource(familyId, id, patch);
    } catch {
      /* ignore */
    }
  });

  let questionIds: string[] = [];
  let checklistTaskIds: string[] = [];
  try {
    const { readStore } = await import("@/lib/db/store");
    const store = await readStore();
    questionIds = store.questions.filter((q) => q.active).map((q) => q.id);
    checklistTaskIds = (store.checklist_tasks ?? [])
      .filter((t) => !t.archived)
      .map((t) => t.id);
  } catch {
    /* ignore */
  }

  if (options?.force) {
    return retryPublicBookResearch({
      source: detail.source,
      familyId,
      questionIds,
      checklistTaskIds,
    });
  }
  return queuePublicBookResearch({
    source: detail.source,
    familyId,
    questionIds,
    checklistTaskIds,
  });
}

export async function generatePublicOverviewsForRecommendedBooks(
  ctx: FamilyContext,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const familyId = await familyIdFor(ctx);
  const sources = await listResearchSources({ tab: "my-library" }, ctx);
  const books = sources.filter(
    (s) => s.source_type === "book" && Boolean(s.recommended_slug),
  );
  const {
    queueBulkPublicOverviews,
    setPublicResearchSourcePatcher,
  } = await import("@/lib/research/public-research/pipeline");
  const repo = getRepository();
  setPublicResearchSourcePatcher(async (id, patch) => {
    try {
      await repo.updateSource(familyId, id, patch);
    } catch {
      /* ignore */
    }
  });

  let questionIds: string[] = [];
  let checklistTaskIds: string[] = [];
  try {
    const { readStore } = await import("@/lib/db/store");
    const store = await readStore();
    questionIds = store.questions.filter((q) => q.active).map((q) => q.id);
    checklistTaskIds = (store.checklist_tasks ?? [])
      .filter((t) => !t.archived)
      .map((t) => t.id);
  } catch {
    /* ignore */
  }

  return queueBulkPublicOverviews({
    sources: books,
    familyId,
    questionIds,
    checklistTaskIds,
  });
}

export async function cancelPublicOverviewJob(ctx: FamilyContext, sourceId: string) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const { cancelPublicBookResearch } = await import(
    "@/lib/research/public-research/pipeline"
  );
  await cancelPublicBookResearch(sourceId);
}

export async function updateResearchSource(
  ctx: FamilyContext,
  sourceId: string,
  patch: Parameters<ResearchRepository["updateSource"]>[2],
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.updateSource(familyId, sourceId, patch);
}

export async function archiveResearchSource(
  ctx: FamilyContext,
  sourceId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.archiveSource(familyId, sourceId);
}

export async function addResearchNote(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = addResearchNoteSchema.parse(raw);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.addNote(familyId, ctx, data);
}

export async function addResearchSummary(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = addResearchSummarySchema.parse(raw);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.addSummary(familyId, data);
}

export async function approveResearchSummary(
  ctx: FamilyContext,
  summaryId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.approveSummary(familyId, summaryId, ctx.member.id);
}

export async function linkResearchQuestion(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = linkResearchSourceSchema.parse(raw);
  if (!data.question_id && !data.principle_id) {
    throw new Error("Link a question or principle.");
  }
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.linkQuestion(familyId, data);
}

/** @deprecated Use linkResearchQuestion */
export const linkResearchSource = linkResearchQuestion;

const uploadActionTimestamps = new Map<string, number[]>();

function assertUploadRateLimit(key: string, maxPerMinute = 12) {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (uploadActionTimestamps.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (recent.length >= maxPerMinute) {
    throw new Error("Too many upload actions. Wait a moment and try again.");
  }
  recent.push(now);
  uploadActionTimestamps.set(key, recent);
}

const LEGACY_PROCESSING_STATUS: Record<string, string> = {
  source_text_uploaded: "queued",
  extracting_source_text: "processing",
  source_grounded_analysis_ready: "needs_review",
  awaiting_source_text: "processing_failed",
  public_research_queued: "queued",
  gathering_public_sources: "processing",
  public_overview_ready: "processed",
};

function sanitizeSourcePatch(
  patch: Record<string, unknown>,
  legacy = false,
): Record<string, unknown> {
  const next = { ...patch };
  if (legacy && typeof next.processing_status === "string") {
    next.processing_status =
      LEGACY_PROCESSING_STATUS[next.processing_status] ?? next.processing_status;
  }
  if (legacy) {
    // Drop columns that may not exist until migration 0011 is applied.
    delete next.source_grounded_status;
    delete next.chapters_processed;
    delete next.full_book_processed;
    delete next.needs_review;
    delete next.book_pages_processed;
    delete next.public_sources_reviewed;
    delete next.public_overview_status;
    delete next.finding_count;
  }
  // Unarchive when reprocessing an uploaded book.
  if (next.processing_status && next.processing_status !== "archived") {
    next.archived_at = null;
  }
  return next;
}

export async function prepareResearchUpload(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    filename: string;
    size: number;
    type?: string;
    fileHash: string;
    rightsAttested?: boolean;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  assertUploadRateLimit(`${ctx.profile.id}:prepare`);
  if (!input.rightsAttested) {
    throw new Error(
      "Confirm you have the right to upload and privately process this file.",
    );
  }
  const check = validateResearchUpload({
    name: input.filename,
    size: input.size,
    type: input.type,
  });
  if (!check.ok) throw new Error(check.error);

  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.prepareUpload(familyId, {
    sourceId: input.sourceId,
    filename: input.filename,
    mimeType: check.mimeType,
    fileSize: input.size,
    fileHash: input.fileHash,
    rightsAttested: true,
  });
}

export async function finalizeResearchUpload(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    fileHash: string;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  assertUploadRateLimit(`${ctx.profile.id}:finalize`);
  const check = validateResearchUpload({
    name: input.originalFilename,
    size: input.fileSize,
    type: input.mimeType,
  });
  if (!check.ok) throw new Error(check.error);

  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  const file = await repo.finalizeUpload(familyId, {
    sourceId: input.sourceId,
    storagePath: input.storagePath,
    originalFilename: input.originalFilename,
    mimeType: check.mimeType,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
  });

  const { markSourceTextUploaded } = await import(
    "@/lib/research/public-research/pipeline"
  );
  const isEpub =
    check.mimeType.includes("epub") ||
    input.originalFilename.toLowerCase().endsWith(".epub");
  await markSourceTextUploaded({
    sourceId: input.sourceId,
    fileCount: 1,
    pagesProcessed: 0,
    chaptersProcessed: 0,
    fullBook: false,
    epubUploaded: isEpub,
  });

  if (isEpub) {
    await queueEpubAfterUpload(ctx, familyId, file);
  }

  return file;
}

async function queueEpubAfterUpload(
  ctx: FamilyContext,
  familyId: string,
  file: {
    id: string;
    source_id: string;
    storage_path: string;
    mime_type: string;
    original_filename: string;
  },
  options?: { force?: boolean; advance?: boolean },
) {
  const repo = getRepository();
  const {
    enqueueEpubJob,
    setEpubProcessingSourcePatcher,
    runEpubJobToCompletion,
    advanceEpubJob,
  } = await import("@/lib/research/epub/runner");
  const { getResearchStorageMode } = await import("@/lib/research/mode");

  setEpubProcessingSourcePatcher(async (id, patch) => {
    try {
      await repo.updateSource(familyId, id, sanitizeSourcePatch(patch));
    } catch {
      try {
        await repo.updateSource(familyId, id, sanitizeSourcePatch(patch, true));
      } catch {
        /* optional columns may be absent in local JSON / legacy schema */
      }
    }
  });

  let buffer: Buffer | null = null;
  if (repo.readUploadedBytes) {
    buffer = await repo.readUploadedBytes(familyId, file.storage_path);
  }

  const job = await enqueueEpubJob({
    sourceId: file.source_id,
    familyId,
    fileId: file.id,
    buffer,
    force: options?.force,
  });

  // Local/tests: finish synchronously. Production: leave queued for runner.
  if (getResearchStorageMode() !== "supabase") {
    await runEpubJobToCompletion(job.id);
  } else if (options?.advance) {
    await advanceEpubJob({ jobId: job.id, maxStages: 2 });
  }

  return job;
}

/** Local/memory only helper used by import script and tests. */
export async function uploadResearchFile(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    filename: string;
    mimeType?: string;
    buffer: Buffer;
    fileHash: string;
    rightsAttested?: boolean;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const check = validateResearchUpload({
    name: input.filename,
    size: input.buffer.length,
    type: input.mimeType,
  });
  if (!check.ok) throw new Error(check.error);
  if (input.rightsAttested === false) {
    throw new Error(
      "Confirm you have the right to upload and privately process this file.",
    );
  }
  const repo = getRepository();
  if (!repo.uploadFileBytes) {
    throw new Error(
      "Direct byte upload is only available for local/import paths. Use signed upload in production.",
    );
  }
  const familyId = await familyIdFor(ctx);
  const file = await repo.uploadFileBytes(familyId, {
    sourceId: input.sourceId,
    filename: input.filename,
    mimeType: check.mimeType,
    buffer: input.buffer,
    fileHash: input.fileHash,
    rightsAttested: true,
  });

  const { markSourceTextUploaded } = await import(
    "@/lib/research/public-research/pipeline"
  );
  const isEpub =
    check.mimeType.includes("epub") ||
    input.filename.toLowerCase().endsWith(".epub");
  await markSourceTextUploaded({
    sourceId: input.sourceId,
    fileCount: 1,
    pagesProcessed: 0,
    chaptersProcessed: 0,
    fullBook: false,
    epubUploaded: isEpub,
  });

  if (isEpub) {
    await queueEpubAfterUpload(ctx, familyId, file);
  }
  return file;
}

/** Start or resume processing for an already-uploaded EPUB (no re-upload). */
export async function processExistingEpubUpload(
  ctx: FamilyContext,
  sourceId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  assertUploadRateLimit(`${ctx.profile.id}:process-epub`, 8);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  const detail = await repo.getSource(familyId, sourceId);
  if (!detail) throw new Error("Source not found.");
  const file =
    detail.files.find(
      (f) =>
        f.mime_type.includes("epub") ||
        f.original_filename.toLowerCase().endsWith(".epub"),
    ) ?? detail.files[0];
  if (!file) {
    throw new Error("No uploaded EPUB file found for this book.");
  }
  const job = await queueEpubAfterUpload(ctx, familyId, file, {
    force: false,
    advance: true,
  });
  return { ok: true as const, jobId: job.id, status: job.status };
}

/** Advance the active EPUB job by a few stages (timeout-safe). */
export async function runNextEpubProcessingStep(
  ctx: FamilyContext,
  sourceId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  assertUploadRateLimit(`${ctx.profile.id}:epub-step`, 30);
  const familyId = await familyIdFor(ctx);
  const repo = getRepository();
  const detail = await repo.getSource(familyId, sourceId);
  if (!detail) throw new Error("Source not found.");

  const {
    hydrateEpubArtifactsFromSupabase,
    advanceEpubJob,
    enqueueEpubJob,
    setEpubProcessingSourcePatcher,
  } = await import("@/lib/research/epub/runner");
  setEpubProcessingSourcePatcher(async (id, patch) => {
    try {
      await repo.updateSource(familyId, id, sanitizeSourcePatch(patch));
    } catch {
      try {
        await repo.updateSource(familyId, id, sanitizeSourcePatch(patch, true));
      } catch {
        /* ignore */
      }
    }
  });
  await hydrateEpubArtifactsFromSupabase(sourceId);

  const { listJobsForSource } = await import(
    "@/lib/research/public-research/pipeline"
  );
  let job = listJobsForSource(sourceId).find(
    (j) =>
      j.job_type === "epub_source_grounded" &&
      (j.status === "queued" ||
        j.status === "running" ||
        j.current_stage === "awaiting_ai_configuration"),
  );

  if (!job) {
    const file =
      detail.files.find(
        (f) =>
          f.mime_type.includes("epub") ||
          f.original_filename.toLowerCase().endsWith(".epub"),
      ) ?? detail.files[0];
    if (!file) throw new Error("No uploaded EPUB file found for this book.");
    let buffer: Buffer | null = null;
    if (repo.readUploadedBytes) {
      buffer = await repo.readUploadedBytes(familyId, file.storage_path);
    }
    job = await enqueueEpubJob({
      sourceId,
      familyId,
      fileId: file.id,
      buffer,
    });
  }

  const result = await advanceEpubJob({ jobId: job.id, maxStages: 2 });
  return {
    ok: true as const,
    jobId: result.job?.id ?? job.id,
    status: result.job?.status ?? job.status,
    stage: result.job?.current_stage ?? null,
    stagesRun: result.stagesRun,
    done: result.done,
  };
}

export async function retryEpubProcessing(
  ctx: FamilyContext,
  sourceId: string,
  fileId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  assertUploadRateLimit(`${ctx.profile.id}:retry-epub`, 6);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  const detail = await repo.getSource(familyId, sourceId);
  if (!detail) throw new Error("Source not found.");
  const file = detail.files.find((f) => f.id === fileId);
  if (!file) throw new Error("File not found.");
  const job = await queueEpubAfterUpload(ctx, familyId, file, {
    force: true,
    advance: true,
  });
  return { ok: true as const, jobId: job.id };
}

export async function createSignedResearchFileUrl(
  ctx: FamilyContext,
  sourceId: string,
  fileId: string,
) {
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.createSignedDownloadUrl(familyId, sourceId, fileId);
}

export async function getResearchForQuestion(
  questionId: string,
  ctx?: FamilyContext,
) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    return repo.getLinksForQuestion(familyId, questionId);
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return [];
    throw error;
  }
}

export async function checkResearchBackendHealth(): Promise<boolean> {
  try {
    const mode = overrideMode ?? getResearchStorageMode();
    if (mode === "unavailable") return false;
    return getRepository().healthCheck();
  } catch {
    return false;
  }
}
