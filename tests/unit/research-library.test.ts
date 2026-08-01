import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyContext } from "@/lib/auth/family-context";
import { ResearchUnavailableError } from "@/lib/research/errors";
import {
  createMemoryResearchRepository,
  hashBuffer,
} from "@/lib/research/memory-repository";
import {
  getResearchStorageMode,
  isLocalResearchStoreEnabled,
} from "@/lib/research/mode";
import {
  addResearchNote,
  archiveResearchSource,
  createResearchSource,
  createSignedResearchFileUrl,
  getResearchForQuestion,
  getResearchSource,
  getResearchStorageStatus,
  linkResearchQuestion,
  listResearchSources,
  prepareResearchUpload,
  finalizeResearchUpload,
  setResearchRepositoryForTests,
  uploadResearchFile,
} from "@/lib/research/services";
import { clearPublicResearchArtifactsForTests } from "@/lib/research/public-research/artifact-store";
import { waitForPublicResearchIdle } from "@/lib/research/public-research/pipeline";
import {
  availabilityDisclosure,
  deriveAvailability,
  deriveInitialProcessingStatus,
  validateResearchUpload,
} from "@/lib/research/validation";

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
    display_name: "Michelle Turner",
    email: "michelle@turner.family",
  },
};

beforeEach(() => {
  setResearchRepositoryForTests(createMemoryResearchRepository(), "local");
});

afterEach(() => {
  setResearchRepositoryForTests(null, null);
  clearPublicResearchArtifactsForTests();
  vi.unstubAllEnvs();
});

describe("research availability labels", () => {
  it("labels metadata-only books clearly", () => {
    const availability = deriveAvailability({
      hasFile: false,
      hasExcerpts: false,
      hasNotes: false,
      ingestionPath: "owned_physical",
    });
    expect(availability).toBe("metadata_only");
    expect(deriveInitialProcessingStatus(availability)).toBe("metadata_only");
    expect(availabilityDisclosure(availability)).toContain(
      "full summary requires source text",
    );
  });
});

describe("upload validation", () => {
  it("accepts supported files and rejects executables", () => {
    expect(
      validateResearchUpload({
        name: "sleep.pdf",
        size: 1024,
        type: "application/pdf",
      }).ok,
    ).toBe(true);
    expect(
      validateResearchUpload({
        name: "bad.exe",
        size: 10,
        type: "application/octet-stream",
      }).ok,
    ).toBe(false);
  });
});

describe("storage mode", () => {
  it("does not allow local filesystem fallback on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("USE_LOCAL_RESEARCH_STORE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isLocalResearchStoreEnabled()).toBe(false);
    expect(getResearchStorageMode()).toBe("unavailable");
  });

  it("enables local-development fallback only with the flag off Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("USE_LOCAL_RESEARCH_STORE", "true");
    expect(isLocalResearchStoreEnabled()).toBe(true);
    expect(getResearchStorageMode()).toBe("local");
  });

  it("blocks writes when unavailable", async () => {
    setResearchRepositoryForTests(null, "unavailable");
    expect(getResearchStorageStatus().writesAllowed).toBe(false);
    await expect(
      createResearchSource(ctx, {
        title: "Nope",
        source_type: "book",
        topics: [],
        life_stages: [],
        rights_attested: false,
        ingestion_path: "metadata_only",
      }),
    ).rejects.toBeInstanceOf(ResearchUnavailableError);
  });
});

