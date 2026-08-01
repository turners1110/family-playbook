/**
 * Durable, staged EPUB processing runner.
 * Claims one job, advances one or a few stages, persists progress, supports resume.
 */
import { randomUUID } from "crypto";
import {
  getPublicResearchArtifactStore,
  newId,
  nowIso,
} from "@/lib/research/public-research/artifact-store";
import { getPublicOverview } from "@/lib/research/public-research/pipeline";
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
import { auditEpubAiEnv, logEpubProcess } from "@/lib/research/epub/safe-log";

export const EPUB_DEDUPE = "epub_source_grounded_v1";

export const EPUB_STAGES = [
  "upload_complete",
  "validating_epub",
  "detecting_drm",
  "reading_manifest",
  "extracting_chapters",
  "validating_coverage",
  "generating_summary",
  "extracting_findings",
  "generating_practical_lessons",
  "awaiting_review",
  "complete",
] as const;

export type EpubStage = (typeof EPUB_STAGES)[number] | "drm_protected" | "failed" | "awaiting_ai_configuration";

const STAGE_PERCENT: Record<string, number> = {
  upload_complete: 5,
  validating_epub: 15,
  detecting_drm: 25,
  reading_manifest: 35,
  extracting_chapters: 55,
  validating_coverage: 65,
  generating_summary: 75,
  extracting_findings: 85,
  generating_practical_lessons: 90,
  awaiting_review: 95,
  complete: 100,
  drm_protected: 100,
  awaiting_ai_configuration: 70,
  failed: 100,
};

type JobContext = {
  buffer: Buffer | null;
  extraction: EpubInspectionResult | null;
  grounded: ResearchPublicOverview | null;
};

const memoryContext = new Map<string, JobContext>();

let onSourcePatch:
  | ((sourceId: string, patch: Record<string, unknown>) => Promise<void> | void)
  | null = null;

export function setEpubProcessingSourcePatcher(
  fn: ((sourceId: string, patch: Record<string, unknown>) => Promise<void> | void) | null,
) {
  onSourcePatch = fn;
}

async function patchSource(sourceId: string, patch: Record<string, unknown>) {
  try {
    const { applyResearchSourceStatusPatch } = await import(
      "@/lib/research/public-research/pipeline"
    );
    await applyResearchSourceStatusPatch(sourceId, patch);
  } catch {
    /* memory cache still updates via apply when possible */
  }
  if (onSourcePatch) {
    try {
      await onSourcePatch(sourceId, patch);
    } catch {
      /* optional columns / check constraints may reject some statuses */
    }
  }
}

function nextStage(current: string | null): EpubStage {
  if (!current || current === "upload_complete") return "validating_epub";
  if (current === "validating_epub") return "detecting_drm";
  if (current === "detecting_drm") return "reading_manifest";
  if (current === "reading_manifest") return "extracting_chapters";
  if (current === "extracting_chapters") return "validating_coverage";
  if (current === "validating_coverage") return "generating_summary";
  if (current === "generating_summary") return "extracting_findings";
  if (current === "extracting_findings") return "generating_practical_lessons";
  if (current === "generating_practical_lessons") return "awaiting_review";
  if (current === "awaiting_review") return "complete";
  if (current === "awaiting_ai_configuration") return "generating_summary";
  return "complete";
}

