/**
 * Public book research pipeline + bounded concurrency queue.
 */
import {
  getPublicResearchArtifactStore,
  newId,
  nowIso,
} from "@/lib/research/public-research/artifact-store";
import {
  getPublicBookAiProvider,
  getWebResearchProvider,
} from "@/lib/research/public-research/mock-provider";
import type { PublicBookResearchContext } from "@/lib/research/public-research/provider";
import type {
  ResearchExternalSource,
  ResearchPreliminaryFinding,
  ResearchProcessingJob,
  ResearchPublicOverview,
  ResearchSource,
  ResearchSourceCoverage,
} from "@/lib/research/types";
import { getResearchStorageMode } from "@/lib/research/mode";

const PUBLIC_JOB_DEDUPE = "public_book_research_v1";
const DEFAULT_CONCURRENCY = 2;

type QueueItem = {
  jobId: string;
  sourceId: string;
  familyId: string;
  ctx: PublicBookResearchContext;
};

const queue: QueueItem[] = [];
let active = 0;
let concurrency = DEFAULT_CONCURRENCY;
const sourceStatus = new Map<
  string,
  Partial<ResearchSource> & {
    processing_status?: ResearchSource["processing_status"];
  }
>();

/** Optional hook so repositories can observe status changes in tests/local. */
let onSourcePatch:
  | ((
      sourceId: string,
      patch: Partial<ResearchSource> & {
        processing_status?: ResearchSource["processing_status"];
      },
    ) => Promise<void> | void)
  | null = null;

export function setPublicResearchSourcePatcher(
  fn:
    | ((
        sourceId: string,
        patch: Partial<ResearchSource> & {
          processing_status?: ResearchSource["processing_status"];
        },
      ) => Promise<void> | void)
    | null,
) {
  onSourcePatch = fn;
}

export function setPublicResearchConcurrency(n: number) {
  concurrency = Math.max(1, Math.min(3, Math.floor(n)));
}

export function getPublicResearchConcurrency() {
  return concurrency;
}

async function patchSource(
  sourceId: string,
  patch: Partial<ResearchSource> & {
    processing_status?: ResearchSource["processing_status"];
  },
) {
  sourceStatus.set(sourceId, { ...sourceStatus.get(sourceId), ...patch });
  if (onSourcePatch) await onSourcePatch(sourceId, patch);
}

export function getCachedSourceResearchStatus(sourceId: string) {
  return sourceStatus.get(sourceId) ?? null;
}

function buildCoverage(sourceId: string): ResearchSourceCoverage {
  const store = getPublicResearchArtifactStore();
  const cached = sourceStatus.get(sourceId);
  const external = store.externalSources.filter(
    (s) => s.research_source_id === sourceId,
  );
  return {
    public_sources_reviewed:
      cached?.public_sources_reviewed ?? external.length,
    uploaded_files: cached?.uploaded_file_count ?? 0,
    book_pages_processed: cached?.book_pages_processed ?? 0,
    chapters_processed: cached?.chapters_processed ?? 0,
    full_book_processed: cached?.full_book_processed ?? false,
    public_overview: cached?.public_overview_status ?? "not_started",
    source_grounded_analysis: cached?.source_grounded_status ?? "not_started",
  };
}

export function getResearchCoverage(sourceId: string): ResearchSourceCoverage {
  return buildCoverage(sourceId);
}

