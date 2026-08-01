import { afterEach, describe, expect, it } from "vitest";
import type { FamilyContext } from "@/lib/auth/family-context";
import { createMemoryResearchRepository } from "@/lib/research/memory-repository";
import {
  assertHasSupportingSources,
  assertNoFakeCitations,
} from "@/lib/research/public-research/provider";
import {
  clearPublicResearchArtifactsForTests,
} from "@/lib/research/public-research/artifact-store";
import {
  getPublicOverview,
  getPublicResearchConcurrency,
  listExternalSources,
  listPreliminaryFindings,
  queueBulkPublicOverviews,
  queuePublicBookResearch,
  setPublicResearchConcurrency,
  waitForPublicResearchIdle,
} from "@/lib/research/public-research/pipeline";
import {
  createResearchSource,
  getResearchSource,
  setResearchRepositoryForTests,
  uploadResearchFile,
} from "@/lib/research/services";
import { hashBuffer } from "@/lib/research/memory-repository";

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

describe("public book research guards", () => {
  it("blocks fake page and chapter citations", () => {
    expect(() => assertNoFakeCitations("See page 42 for details")).toThrow();
    expect(() => assertNoFakeCitations("Chapter 3 summary says...")).toThrow();
    expect(() =>
      assertNoFakeCitations("Public interviews emphasize decision-making."),
    ).not.toThrow();
  });

  it("blocks unsupported claims when sources are missing", () => {
    expect(() => assertHasSupportingSources(["claim"], [])).toThrow(/no public sources/i);
    expect(() =>
      assertHasSupportingSources(
        ["claim"],
        [
          {
            title: "Publisher page",
            author: null,
            publisher: "Pub",
            url: null,
            source_type: "publisher_page",
            publication_date: null,
            accessed_at: new Date().toISOString(),
            reliability_rating: "high",
            notes: "ok",
          },
        ],
      ),
    ).not.toThrow();
  });
});

describe("public book research pipeline", () => {
  afterEach(() => {
    setResearchRepositoryForTests(null);
    clearPublicResearchArtifactsForTests();
    setPublicResearchConcurrency(2);
  });

  it("queues public research when a book is added", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");

    const sourceId = await createResearchSource(ctx, {
      title: "Expecting Better",
      source_type: "book",
      author_text: "Emily Oster",
      ingestion_path: "metadata_only",
      recommended_slug: "expecting-better-emily-oster",
      topics: ["pregnancy"],
      life_stages: ["pregnancy"],
    });

    await waitForPublicResearchIdle();
    const detail = await getResearchSource(sourceId, ctx);
    expect(detail?.publicOverview).toBeTruthy();
    expect(detail?.publicOverview?.full_book_processed).toBe(false);
    expect(detail?.publicOverview?.source_basis).toBe("public_sources");
    expect(detail?.publicOverview?.short_summary).toMatch(/full book has not been processed/i);
    expect(detail?.externalSources.length).toBeGreaterThan(0);
    expect(detail?.preliminaryFindings.length).toBeGreaterThan(0);
    expect(detail?.coverage.public_overview).toBe("complete");
    expect(detail?.coverage.full_book_processed).toBe(false);

    for (const finding of detail!.preliminaryFindings) {
      expect(finding.is_preliminary).toBe(true);
      expect(finding.review_status).toBe("needs_review");
      expect(finding.external_source_ids.length).toBeGreaterThan(0);
    }
  });

  it("prevents duplicate active jobs and keeps overview labeled", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    const sourceId = await createResearchSource(ctx, {
      title: "Cribsheet",
      source_type: "book",
      author_text: "Emily Oster",
      ingestion_path: "metadata_only",
      recommended_slug: "cribsheet-emily-oster",
    });
    const detail = await getResearchSource(sourceId, ctx);
    const first = await queuePublicBookResearch({
      source: detail!.source,
      familyId: "family_turner",
    });
    const second = await queuePublicBookResearch({
      source: detail!.source,
      familyId: "family_turner",
    });
    expect(first.id).toBe(second.id);
    await waitForPublicResearchIdle();
    const overview = getPublicOverview(sourceId);
    expect(overview?.processing_mode).toBe("public_sources_only");
    expect(overview?.short_summary.toLowerCase()).not.toContain("chapter summary");
    expect(overview?.short_summary.toLowerCase()).not.toMatch(/page \d+/);
  });

  it("preserves public overview after EPUB upload marking", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    const sourceId = await createResearchSource(ctx, {
      title: "Expecting Better",
      source_type: "book",
      author_text: "Emily Oster",
      ingestion_path: "metadata_only",
      recommended_slug: "expecting-better-emily-oster",
    });
    await waitForPublicResearchIdle();
    const before = getPublicOverview(sourceId);
    expect(before).toBeTruthy();

    const buffer = Buffer.from("%EPUB mock bytes for upload test%");
    await uploadResearchFile(ctx, {
      sourceId,
      filename: "expecting-better.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    const { waitForEpubProcessingIdle } = await import(
      "@/lib/research/epub/processing"
    );
    await waitForEpubProcessingIdle();

    const detail = await getResearchSource(sourceId, ctx);
    expect(getPublicOverview(sourceId)?.id).toBe(before!.id);
    expect(detail?.coverage.uploaded_files).toBeGreaterThan(0);
    expect(detail?.sourceGroundedOverview).toBeNull();
  });

  it("bulk processing respects concurrency limits", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    setPublicResearchConcurrency(2);
    expect(getPublicResearchConcurrency()).toBe(2);

    const ids: string[] = [];
    for (const title of ["Book A", "Book B", "Book C", "Book D", "Book E"]) {
      ids.push(
        await createResearchSource(ctx, {
          title,
          source_type: "book",
          author_text: "Author",
          ingestion_path: "metadata_only",
        }),
      );
    }

    // create already queued; wait and confirm all completed without throwing
    await waitForPublicResearchIdle(15000);
    for (const id of ids) {
      expect(listExternalSources(id).length).toBeGreaterThan(0);
      expect(listPreliminaryFindings(id).length).toBeGreaterThan(0);
    }

    const sources = await Promise.all(
      ids.map(async (id) => (await getResearchSource(id, ctx))!.source),
    );
    const jobs = await queueBulkPublicOverviews({
      sources,
      familyId: "family_turner",
    });
    expect(jobs.length).toBe(5);
  });

  it("failed jobs can retry safely", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    const sourceId = await createResearchSource(ctx, {
      title: "Tiny Habits",
      source_type: "book",
      author_text: "BJ Fogg",
      ingestion_path: "metadata_only",
      recommended_slug: "tiny-habits-bj-fogg",
    });
    await waitForPublicResearchIdle();
    const detail = await getResearchSource(sourceId, ctx);
    const retried = await queuePublicBookResearch({
      source: detail!.source,
      familyId: "family_turner",
      force: true,
    });
    expect(["queued", "running", "completed"]).toContain(retried.status);
    await waitForPublicResearchIdle();
    expect(getPublicOverview(sourceId)).toBeTruthy();
  });
});