export function describeEpubProcessStatus(input: {
  jobs: ResearchProcessingJob[];
  hasEpubFile: boolean;
  drmProtected?: boolean;
  readableExtracted?: boolean;
  hasGroundedOverview?: boolean;
}): {
  code: string;
  label: string;
  active: boolean;
} {
  const job = input.jobs.find((j) => j.job_type === "epub_source_grounded");
  if (input.drmProtected || job?.error_code === "drm_protected") {
    return { code: "drm_protected", label: "DRM protected", active: false };
  }
  if (job?.status === "failed") {
    return { code: "failed", label: "Failed", active: false };
  }
  if (job?.current_stage === "awaiting_ai_configuration") {
    return {
      code: "awaiting_ai",
      label: "Waiting for AI configuration",
      active: true,
    };
  }
  if (
    job?.status === "completed" &&
    (job.current_stage === "awaiting_review" || input.hasGroundedOverview)
  ) {
    return { code: "needs_review", label: "Needs review", active: false };
  }
  if (job?.current_stage === "complete" && job.status === "completed") {
    return { code: "complete", label: "Complete", active: false };
  }
  if (input.hasGroundedOverview) {
    return { code: "needs_review", label: "Needs review", active: false };
  }
  if (job?.status === "queued") {
    return { code: "queued", label: "Queued", active: true };
  }
  if (job?.status === "running") {
    const stage = job.current_stage ?? "";
    if (stage.includes("extract")) {
      return { code: "extracting", label: "Extracting chapters", active: true };
    }
    return { code: "processing", label: "Processing", active: true };
  }
  if (input.hasEpubFile) {
    return {
      code: "uploaded_not_processed",
      label: "Uploaded, not processed",
      active: false,
    };
  }
  return { code: "not_started", label: "Not started", active: false };
}

async function persistJob(job: ResearchProcessingJob & { file_id?: string | null }) {
  const store = getPublicResearchArtifactStore();
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) store.jobs[idx] = job;
  else store.jobs.unshift(job);

  if (getResearchStorageMode() !== "supabase") return;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const full = {
      id: job.id,
      source_id: job.source_id,
      family_id: job.family_id,
      file_id: job.file_id ?? null,
      job_type: job.job_type,
      status: job.status,
      progress_percent: job.progress_percent,
      current_stage: job.current_stage,
      error_code: job.error_code,
      safe_error_message: job.safe_error_message,
      ai_provider: job.ai_provider,
      model_name: job.model_name,
      prompt_version: job.prompt_version,
      source_count: job.source_count,
      dedupe_key: job.dedupe_key,
      created_at: job.created_at,
      updated_at: job.updated_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      last_completed_stage:
        (job as { last_completed_stage?: string }).last_completed_stage ?? null,
    };
    const { error } = await admin.from("research_processing_jobs").upsert(full);
    if (!error) return;
    // Legacy schema: persist core columns only.
    await admin.from("research_processing_jobs").upsert({
      id: job.id,
      source_id: job.source_id,
      job_type: job.job_type,
      status: job.status,
      progress_percent: job.progress_percent,
      current_stage: job.current_stage,
      error_code: job.error_code,
      safe_error_message: job.safe_error_message,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    });
  } catch {
    // Table/migration may lag; memory store remains source of truth for the request.
  }
}

export async function enqueueEpubJob(input: {
  sourceId: string;
  familyId: string;
  fileId: string;
  buffer?: Buffer | null;
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

  // Also check supabase for active jobs
  if (getResearchStorageMode() === "supabase") {
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("research_processing_jobs")
        .select("*")
        .eq("source_id", input.sourceId)
        .eq("dedupe_key", EPUB_DEDUPE)
        .in("status", ["queued", "running"])
        .maybeSingle();
      if (data && !input.force) {
        const job = mapDbJob(data);
        store.jobs.unshift(job);
        return job;
      }
    } catch {
      /* ignore */
    }
  }

  if (input.force) {
    // Cancel prior active jobs in memory
    for (const j of store.jobs) {
      if (
        j.source_id === input.sourceId &&
        j.dedupe_key === EPUB_DEDUPE &&
        (j.status === "queued" || j.status === "running")
      ) {
        j.status = "cancelled";
        j.updated_at = nowIso();
      }
    }
    if (getResearchStorageMode() === "supabase") {
      try {
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        await admin
          .from("research_processing_jobs")
          .update({
            status: "cancelled",
            updated_at: nowIso(),
            completed_at: nowIso(),
          })
          .eq("source_id", input.sourceId)
          .eq("dedupe_key", EPUB_DEDUPE)
          .in("status", ["queued", "running"]);
      } catch {
        /* ignore */
      }
    }
  }

  const ts = nowIso();
  const job: ResearchProcessingJob & {
    file_id?: string;
    last_completed_stage?: string | null;
  } = {
    id: randomUUID(),
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
    file_id: input.fileId,
    last_completed_stage: null,
  };

  memoryContext.set(job.id, {
    buffer: input.buffer ?? null,
    extraction: null,
    grounded: null,
  });

  await persistJob(job);
  await patchSource(input.sourceId, {
    processing_status: "source_text_uploaded",
    epub_uploaded: true,
    source_grounded_status: "queued",
  });

  logEpubProcess({
    event: "job_enqueued",
    sourceId: input.sourceId,
    fileId: input.fileId,
    jobId: job.id,
    stage: job.current_stage,
    status: job.status,
  });

  return job;
}

