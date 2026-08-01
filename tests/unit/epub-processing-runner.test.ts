import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  createMemoryResearchRepository,
  hashBuffer,
} from "@/lib/research/memory-repository";
import {
  clearPublicResearchArtifactsForTests,
  getPublicResearchArtifactStore,
} from "@/lib/research/public-research/artifact-store";
import { waitForPublicResearchIdle } from "@/lib/research/public-research/pipeline";
import { buildTestEpub } from "@/lib/research/epub/extract";
import { clearEpubDocumentsForTests } from "@/lib/research/epub/document-store";
import {
  advanceEpubJob,
  claimNextEpubJob,
  describeEpubProcessStatus,
  enqueueEpubJob,
  runEpubJobToCompletion,
  waitForEpubProcessingIdle,
} from "@/lib/research/epub/runner";
import { auditEpubAiEnv } from "@/lib/research/epub/safe-log";
import {
  createResearchSource,
  getResearchSource,
  processExistingEpubUpload,
  retryEpubProcessing,
  runNextEpubProcessingStep,
  setResearchRepositoryForTests,
  uploadResearchFile,
} from "@/lib/research/services";

const ctx: FamilyContext = {
  mode: "emergency",
  user: null,
  profile: {
    id: "user_sam",
    email: "sam@turner.family",
    display_name: "Sam Turner",
    created_at: "",
  },
  member: {
    id: "member_sam",
    family_id: "family_turner",
    user_id: "user_sam",
    display_name: "Sam",
    role: "parent",
    sort_order: 1,
    created_at: "",
  },
  family: {
    id: "family_turner",
    name: "Turner Family",
    created_at: "",
    updated_at: "",
  },
  settings: {
    family_id: "family_turner",
    hide_partner_answers_until_both_saved: true,
    dark_mode: "system",
    babymoon_target_date: null,
    babymoon_daily_questions: 3,
    include_perspective_history_in_playbook: true,
    updated_at: "",
  },
};

async function seedUploadedEpub(title = "Existing Upload Book") {
  const sourceId = await createResearchSource(ctx, {
    title,
    source_type: "book",
    rights_attested: true,
    ingestion_path: "metadata_only",
  });
  await waitForPublicResearchIdle();
  const buffer = await buildTestEpub({
    title,
    chapters: [
      {
        title: "One",
        body: "<h1>One</h1><p>Chapter one has enough words for extraction tests.</p>",
      },
      {
        title: "Two",
        body: "<h1>Two</h1><p>Chapter two also has enough words for extraction tests.</p>",
      },
    ],
  });
  const file = await uploadResearchFile(ctx, {
    sourceId,
    filename: "existing.epub",
    mimeType: "application/epub+zip",
    buffer,
    fileHash: hashBuffer(buffer),
    rightsAttested: true,
  });
  await waitForEpubProcessingIdle();
  return { sourceId, file, buffer };
}