describe("research library persistence (memory backend)", () => {
  it("creates metadata-only sources with Sam attribution", async () => {
    const id = await createResearchSource(ctx, {
      title: "Cribsheet",
      source_type: "book",
      author_text: "Emily Oster",
      publication_year: 2019,
      topics: ["sleep"],
      life_stages: ["newborn_0_3"],
      rights_attested: false,
      ingestion_path: "owned_physical",
    });
    await waitForPublicResearchIdle();
    const detail = await getResearchSource(id, ctx);
    expect(detail?.source.availability_type).toBe("metadata_only");
    expect(detail?.source.added_by_display_name).toBe("Sam");
    // Books auto-queue public research after metadata create.
    expect(detail?.source.processing_status).toBe("public_overview_ready");
    expect(detail?.publicOverview?.full_book_processed).toBe(false);
  });

  it("persists notes and question links", async () => {
    const id = await createResearchSource(ctx, {
      title: "Sleep science",
      source_type: "research_paper",
      topics: ["sleep"],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
      notes_from_sam: "Sam note",
    });
    await addResearchNote(michelleCtx, {
      source_id: id,
      note_scope: "michelle",
      text: "Michelle note",
      tags: [],
    });
    await linkResearchQuestion(ctx, {
      source_id: id,
      question_id: "q_sleep_1",
      link_type: "informs",
      relevance_note: "Supports rest",
    });
    const detail = await getResearchSource(id, ctx);
    expect(detail?.notes.some((n) => n.note_scope === "sam")).toBe(true);
    expect(detail?.notes.some((n) => n.note_scope === "michelle")).toBe(true);
    const linked = await getResearchForQuestion("q_sleep_1", ctx);
    expect(linked).toHaveLength(1);
  });

  it("uploads privately and issues signed download URLs", async () => {
    const id = await createResearchSource(ctx, {
      title: "Guideline",
      source_type: "clinical_guideline",
      topics: [],
      life_stages: [],
      rights_attested: true,
      ingestion_path: "upload_file",
    });
    const buffer = Buffer.from("%PDF-fake");
    const fileHash = hashBuffer(buffer);
    const file = await uploadResearchFile(ctx, {
      sourceId: id,
      filename: "guide.pdf",
      mimeType: "application/pdf",
      buffer,
      fileHash,
    });
    const detail = await getResearchSource(id, ctx);
    expect(detail?.source.availability_type).toBe("partial_text");
    expect(detail?.files[0]?.original_filename).toBe("guide.pdf");
    const url = await createSignedResearchFileUrl(ctx, id, file.id);
    expect(url).toContain("memory://download/");
    expect(url).not.toMatch(/^https?:\/\/.*supabase/i);
  });

  it("rejects unauthorized writers and unauthorized file access", async () => {
    const outsider: FamilyContext = {
      ...ctx,
      member: { ...ctx.member, display_name: "Guest" },
    };
    await expect(
      createResearchSource(outsider, {
        title: "Nope",
        source_type: "book",
        topics: [],
        life_stages: [],
        rights_attested: false,
        ingestion_path: "metadata_only",
      }),
    ).rejects.toThrow(/Only Sam or Michelle/);

    const id = await createResearchSource(ctx, {
      title: "Private",
      source_type: "book",
      topics: [],
      life_stages: [],
      rights_attested: true,
      ingestion_path: "metadata_only",
    });
    const buffer = Buffer.from("hello");
    const file = await uploadResearchFile(ctx, {
      sourceId: id,
      filename: "notes.txt",
      mimeType: "text/plain",
      buffer,
      fileHash: hashBuffer(buffer),
    });

    const otherFamilyRepo = createMemoryResearchRepository();
    setResearchRepositoryForTests(otherFamilyRepo, "local");
    await expect(
      createSignedResearchFileUrl(ctx, id, file.id),
    ).rejects.toThrow();
  });

  it("survives a simulated restart via repository snapshot", async () => {
    const first = createMemoryResearchRepository();
    setResearchRepositoryForTests(first, "local");
    const id = await createResearchSource(ctx, {
      title: "Persisted",
      source_type: "book",
      topics: [],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    const snapshot = first.snapshot();
    const restarted = createMemoryResearchRepository(snapshot);
    setResearchRepositoryForTests(restarted, "local");
    const detail = await getResearchSource(id, ctx);
    expect(detail?.source.title).toBe("Persisted");
    const list = await listResearchSources({}, ctx);
    expect(list.map((s) => s.id)).toContain(id);
  });

  it("protects duplicate file finalize by hash", async () => {
    const id = await createResearchSource(ctx, {
      title: "Dup",
      source_type: "uploaded_document",
      topics: [],
      life_stages: [],
      rights_attested: true,
      ingestion_path: "upload_file",
    });
    const buffer = Buffer.from("same");
    const fileHash = hashBuffer(buffer);
    const prepared = await prepareResearchUpload(ctx, {
      sourceId: id,
      filename: "a.txt",
      size: buffer.length,
      type: "text/plain",
      fileHash,
    });
    const first = await finalizeResearchUpload(ctx, {
      sourceId: id,
      storagePath: prepared.storagePath,
      originalFilename: prepared.originalFilename,
      mimeType: prepared.mimeType,
      fileSize: prepared.fileSize,
      fileHash,
    });
    const second = await finalizeResearchUpload(ctx, {
      sourceId: id,
      storagePath: prepared.storagePath,
      originalFilename: prepared.originalFilename,
      mimeType: prepared.mimeType,
      fileSize: prepared.fileSize,
      fileHash,
    });
    expect(second.id).toBe(first.id);
    const detail = await getResearchSource(id, ctx);
    expect(detail?.files).toHaveLength(1);
  });

  it("archives sources and supports Trip Mode actor attribution", async () => {
    const id = await createResearchSource(michelleCtx, {
      title: "Trip Mode book",
      source_type: "book",
      topics: [],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    const detail = await getResearchSource(id, michelleCtx);
    expect(detail?.source.added_by_display_name).toBe("Michelle");
    expect(michelleCtx.mode).toBe("emergency");
    await archiveResearchSource(michelleCtx, id);
    const list = await listResearchSources({}, michelleCtx);
    expect(list.find((s) => s.id === id)).toBeUndefined();
  });
});