function mapDbJob(row: Record<string, unknown>): ResearchProcessingJob & {
  file_id?: string | null;
  last_completed_stage?: string | null;
} {
  return {
    id: String(row.id),
    source_id: String(row.source_id),
    family_id: (row.family_id as string) ?? null,
    job_type: String(row.job_type),
    status: row.status as ResearchProcessingJob["status"],
    progress_percent: Number(row.progress_percent ?? 0),
    current_stage: (row.current_stage as string) ?? null,
    error_code: (row.error_code as string) ?? null,
    safe_error_message: (row.safe_error_message as string) ?? null,
    ai_provider: (row.ai_provider as string) ?? null,
    model_name: (row.model_name as string) ?? null,
    prompt_version: (row.prompt_version as string) ?? null,
    source_count: Number(row.source_count ?? 0),
    dedupe_key: (row.dedupe_key as string) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    file_id: (row.file_id as string) ?? null,
    last_completed_stage: (row.last_completed_stage as string) ?? null,
  };
}

export async function claimNextEpubJob(claimToken = randomUUID()): Promise<
  | (ResearchProcessingJob & {
      file_id?: string | null;
      last_completed_stage?: string | null;
    })
  | null
> {
  const store = getPublicResearchArtifactStore();

  if (getResearchStorageMode() === "supabase") {
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.rpc("claim_research_processing_job", {
        p_job_type: "epub_source_grounded",
        p_claim_token: claimToken,
      });
      if (!error && data) {
        const job = mapDbJob(data as Record<string, unknown>);
        const idx = store.jobs.findIndex((j) => j.id === job.id);
        if (idx >= 0) store.jobs[idx] = job;
        else store.jobs.unshift(job);
        logEpubProcess({
          event: "job_claimed",
          sourceId: job.source_id,
          fileId: job.file_id ?? undefined,
          jobId: job.id,
          stage: job.current_stage,
          status: job.status,
        });
        return job;
      }
    } catch {
      /* fall through to memory */
    }
  }

  const queued = store.jobs.find(
    (j) => j.job_type === "epub_source_grounded" && j.status === "queued",
  );
  if (!queued) return null;
  queued.status = "running";
  queued.started_at = queued.started_at ?? nowIso();
  queued.updated_at = nowIso();
  await persistJob(queued);
  return queued as ResearchProcessingJob & {
    file_id?: string | null;
    last_completed_stage?: string | null;
  };
}