export function listJobsForSource(sourceId: string): ResearchProcessingJob[] {
  return getPublicResearchArtifactStore()
    .jobs.filter((j) => j.source_id === sourceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listExternalSources(sourceId: string): ResearchExternalSource[] {
  return getPublicResearchArtifactStore().externalSources.filter(
    (s) => s.research_source_id === sourceId,
  );
}

export function getPublicOverview(
  sourceId: string,
  mode: ResearchPublicOverview["processing_mode"] = "public_sources_only",
): ResearchPublicOverview | null {
  return (
    getPublicResearchArtifactStore().overviews.find(
      (o) => o.research_source_id === sourceId && o.processing_mode === mode,
    ) ?? null
  );
}

export function listPreliminaryFindings(
  sourceId: string,
): ResearchPreliminaryFinding[] {
  return getPublicResearchArtifactStore().findings.filter(
    (f) => f.source_id === sourceId,
  );
}

export function listActivePublicResearchJobs(): ResearchProcessingJob[] {
  return getPublicResearchArtifactStore().jobs.filter((j) =>
    ["queued", "running"].includes(j.status),
  );
}

/**
 * Queue public research for a book. Dedupes active jobs for the same source.
 * Does not require uploaded book text.
 */
export async function queuePublicBookResearch(input: {
  source: ResearchSource;
  familyId: string;
  questionIds?: string[];
  checklistTaskIds?: string[];
  force?: boolean;
}): Promise<ResearchProcessingJob> {
  const store = getPublicResearchArtifactStore();
  const existing = store.jobs.find(
    (j) =>
      j.source_id === input.source.id &&
      j.dedupe_key === PUBLIC_JOB_DEDUPE &&
      (j.status === "queued" || j.status === "running"),
  );
  if (existing && !input.force) return existing;

  const completed = store.jobs.find(
    (j) =>
      j.source_id === input.source.id &&
      j.dedupe_key === PUBLIC_JOB_DEDUPE &&
      j.status === "completed",
  );
  if (completed && !input.force && getPublicOverview(input.source.id)) {
    return completed;
  }

  const ts = nowIso();
  const job: ResearchProcessingJob = {
    id: newId("job"),
    source_id: input.source.id,
    family_id: input.familyId,
    job_type: "public_book_research",
    status: "queued",
    progress_percent: 0,
    current_stage: "queued",
    error_code: null,
    safe_error_message: null,
    ai_provider: null,
    model_name: null,
    prompt_version: null,
    source_count: 0,
    dedupe_key: PUBLIC_JOB_DEDUPE,
    created_at: ts,
    updated_at: ts,
    started_at: null,
    completed_at: null,
  };
  store.jobs.unshift(job);

  await patchSource(input.source.id, {
    processing_status: "public_research_queued",
    public_overview_status: "queued",
  });

  queue.push({
    jobId: job.id,
    sourceId: input.source.id,
    familyId: input.familyId,
    ctx: {
      source: input.source,
      questionIds: input.questionIds ?? [],
      checklistTaskIds: input.checklistTaskIds ?? [],
    },
  });
  void pumpQueue();
  return job;
}

export async function cancelPublicBookResearch(sourceId: string) {
  const store = getPublicResearchArtifactStore();
  for (const job of store.jobs) {
    if (
      job.source_id === sourceId &&
      (job.status === "queued" || job.status === "running")
    ) {
      job.status = "cancelled";
      job.updated_at = nowIso();
      job.current_stage = "cancelled";
    }
  }
  // Remove queued items not yet started
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i].sourceId === sourceId) queue.splice(i, 1);
  }
}

export async function retryPublicBookResearch(input: {
  source: ResearchSource;
  familyId: string;
  questionIds?: string[];
  checklistTaskIds?: string[];
}) {
  return queuePublicBookResearch({ ...input, force: true });
}

async function pumpQueue() {
  while (active < concurrency && queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    active += 1;
    void runJob(item)
      .catch(() => undefined)
      .finally(() => {
        active -= 1;
        void pumpQueue();
      });
  }
}