describe("EPUB durable processing runner", () => {
  beforeEach(() => {
    clearPublicResearchArtifactsForTests();
    clearEpubDocumentsForTests();
    setResearchRepositoryForTests(createMemoryResearchRepository(), "local");
    vi.unstubAllEnvs();
  });

  it("starts processing from an existing uploaded file without re-upload", async () => {
    const { sourceId, file } = await seedUploadedEpub();
    // Simulate "uploaded but analysis missing" by clearing grounded overview jobs done state
    // and re-enqueue via processExisting.
    const store = getPublicResearchArtifactStore();
    store.overviews = store.overviews.filter(
      (o) => o.processing_mode !== "source_grounded",
    );
    for (const j of store.jobs) {
      if (j.job_type === "epub_source_grounded") j.status = "cancelled";
    }

    const result = await processExistingEpubUpload(ctx, sourceId);
    expect(result.ok).toBe(true);
    expect(result.jobId).toBeTruthy();
    await waitForEpubProcessingIdle();
    const detail = await getResearchSource(sourceId, ctx);
    expect(detail?.sourceGroundedOverview).toBeTruthy();
    expect(detail?.files.some((f) => f.id === file.id)).toBe(true);
  });

  it("does not create duplicate active jobs", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Dedupe Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const first = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_a",
      buffer,
    });
    const second = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_a",
      buffer,
    });
    expect(second.id).toBe(first.id);
    const active = getPublicResearchArtifactStore().jobs.filter(
      (j) =>
        j.source_id === sourceId &&
        j.dedupe_key === "epub_source_grounded_v1" &&
        (j.status === "queued" || j.status === "running"),
    );
    expect(active).toHaveLength(1);
  });

  it("claims a queued job", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Claim Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const queued = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_claim",
      buffer,
    });
    expect(queued.status).toBe("queued");
    const claimed = await claimNextEpubJob();
    expect(claimed?.id).toBe(queued.id);
    expect(claimed?.status).toBe("running");
  });

  it("resumes staged work across advanceEpubJob calls", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Staged Resume",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const job = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_staged",
      buffer,
    });
    const first = await advanceEpubJob({ jobId: job.id, maxStages: 2 });
    expect(first.stagesRun.length).toBeGreaterThan(0);
    expect(first.done).toBe(false);
    let done = false;
    for (let i = 0; i < 8; i += 1) {
      const step = await advanceEpubJob({ jobId: job.id, maxStages: 3 });
      if (step.done) {
        done = true;
        break;
      }
    }
    expect(done).toBe(true);
    const detail = await getResearchSource(sourceId, ctx);
    expect(detail?.sourceGroundedOverview).toBeTruthy();
    expect(detail?.chapters?.length).toBeGreaterThan(0);
  });

  it("marks DRM status without bypass", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "DRM Resume",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub({ withDrm: true });
    const job = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_drm",
      buffer,
    });
    await runEpubJobToCompletion(job.id);
    const stored = getPublicResearchArtifactStore().jobs.find((j) => j.id === job.id);
    expect(stored?.error_code).toBe("drm_protected");
    const status = describeEpubProcessStatus({
      jobs: getPublicResearchArtifactStore().jobs.filter(
        (j) => j.source_id === sourceId,
      ),
      hasEpubFile: true,
      drmProtected: true,
    });
    expect(status.code).toBe("drm_protected");
  });

  it("records extraction failure", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Bad EPUB",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const job = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_bad",
      buffer: Buffer.from("not-an-epub"),
    });
    await runEpubJobToCompletion(job.id);
    const stored = getPublicResearchArtifactStore().jobs.find((j) => j.id === job.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.error_code).toBeTruthy();
  });

  it("pauses when live AI provider is missing keys", async () => {
    vi.stubEnv("RESEARCH_AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    const audit = auditEpubAiEnv();
    expect(audit.aiReady).toBe(false);

    const sourceId = await createResearchSource(ctx, {
      title: "AI Config Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const job = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_ai",
      buffer,
    });
    // Advance through extraction into AI stage
    for (let i = 0; i < 10; i += 1) {
      const result = await advanceEpubJob({ jobId: job.id, maxStages: 2 });
      if (result.job?.current_stage === "awaiting_ai_configuration") break;
      if (result.done) break;
    }
    const stored = getPublicResearchArtifactStore().jobs.find((j) => j.id === job.id);
    expect(stored?.current_stage).toBe("awaiting_ai_configuration");
    expect(stored?.error_code).toBe("ai_not_configured");
  });

  it("shows summaries and findings after completion", async () => {
    const { sourceId } = await seedUploadedEpub("Complete Analysis Book");
    const detail = await getResearchSource(sourceId, ctx);
    expect(detail?.sourceGroundedOverview?.short_summary).toBeTruthy();
    expect(detail?.sourceGroundedOverview?.practical_lessons?.length).toBeGreaterThan(
      0,
    );
    expect(detail?.chapters?.length).toBe(2);
    expect(detail?.epubProcessStatus?.code).toBe("needs_review");
  });

  it("retries from a failed stage", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Retry Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const bad = await enqueueEpubJob({
      sourceId,
      familyId: "family_turner",
      fileId: "file_retry_bad",
      buffer: Buffer.from("bad"),
    });
    await runEpubJobToCompletion(bad.id);
    expect(
      getPublicResearchArtifactStore().jobs.find((j) => j.id === bad.id)?.status,
    ).toBe("failed");

    const buffer = await buildTestEpub();
    // Persist bytes via upload path then retry
    const file = await uploadResearchFile(ctx, {
      sourceId,
      filename: "retry.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    await waitForEpubProcessingIdle();
    await retryEpubProcessing(ctx, sourceId, file.id);
    await waitForEpubProcessingIdle();
    const detail = await getResearchSource(sourceId, ctx);
    expect(detail?.sourceGroundedOverview).toBeTruthy();
  });

  it("run next step advances without re-upload", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Step Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    await uploadResearchFile(ctx, {
      sourceId,
      filename: "step.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    // Cancel auto-completion by creating a fresh queued job after clearing
    const store = getPublicResearchArtifactStore();
    for (const j of store.jobs) {
      if (j.job_type === "epub_source_grounded") j.status = "cancelled";
    }
    store.overviews = store.overviews.filter(
      (o) => o.processing_mode !== "source_grounded",
    );
    clearEpubDocumentsForTests();

    const step = await runNextEpubProcessingStep(ctx, sourceId);
    expect(step.ok).toBe(true);
    expect(step.stagesRun.length).toBeGreaterThan(0);
  });
});
