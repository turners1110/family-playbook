import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  createMemoryResearchRepository,
  hashBuffer,
} from "@/lib/research/memory-repository";
import {
  clearPublicResearchArtifactsForTests,
  getPublicResearchArtifactStore,
} from "@/lib/research/public-research/artifact-store";
import {
  getPublicOverview,
  waitForPublicResearchIdle,
} from "@/lib/research/public-research/pipeline";
import {
  buildTestEpub,
  inspectAndExtractEpub,
} from "@/lib/research/epub/extract";
import {
  clearEpubDocumentsForTests,
  getChapterText,
  listChapterMetaForSource,
} from "@/lib/research/epub/document-store";
import { waitForEpubProcessingIdle } from "@/lib/research/epub/processing";
import {
  createResearchSource,
  createSignedResearchFileUrl,
  getResearchSource,
  prepareResearchUpload,
  retryEpubProcessing,
  setResearchRepositoryForTests,
  uploadResearchFile,
} from "@/lib/research/services";
import { validateResearchUpload } from "@/lib/research/validation";
import { RESEARCH_MAX_FILE_BYTES } from "@/lib/research/types";

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

const michelleCtx: FamilyContext = {
  ...ctx,
  member: {
    ...ctx.member,
    id: "member_michelle",
    display_name: "Michelle",
    user_id: "user_michelle",
  },
  profile: {
    ...ctx.profile,
    id: "user_michelle",
    display_name: "Michelle",
    email: "michelle@turner.family",
  },
};

describe("EPUB extraction", () => {
  it("extracts OPF spine in order with headings preserved", async () => {
    const buffer = await buildTestEpub({
      title: "Ordered Book",
      chapters: [
        {
          title: "Alpha",
          body: "<h1>Alpha</h1><p>First chapter has enough words here.</p>",
        },
        {
          title: "Beta",
          body: "<h1>Beta</h1><p>Second chapter also has enough words here.</p>",
        },
      ],
    });
    const result = await inspectAndExtractEpub(buffer);
    expect(result.drmProtected).toBe(false);
    expect(result.status).toBe("extracted");
    expect(result.chapters.map((c) => c.chapterTitle)).toEqual(["Alpha", "Beta"]);
    expect(result.chapters[0].chapterIndex).toBe(0);
    expect(result.fullTextAvailable).toBe(true);
    expect(result.totalWordCount).toBeGreaterThan(10);
  });

  it("detects DRM and does not bypass", async () => {
    const buffer = await buildTestEpub({ withDrm: true });
    const result = await inspectAndExtractEpub(buffer);
    expect(result.drmProtected).toBe(true);
    expect(result.status).toBe("drm_protected");
    expect(result.chapters).toHaveLength(0);
    expect(result.errorMessage?.toLowerCase()).toContain("drm");
  });

  it("rejects malformed ZIP", async () => {
    const result = await inspectAndExtractEpub(Buffer.from("not-a-zip"));
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("malformed_zip");
  });

  it("rejects path traversal entries", async () => {
    const zip = new JSZip();
    zip.file("../evil.txt", "x");
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    const result = await inspectAndExtractEpub(buffer);
    expect(result.errorCode).toBe("path_traversal");
  });

  it("marks partial when spine coverage is incomplete", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?><package><metadata><dc:title>Partial</dc:title></metadata><manifest><item id="c0" href="a.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="missing.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c0"/><itemref idref="c1"/></spine></package>`,
    );
    zip.file(
      "OEBPS/a.xhtml",
      `<html><body><h1>Only One</h1><p>Readable chapter text with enough words for extraction.</p></body></html>`,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    const result = await inspectAndExtractEpub(buffer);
    expect(result.status).toBe("partial");
    expect(result.fullTextAvailable).toBe(false);
    expect(result.chapters).toHaveLength(1);
  });
});