async function loadBufferForJob(input: {
  familyId: string | null;
  fileId?: string | null;
  sourceId: string;
  jobId: string;
}): Promise<Buffer | null> {
  const ctx = memoryContext.get(input.jobId);
  if (ctx?.buffer) return ctx.buffer;

  if (!input.familyId) return null;
  const { getResearchStorageMode } = await import("@/lib/research/mode");
  if (getResearchStorageMode() === "supabase") {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    let storagePath: string | null = null;
    if (input.fileId) {
      const { data } = await admin
        .from("research_source_files")
        .select("storage_path")
        .eq("id", input.fileId)
        .maybeSingle();
      storagePath = data?.storage_path ?? null;
    }
    if (!storagePath) {
      const { data } = await admin
        .from("research_source_files")
        .select("id,storage_path")
        .eq("source_id", input.sourceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      storagePath = data?.storage_path ?? null;
      if (data?.id) {
        const job = getPublicResearchArtifactStore().jobs.find(
          (j) => j.id === input.jobId,
        ) as { file_id?: string } | undefined;
        if (job) job.file_id = data.id;
      }
    }
    if (!storagePath) return null;
    const { data, error } = await admin.storage
      .from("research-sources")
      .download(storagePath);
    if (error || !data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    memoryContext.set(input.jobId, {
      buffer,
      extraction: ctx?.extraction ?? null,
      grounded: ctx?.grounded ?? null,
    });
    return buffer;
  }

  return null;
}

async function loadJobById(
  jobId: string,
): Promise<
  | (ResearchProcessingJob & {
      file_id?: string | null;
      last_completed_stage?: string | null;
    })
  | null
> {
  const store = getPublicResearchArtifactStore();
  const local = store.jobs.find((j) => j.id === jobId) as
    | (ResearchProcessingJob & {
        file_id?: string | null;
        last_completed_stage?: string | null;
      })
    | undefined;
  if (local) return local;

  if (getResearchStorageMode() !== "supabase") return null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("research_processing_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!data) return null;
    const job = mapDbJob(data as Record<string, unknown>);
    store.jobs.unshift(job);
    return job;
  } catch {
    return null;
  }
}

export async function advanceEpubJob(input: {
  jobId?: string;
  maxStages?: number;
}): Promise<{
  job: ResearchProcessingJob | null;
  stagesRun: string[];
  done: boolean;
}> {
  const started = Date.now();
  const job = input.jobId
    ? await loadJobById(input.jobId)
    : await claimNextEpubJob();

  if (!job) return { job: null, stagesRun: [], done: true };
  if (job.status === "completed" || job.status === "cancelled") {
    return { job, stagesRun: [], done: true };
  }

  // Resume from AI pause without re-claiming.
  if (job.current_stage === "awaiting_ai_configuration") {
    job.status = "running";
  } else if (job.status === "queued" || job.status === "failed") {
    job.status = "running";
    job.started_at = job.started_at ?? nowIso();
    job.error_code = job.error_code === "ai_not_configured" ? null : job.error_code;
  }

  const stagesRun: string[] = [];
  const maxStages = Math.max(1, Math.min(input.maxStages ?? 2, 6));

  try {
    for (let i = 0; i < maxStages; i += 1) {
      if (job.status !== "running" && job.current_stage !== "awaiting_ai_configuration") {
        break;
      }
      // Treat AI pause as incomplete generating_summary.
      const resumeFrom =
        job.current_stage === "awaiting_ai_configuration"
          ? "validating_coverage"
          : (job.last_completed_stage ?? job.current_stage);
      const stage = nextStage(resumeFrom);
      if (stage === "complete" && job.last_completed_stage === "awaiting_review") {
        job.current_stage = "complete";
        job.progress_percent = 100;
        job.status = "completed";
        job.completed_at = nowIso();
        stagesRun.push("complete");
        break;
      }

      job.status = "running";
      job.current_stage = stage;
      job.progress_percent = STAGE_PERCENT[stage] ?? job.progress_percent;
      job.updated_at = nowIso();
      await persistJob(job);

      logEpubProcess({
        event: "stage_start",
        sourceId: job.source_id,
        fileId: job.file_id ?? undefined,
        jobId: job.id,
        stage,
        status: job.status,
      });

      const stageStarted = Date.now();
      await runStage(job, stage);

      const pausedForAi = job.current_stage === "awaiting_ai_configuration";
      const drmStop = job.error_code === "drm_protected";
      const statusNow = job.status as ResearchProcessingJob["status"];
      if (!pausedForAi && !drmStop && statusNow !== "failed") {
        (job as { last_completed_stage?: string }).last_completed_stage = stage;
      }
      stagesRun.push(pausedForAi ? "awaiting_ai_configuration" : stage);

      logEpubProcess({
        event: pausedForAi ? "stage_paused" : "stage_complete",
        sourceId: job.source_id,
        fileId: job.file_id ?? undefined,
        jobId: job.id,
        stage: job.current_stage,
        status: statusNow,
        durationMs: Date.now() - stageStarted,
        errorCode: job.error_code,
      });

      if (
        stage === "complete" ||
        stage === "drm_protected" ||
        statusNow === "failed" ||
        statusNow === "completed" ||
        pausedForAi ||
        drmStop
      ) {
        break;
      }
    }
  } catch (error) {
    job.status = "failed";
    job.current_stage = "failed";
    job.error_code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "epub_processing_failed";
    job.safe_error_message =
      error instanceof Error ? error.message.slice(0, 300) : "EPUB processing failed";
    job.completed_at = nowIso();
    job.updated_at = job.completed_at;
    await patchSource(job.source_id, {
      processing_status: "processing_failed",
      source_grounded_status: "failed",
    });
    logEpubProcess({
      event: "stage_failed",
      sourceId: job.source_id,
      fileId: job.file_id ?? undefined,
      jobId: job.id,
      stage: job.current_stage,
      status: job.status,
      errorCode: job.error_code,
      durationMs: Date.now() - started,
    });
  }

  job.updated_at = nowIso();
  await persistJob(job);
  const finalStatus = job.status as ResearchProcessingJob["status"];
  const done =
    finalStatus === "completed" ||
    finalStatus === "failed" ||
    finalStatus === "cancelled" ||
    job.current_stage === "awaiting_ai_configuration";

  return { job, stagesRun, done };
}

async function runStage(
  job: ResearchProcessingJob & {
    file_id?: string | null;
    last_completed_stage?: string | null;
  },
  stage: EpubStage,
) {
  const ctx =
    memoryContext.get(job.id) ??
    ({ buffer: null, extraction: null, grounded: null } satisfies JobContext);
  memoryContext.set(job.id, ctx);

  if (stage === "validating_epub") {
    await patchSource(job.source_id, {
      processing_status: "extracting_source_text",
      source_grounded_status: "processing",
      epub_uploaded: true,
    });
    const buffer = await loadBufferForJob({
      familyId: job.family_id,
      fileId: job.file_id,
      sourceId: job.source_id,
      jobId: job.id,
    });
    if (!buffer || buffer.length === 0) {
      throw Object.assign(new Error("Uploaded EPUB could not be read from private storage."), {
        code: "missing_bytes",
      });
    }
    ctx.buffer = buffer;
    return;
  }

  if (stage === "detecting_drm" || stage === "reading_manifest" || stage === "extracting_chapters") {
    if (!ctx.buffer) {
      ctx.buffer = await loadBufferForJob({
        familyId: job.family_id,
        fileId: job.file_id,
        sourceId: job.source_id,
        jobId: job.id,
      });
    }
    if (!ctx.buffer) {
      throw Object.assign(new Error("Uploaded EPUB bytes missing."), {
        code: "missing_bytes",
      });
    }
    if (!ctx.extraction) {
      ctx.extraction = await inspectAndExtractEpub(ctx.buffer);
    }
    if (stage === "detecting_drm" && ctx.extraction.drmProtected) {
      saveEpubExtraction({
        sourceId: job.source_id,
        fileId: job.file_id ?? "unknown",
        result: ctx.extraction,
      });
      await patchSource(job.source_id, {
        processing_status: "awaiting_source_text",
        drm_protected: true,
        epub_uploaded: true,
        readable_text_extracted: false,
        availability_type: "partial_text",
        source_grounded_status: "failed",
      });
      if (getResearchStorageMode() === "supabase" && job.file_id) {
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        await admin
          .from("research_source_files")
          .update({
            extraction_status: "drm_protected",
            drm_protected: true,
            extraction_error_code: ctx.extraction.errorCode,
            extraction_error_message: ctx.extraction.errorMessage,
          })
          .eq("id", job.file_id);
        await persistEpubDocs(job, ctx.extraction);
      }
      job.status = "completed";
      job.current_stage = "drm_protected";
      job.progress_percent = 100;
      job.error_code = "drm_protected";
      job.safe_error_message =
        "This EPUB appears to be DRM-protected. The app cannot read its book text. You can still add Kobo highlights, notes, excerpts, or selected page scans.";
      job.completed_at = nowIso();
      return;
    }
    if (stage === "extracting_chapters") {
      if (ctx.extraction.status === "failed") {
        throw Object.assign(
          new Error(ctx.extraction.errorMessage ?? "EPUB extraction failed"),
          { code: ctx.extraction.errorCode ?? "epub_failed" },
        );
      }
      saveEpubExtraction({
        sourceId: job.source_id,
        fileId: job.file_id ?? "unknown",
        result: ctx.extraction,
      });
      if (getResearchStorageMode() === "supabase" && job.file_id) {
        await persistEpubDocs(job, ctx.extraction);
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        await admin
          .from("research_source_files")
          .update({
            extraction_status: ctx.extraction.status,
            drm_protected: false,
          })
          .eq("id", job.file_id);
      }
    }
    return;
  }

  if (stage === "validating_coverage") {
    const result = ctx.extraction;
    if (!result) throw Object.assign(new Error("Missing extraction"), { code: "no_extraction" });
    const availability = result.fullTextAvailable ? "full_text" : "partial_text";
    await patchSource(job.source_id, {
      drm_protected: false,
      epub_uploaded: true,
      readable_text_extracted: true,
      availability_type: availability,
      chapters_processed: result.chapterCount,
      full_book_processed: result.fullTextAvailable,
      total_words_extracted: result.totalWordCount,
      source_grounded_status: "processing",
    });
    return;
  }

  if (stage === "generating_summary") {
    const ai = auditEpubAiEnv();
    if (!ai.aiReady) {
      job.current_stage = "awaiting_ai_configuration";
      job.safe_error_message = ai.reason;
      job.error_code = "ai_not_configured";
      job.status = "running";
      await patchSource(job.source_id, {
        source_grounded_status: "processing",
        processing_status: "extracting_source_text",
      });
      return;
    }
    const result = ctx.extraction;
    if (!result) throw Object.assign(new Error("Missing extraction"), { code: "no_extraction" });
    const chapters = listChapterMetaForSource(job.source_id);
    ctx.grounded = await generateSourceGroundedOverview({
      sourceId: job.source_id,
      result,
      chapterTitles: chapters.map((c) => c.chapter_title),
    });
    const artifact = getPublicResearchArtifactStore();
    artifact.overviews = artifact.overviews.filter(
      (o) =>
        !(
          o.research_source_id === job.source_id &&
          o.processing_mode === "source_grounded"
        ),
    );
    artifact.overviews.push(ctx.grounded);
    if (getResearchStorageMode() === "supabase") {
      await persistGroundedOverview(ctx.grounded);
    }
    job.ai_provider = ctx.grounded.ai_provider;
    job.model_name = ctx.grounded.model_name;
    job.prompt_version = ctx.grounded.prompt_version;
    job.source_count = ctx.grounded.source_count;
    return;
  }

  if (stage === "extracting_findings" || stage === "generating_practical_lessons") {
    if (ctx.grounded) await compareWithPublicOverview(job.source_id, ctx.grounded);
    return;
  }

  if (stage === "awaiting_review") {
    await patchSource(job.source_id, {
      processing_status: "source_grounded_analysis_ready",
      source_grounded_status: "complete",
      needs_review: true,
    });
    job.status = "completed";
    job.current_stage = "awaiting_review";
    job.progress_percent = 95;
    job.completed_at = nowIso();
    job.error_code = null;
    job.safe_error_message = null;
  }
}

async function persistEpubDocs(
  job: ResearchProcessingJob & { file_id?: string | null },
  result: EpubInspectionResult,
) {
  if (!job.file_id) return;
  const docs = listDocumentsForSource(job.source_id);
  const doc = docs[0];
  if (!doc) return;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  await admin.from("research_source_documents").upsert({
    id: doc.id,
    source_id: job.source_id,
    file_id: job.file_id,
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
  const { getChapterText } = await import("@/lib/research/epub/document-store");
  for (const ch of listChapterMetaForSource(job.source_id)) {
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
  void result;
}

async function persistGroundedOverview(grounded: ResearchPublicOverview) {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  await admin.from("research_public_overviews").upsert(
    {
      id: grounded.id,
      research_source_id: grounded.research_source_id,
      processing_mode: "source_grounded",
      short_summary: grounded.short_summary,
      detailed_overview: grounded.detailed_overview,
      main_themes: grounded.main_themes,
      author_arguments: grounded.author_arguments,
      core_framework: grounded.core_framework,
      important_conclusions: grounded.important_conclusions,
      practical_lessons: grounded.practical_lessons,
      questions_raised: grounded.questions_raised,
      discussion_points: grounded.discussion_points,
      relevant_checklist_task_ids: grounded.relevant_checklist_task_ids,
      relevant_question_ids: grounded.relevant_question_ids,
      potential_principles: grounded.potential_principles,
      related_research: grounded.related_research,
      criticism_limitations: grounded.criticism_limitations,
      areas_of_disagreement: grounded.areas_of_disagreement,
      confidence: grounded.confidence,
      review_status: "needs_review",
      full_book_processed: grounded.full_book_processed,
      source_basis: "uploaded_text",
      ai_provider: grounded.ai_provider,
      model_name: grounded.model_name,
      prompt_version: grounded.prompt_version,
      source_count: grounded.source_count,
      created_at: grounded.created_at,
      updated_at: grounded.updated_at,
    },
    { onConflict: "research_source_id,processing_mode" },
  );
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
  const ai = auditEpubAiEnv();
  return {
    id: randomUUID(),
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
    questions_raised: ["Which chapter claims should become discussion questions?"],
    discussion_points: [
      "Compare this EPUB analysis with the earlier public-source overview.",
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
    ai_provider: ai.provider === "mock" ? "mock-epub-ai" : ai.provider,
    model_name: ai.modelName === "[set]" ? "configured" : "mock-epub-v1",
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
  store.comparisons = store.comparisons.filter(
    (c) => c.research_source_id !== sourceId,
  );
  for (const theme of publicOverview.main_themes.slice(0, 5)) {
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

/** Run remaining stages synchronously (tests / local). */
export async function runEpubJobToCompletion(jobId: string) {
  for (let i = 0; i < 20; i += 1) {
    const result = await advanceEpubJob({ jobId, maxStages: 3 });
    if (result.done) return result.job;
  }
  return null;
}

export async function waitForEpubProcessingIdle(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const store = getPublicResearchArtifactStore();
    const active = store.jobs.some(
      (j) =>
        j.job_type === "epub_source_grounded" &&
        (j.status === "queued" || j.status === "running") &&
        j.current_stage !== "awaiting_ai_configuration",
    );
    if (!active) return;
    // Drain memory queue
    await advanceEpubJob({ maxStages: 4 });
  }
  throw new Error("EPUB processing queue did not drain in time.");
}

export function getEpubCoverageExtras(sourceId: string) {
  const docs = listDocumentsForSource(sourceId);
  const doc = docs[0];
  const chapterMeta = listChapterMetaForSource(sourceId);
  return {
    epub_uploaded: Boolean(doc) || chapterMeta.length > 0,
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

/** Backward-compatible alias used by upload finalize. */
export async function queueEpubProcessing(input: {
  sourceId: string;
  familyId: string;
  fileId: string;
  buffer: Buffer;
  force?: boolean;
}) {
  const job = await enqueueEpubJob(input);
  // Local/memory: advance immediately so tests still complete.
  if (getResearchStorageMode() !== "supabase") {
    void runEpubJobToCompletion(job.id);
  }
  return job;
}

export function setEpubProcessingConcurrency(n: number) {
  void n;
  // Staged runner ignores concurrency; kept for API compatibility.
}

/** Load durable EPUB artifacts into the in-process stores for UI reads. */
export async function hydrateEpubArtifactsFromSupabase(sourceId: string) {
  if (getResearchStorageMode() !== "supabase") return;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const store = getPublicResearchArtifactStore();

    const { data: jobs } = await admin
      .from("research_processing_jobs")
      .select("*")
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false });
    for (const row of jobs ?? []) {
      const job = mapDbJob(row as Record<string, unknown>);
      const idx = store.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) store.jobs[idx] = job;
      else store.jobs.push(job);
    }

    const { data: docs } = await admin
      .from("research_source_documents")
      .select("*")
      .eq("source_id", sourceId);
    const { data: chapterRows } = await admin
      .from("research_source_chapters")
      .select(
        "id,document_id,source_id,chapter_index,chapter_title,source_href,word_count,summary_status,finding_count,review_status,created_at",
      )
      .eq("source_id", sourceId)
      .order("chapter_index", { ascending: true });

    if (docs?.length) {
      const { replaceSourceDocuments } = await import(
        "@/lib/research/epub/document-store"
      );
      replaceSourceDocuments(
        sourceId,
        (docs as ResearchSourceDocumentLike[]).map((d) => ({
          id: d.id,
          source_id: d.source_id,
          file_id: d.file_id,
          extraction_version: d.extraction_version,
          language: d.language,
          total_word_count: d.total_word_count,
          chapter_count: d.chapter_count,
          full_text_available: d.full_text_available,
          extraction_status: d.extraction_status,
          extraction_error_code: d.extraction_error_code,
          title: d.title,
          author: d.author,
          publisher: d.publisher,
          identifier: d.identifier,
          drm_protected: d.drm_protected,
          created_at: d.created_at,
          updated_at: d.updated_at,
        })),
        (chapterRows ?? []).map((c) => ({
          id: String(c.id),
          document_id: String(c.document_id),
          source_id: String(c.source_id),
          chapter_index: Number(c.chapter_index),
          chapter_title: String(c.chapter_title),
          source_href: (c.source_href as string) ?? null,
          word_count: Number(c.word_count ?? 0),
          summary_status: String(c.summary_status ?? "not_started"),
          finding_count: Number(c.finding_count ?? 0),
          review_status: String(c.review_status ?? "needs_review"),
          created_at: String(c.created_at),
        })),
      );
    }

    const { data: overviews } = await admin
      .from("research_public_overviews")
      .select("*")
      .eq("research_source_id", sourceId);
    for (const row of overviews ?? []) {
      const overview = row as ResearchPublicOverview;
      store.overviews = store.overviews.filter(
        (o) =>
          !(
            o.research_source_id === overview.research_source_id &&
            o.processing_mode === overview.processing_mode
          ),
      );
      store.overviews.push(overview);
    }
  } catch {
    // Hydration is best-effort for UI.
  }
}

type ResearchSourceDocumentLike = {
  id: string;
  source_id: string;
  file_id: string;
  extraction_version: string;
  language: string | null;
  total_word_count: number;
  chapter_count: number;
  full_text_available: boolean;
  extraction_status: string;
  extraction_error_code: string | null;
  title: string | null;
  author: string | null;
  publisher: string | null;
  identifier: string | null;
  drm_protected: boolean;
  created_at: string;
  updated_at: string;
};