async function runJob(item: QueueItem) {
  const store = getPublicResearchArtifactStore();
  const job = store.jobs.find((j) => j.id === item.jobId);
  if (!job || job.status === "cancelled") return;

  job.status = "running";
  job.started_at = nowIso();
  job.updated_at = job.started_at;
  job.current_stage = "gathering_public_sources";
  await patchSource(item.sourceId, {
    processing_status: "gathering_public_sources",
    public_overview_status: "processing",
  });

  try {
    const web = getWebResearchProvider();
    const ai = getPublicBookAiProvider();
    job.ai_provider = ai.name;
    job.model_name = ai.model;
    job.prompt_version = ai.promptVersion;

    const gathered = await web.searchPublicBookSources(item.ctx);
    if (gathered.length === 0) {
      throw Object.assign(new Error("No public sources found."), {
        code: "no_public_sources",
      });
    }

    // Persist external sources (replace prior public sources for this source).
    store.externalSources = store.externalSources.filter(
      (s) => s.research_source_id !== item.sourceId,
    );
    const externalRows: ResearchExternalSource[] = gathered.map((g) => ({
      id: newId("ext"),
      research_source_id: item.sourceId,
      title: g.title,
      author: g.author,
      publisher: g.publisher,
      url: g.url,
      source_type: g.source_type,
      publication_date: g.publication_date,
      accessed_at: g.accessed_at,
      reliability_rating: g.reliability_rating,
      notes: g.notes,
      supports_finding_ids: [],
      created_at: nowIso(),
    }));
    store.externalSources.push(...externalRows);
    job.source_count = externalRows.length;
    job.progress_percent = 35;
    job.current_stage = "generate_public_overview";
    job.updated_at = nowIso();

    const overviewDraft = await ai.generatePublicBookOverview(
      item.ctx,
      gathered,
    );
    // Preserve any prior public overview by only replacing public_sources_only mode.
    store.overviews = store.overviews.filter(
      (o) =>
        !(
          o.research_source_id === item.sourceId &&
          o.processing_mode === "public_sources_only"
        ),
    );
    const overview: ResearchPublicOverview = {
      id: newId("pov"),
      research_source_id: item.sourceId,
      ...overviewDraft,
      created_at: nowIso(),
      updated_at: nowIso(),
      approved_by_member_id: null,
      approved_at: null,
    };
    store.overviews.push(overview);
    job.progress_percent = 65;
    job.current_stage = "extract_preliminary_findings";
    job.updated_at = nowIso();

    const findingDrafts = await ai.extractPreliminaryFindings(
      item.ctx,
      gathered,
      overviewDraft,
    );
    const lessons = await ai.generatePreliminaryLessons(
      item.ctx,
      gathered,
      overviewDraft,
    );
    overview.practical_lessons = lessons;

    store.findings = store.findings.filter(
      (f) =>
        !(f.source_id === item.sourceId && f.source_basis === "public_sources"),
    );
    const findings: ResearchPreliminaryFinding[] = findingDrafts.map((f) => {
      const id = newId("find");
      const linkedExt = externalRows.slice(0, Math.min(2, externalRows.length)).map(
        (e) => e.id,
      );
      for (const extId of linkedExt) {
        const ext = externalRows.find((e) => e.id === extId);
        if (ext) ext.supports_finding_ids.push(id);
      }
      return {
        id,
        source_id: item.sourceId,
        ...f,
        external_source_ids: linkedExt,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
    });
    store.findings.push(...findings);

    job.progress_percent = 100;
    job.status = "completed";
    job.current_stage = "public_overview_ready";
    job.completed_at = nowIso();
    job.updated_at = job.completed_at;

    await patchSource(item.sourceId, {
      processing_status: "public_overview_ready",
      public_overview_status: "complete",
      public_sources_reviewed: externalRows.length,
      full_book_processed: false,
    });

    // Best-effort Supabase persistence when configured.
    if (getResearchStorageMode() === "supabase") {
      await persistToSupabase({
        familyId: item.familyId,
        sourceId: item.sourceId,
        job,
        externalRows,
        overview,
        findings,
      }).catch(() => undefined);
    }
  } catch (error) {
    job.status = "failed";
    job.error_code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "public_research_failed";
    job.safe_error_message =
      error instanceof Error ? error.message.slice(0, 300) : "Processing failed";
    job.updated_at = nowIso();
    job.completed_at = job.updated_at;
    job.current_stage = "failed";
    await patchSource(item.sourceId, {
      processing_status: "processing_failed",
      public_overview_status: "failed",
    });
  }
}

async function persistToSupabase(input: {
  familyId: string;
  sourceId: string;
  job: ResearchProcessingJob;
  externalRows: ResearchExternalSource[];
  overview: ResearchPublicOverview;
  findings: ResearchPreliminaryFinding[];
}) {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  await admin
    .from("research_sources")
    .update({
      processing_status: "public_overview_ready",
      public_overview_status: "complete",
      public_sources_reviewed: input.externalRows.length,
      full_book_processed: false,
      updated_at: nowIso(),
    })
    .eq("id", input.sourceId)
    .eq("family_id", input.familyId);

  await admin
    .from("research_external_sources")
    .delete()
    .eq("research_source_id", input.sourceId);

  if (input.externalRows.length) {
    await admin.from("research_external_sources").insert(
      input.externalRows.map((row) => ({
        id: row.id,
        research_source_id: row.research_source_id,
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        url: row.url,
        source_type: row.source_type,
        publication_date: row.publication_date,
        accessed_at: row.accessed_at,
        reliability_rating: row.reliability_rating,
        notes: row.notes,
        supports_finding_ids: row.supports_finding_ids,
        created_at: row.created_at,
      })),
    );
  }

  await admin.from("research_public_overviews").upsert(
    {
      id: input.overview.id,
      research_source_id: input.overview.research_source_id,
      processing_mode: input.overview.processing_mode,
      short_summary: input.overview.short_summary,
      detailed_overview: input.overview.detailed_overview,
      main_themes: input.overview.main_themes,
      author_arguments: input.overview.author_arguments,
      core_framework: input.overview.core_framework,
      important_conclusions: input.overview.important_conclusions,
      practical_lessons: input.overview.practical_lessons,
      questions_raised: input.overview.questions_raised,
      discussion_points: input.overview.discussion_points,
      relevant_checklist_task_ids: input.overview.relevant_checklist_task_ids,
      relevant_question_ids: input.overview.relevant_question_ids,
      potential_principles: input.overview.potential_principles,
      related_research: input.overview.related_research,
      criticism_limitations: input.overview.criticism_limitations,
      areas_of_disagreement: input.overview.areas_of_disagreement,
      confidence: input.overview.confidence,
      review_status: input.overview.review_status,
      full_book_processed: false,
      source_basis: "public_sources",
      ai_provider: input.overview.ai_provider,
      model_name: input.overview.model_name,
      prompt_version: input.overview.prompt_version,
      source_count: input.overview.source_count,
      created_at: input.overview.created_at,
      updated_at: input.overview.updated_at,
    },
    { onConflict: "research_source_id,processing_mode" },
  );

  // Findings: insert preliminary rows
  for (const finding of input.findings) {
    await admin.from("research_source_findings").insert({
      id: finding.id,
      source_id: finding.source_id,
      finding_type: finding.finding_type,
      title: finding.title,
      finding_text: finding.finding_text,
      confidence: finding.confidence === "moderate" ? "medium" : finding.confidence,
      evidence_strength: finding.evidence_strength,
      ai_generated: true,
      review_status: "needs_review",
      source_basis: "public_sources",
      is_preliminary: true,
      external_source_ids: finding.external_source_ids,
      related_topics: finding.related_topics,
      linked_question_ids: finding.linked_question_ids,
      linked_checklist_task_ids: finding.linked_checklist_task_ids,
      created_at: finding.created_at,
      updated_at: finding.updated_at,
    });
  }

  await admin.from("research_processing_jobs").insert({
    id: input.job.id,
    source_id: input.job.source_id,
    family_id: input.familyId,
    job_type: input.job.job_type,
    status: input.job.status,
    progress_percent: input.job.progress_percent,
    current_stage: input.job.current_stage,
    error_code: input.job.error_code,
    safe_error_message: input.job.safe_error_message,
    ai_provider: input.job.ai_provider,
    model_name: input.job.model_name,
    prompt_version: input.job.prompt_version,
    source_count: input.job.source_count,
    dedupe_key: input.job.dedupe_key,
    created_at: input.job.created_at,
    started_at: input.job.started_at,
    completed_at: input.job.completed_at,
  });
}

/**
 * After uploaded text extraction, mark coverage and keep public overview intact.
 * Full source-grounded generation is a separate job.
 */
export async function markSourceTextUploaded(input: {
  sourceId: string;
  pagesProcessed?: number;
  chaptersProcessed?: number;
  fullBook?: boolean;
  fileCount?: number;
}) {
  await patchSource(input.sourceId, {
    processing_status: input.fullBook
      ? "source_text_uploaded"
      : "source_text_uploaded",
    uploaded_file_count: input.fileCount ?? 1,
    book_pages_processed: input.pagesProcessed ?? 0,
    chapters_processed: input.chaptersProcessed ?? 0,
    full_book_processed: Boolean(input.fullBook),
    source_grounded_status: "not_started",
  });
}

export async function queueBulkPublicOverviews(input: {
  sources: ResearchSource[];
  familyId: string;
  questionIds?: string[];
  checklistTaskIds?: string[];
}) {
  const jobs: ResearchProcessingJob[] = [];
  for (const source of input.sources) {
    if (source.source_type !== "book") continue;
    const job = await queuePublicBookResearch({
      source,
      familyId: input.familyId,
      questionIds: input.questionIds,
      checklistTaskIds: input.checklistTaskIds,
    });
    jobs.push(job);
  }
  return jobs;
}

/** Wait helper for tests. */
export async function waitForPublicResearchIdle(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (active === 0 && queue.length === 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Public research queue did not drain in time.");
}

export function researchPlaybookGateNotice() {
  return "Public-source findings never flow into the final family playbook until Sam or Michelle approve them.";
}