describe("EPUB upload and processing", () => {
  beforeEach(() => {
    clearPublicResearchArtifactsForTests();
    clearEpubDocumentsForTests();
    setResearchRepositoryForTests(createMemoryResearchRepository(), "local");
  });

  it("requires rights checkbox for prepare upload", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Rights Book",
      source_type: "book",
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    await expect(
      prepareResearchUpload(ctx, {
        sourceId,
        filename: "book.epub",
        size: 100,
        type: "application/epub+zip",
        fileHash: "abc",
        rightsAttested: false,
      }),
    ).rejects.toThrow(/right to upload/i);
  });

  it("rejects oversized EPUB", () => {
    const check = validateResearchUpload({
      name: "huge.epub",
      size: RESEARCH_MAX_FILE_BYTES + 1,
      type: "application/epub+zip",
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toMatch(/MiB/i);
  });

  it("uploads valid EPUB, extracts chapters, and stores source-grounded analysis separately", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Readable EPUB Book",
      source_type: "book",
      author_text: "Author",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    await waitForPublicResearchIdle();
    const publicBefore = getPublicOverview(sourceId);
    expect(publicBefore).toBeTruthy();

    const buffer = await buildTestEpub({
      title: "Readable EPUB Book",
      chapters: [
        {
          title: "Sleep Basics",
          body: "<h1>Sleep Basics</h1><p>Parents need rest and routines with enough words here.</p>",
        },
        {
          title: "Feeding",
          body: "<h1>Feeding</h1><p>Feeding choices deserve careful discussion with enough words.</p>",
        },
      ],
    });
    const file = await uploadResearchFile(ctx, {
      sourceId,
      filename: "readable.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    expect(file.storage_path).toMatch(
      new RegExp(`^family_turner/${sourceId}/[0-9a-f-]+\\.epub$`),
    );
    expect(file.original_filename).toBe("readable.epub");

    await waitForEpubProcessingIdle();
    const detail = await getResearchSource(sourceId, ctx);
    expect(getPublicOverview(sourceId)?.id).toBe(publicBefore!.id);
    expect(detail?.sourceGroundedOverview).toBeTruthy();
    expect(detail?.sourceGroundedOverview?.processing_mode).toBe(
      "source_grounded",
    );
    expect(detail?.coverage.readable_text_extracted).toBe(true);
    expect(detail?.coverage.epub_uploaded).toBe(true);
    expect(detail?.coverage.drm_protected).toBe(false);
    expect(detail?.coverage.full_book_processed).toBe(true);
    expect(detail?.chapters?.length).toBe(2);
    expect(detail?.chapters?.[0].chapter_title).toBe("Sleep Basics");
    expect(detail?.sourceGroundedOverview?.detailed_overview).toContain(
      "uploaded_epub",
    );
    expect(
      detail?.sourceGroundedOverview?.detailed_overview.toLowerCase(),
    ).not.toMatch(/page \d+/);
    const chapterId = detail!.chapters![0].id;
    expect(getChapterText(chapterId)).toBeTruthy();
    expect(JSON.stringify(detail?.chapters)).not.toContain(
      "Parents need rest and routines",
    );

    await expect(
      uploadResearchFile(ctx, {
        sourceId,
        filename: "readable-copy.epub",
        mimeType: "application/epub+zip",
        buffer,
        fileHash: hashBuffer(buffer),
        rightsAttested: true,
      }),
    ).rejects.toThrow(/already uploaded/i);
  });

  it("handles DRM-protected EPUB without bypass and preserves public overview", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Kobo DRM Book",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    await waitForPublicResearchIdle();
    const publicBefore = getPublicOverview(sourceId);

    const buffer = await buildTestEpub({ withDrm: true });
    await uploadResearchFile(ctx, {
      sourceId,
      filename: "kobo.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    await waitForEpubProcessingIdle();

    const detail = await getResearchSource(sourceId, ctx);
    expect(getPublicOverview(sourceId)?.id).toBe(publicBefore!.id);
    expect(detail?.coverage.drm_protected).toBe(true);
    expect(detail?.coverage.readable_text_extracted).toBe(false);
    expect(detail?.sourceGroundedOverview).toBeNull();
    const job = getPublicResearchArtifactStore().jobs.find(
      (j) => j.job_type === "epub_source_grounded",
    );
    expect(job?.error_code).toBe("drm_protected");
    expect(job?.safe_error_message).toMatch(/DRM-protected/i);
    expect(listChapterMetaForSource(sourceId)).toHaveLength(0);
  });

  it("supports Trip Mode actor write and retry processing", async () => {
    const sourceId = await createResearchSource(michelleCtx, {
      title: "Michelle Upload",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const file = await uploadResearchFile(michelleCtx, {
      sourceId,
      filename: "m.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    await waitForEpubProcessingIdle();
    await retryEpubProcessing(michelleCtx, sourceId, file.id);
    await waitForEpubProcessingIdle();
    const detail = await getResearchSource(sourceId, michelleCtx);
    expect(detail?.sourceGroundedOverview).toBeTruthy();
  });

  it("rejects unauthorized download for outsider writers", async () => {
    const sourceId = await createResearchSource(ctx, {
      title: "Private EPUB",
      source_type: "book",
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = await buildTestEpub();
    const file = await uploadResearchFile(ctx, {
      sourceId,
      filename: "p.epub",
      mimeType: "application/epub+zip",
      buffer,
      fileHash: hashBuffer(buffer),
      rightsAttested: true,
    });
    const outsider: FamilyContext = {
      ...ctx,
      member: { ...ctx.member, display_name: "Guest" },
    };
    await expect(
      createSignedResearchFileUrl(outsider, sourceId, file.id),
    ).rejects.toThrow(/Only Sam or Michelle/);
  });
});
