import { describe, expect, it, beforeEach } from "vitest";
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  clearResearchLibraryForTests,
  readResearchLibrary,
} from "@/lib/research/local-store";
import {
  addResearchNote,
  archiveResearchSource,
  createResearchSource,
  getResearchForQuestion,
  getResearchSource,
  linkResearchSource,
  listResearchSources,
} from "@/lib/research/services";
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

beforeEach(async () => {
  await clearResearchLibraryForTests();
});

describe("research availability", () => {
  it("labels metadata-only books clearly", () => {
    const availability = deriveAvailability({
      hasFile: false,
      hasExcerpts: false,
      hasNotes: false,
      ingestionPath: "owned_physical",
    });
    expect(availability).toBe("metadata_only");
    expect(deriveInitialProcessingStatus(availability)).toBe("metadata_only");
    expect(availabilityDisclosure(availability)).toContain("full summary requires source text");
  });

  it("labels uploads as partial text until processed", () => {
    expect(
      deriveAvailability({
        hasFile: true,
        hasExcerpts: false,
        hasNotes: false,
        ingestionPath: "upload_file",
      }),
    ).toBe("partial_text");
  });
});

describe("upload validation", () => {
  it("accepts supported files under the size limit", () => {
    const result = validateResearchUpload({
      name: "sleep.pdf",
      size: 1024,
      type: "application/pdf",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects executables and oversized files", () => {
    expect(
      validateResearchUpload({ name: "bad.exe", size: 10, type: "application/octet-stream" })
        .ok,
    ).toBe(false);
    expect(
      validateResearchUpload({
        name: "huge.pdf",
        size: 60 * 1024 * 1024,
        type: "application/pdf",
      }).ok,
    ).toBe(false);
  });
});

describe("research library phase 1", () => {
  it("adds a metadata-only book", async () => {
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
    const detail = await getResearchSource(id);
    expect(detail?.source.availability_type).toBe("metadata_only");
    expect(detail?.source.processing_status).toBe("metadata_only");
    expect(detail?.source.title).toBe("Cribsheet");
  });

  it("uploads a supported file without claiming full-book processing", async () => {
    const id = await createResearchSource(
      ctx,
      {
        title: "AAP guidance",
        source_type: "clinical_guideline",
        topics: [],
        life_stages: [],
        rights_attested: true,
        ingestion_path: "upload_file",
      },
      {
        name: "guide.pdf",
        size: 12,
        type: "application/pdf",
        buffer: Buffer.from("%PDF-fake"),
      },
    );
    const detail = await getResearchSource(id);
    expect(detail?.files).toHaveLength(1);
    expect(detail?.source.availability_type).toBe("partial_text");
    expect(detail?.source.processing_status).not.toBe("processed");
  });

  it("rejects unsupported uploads", async () => {
    await expect(
      createResearchSource(
        ctx,
        {
          title: "Bad",
          source_type: "uploaded_document",
          topics: [],
          life_stages: [],
          rights_attested: true,
          ingestion_path: "upload_file",
        },
        {
          name: "virus.exe",
          size: 10,
          type: "application/octet-stream",
          buffer: Buffer.from("MZ"),
        },
      ),
    ).rejects.toThrow(/not allowed|Unsupported/i);
  });

  it("keeps Sam and Michelle notes separate", async () => {
    const id = await createResearchSource(ctx, {
      title: "Notes book",
      source_type: "book",
      topics: [],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
      notes_from_sam: "Sam thinks sleep matters",
    });
    await addResearchNote(michelleCtx, {
      source_id: id,
      note_scope: "michelle",
      text: "Michelle wants more evidence",
      tags: [],
    });
    const detail = await getResearchSource(id);
    expect(detail?.notes.some((n) => n.note_scope === "sam")).toBe(true);
    expect(detail?.notes.some((n) => n.note_scope === "michelle")).toBe(true);
  });

  it("links sources to questions", async () => {
    const id = await createResearchSource(ctx, {
      title: "Sleep science",
      source_type: "research_paper",
      topics: ["sleep"],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    await linkResearchSource(ctx, {
      source_id: id,
      question_id: "q_sleep_1",
      link_type: "informs",
      relevance_note: "Supports protected rest",
    });
    const linked = await getResearchForQuestion("q_sleep_1");
    expect(linked).toHaveLength(1);
    expect(linked[0]?.source?.title).toBe("Sleep science");
  });

  it("archives a source", async () => {
    const id = await createResearchSource(ctx, {
      title: "Old article",
      source_type: "article",
      topics: [],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    await archiveResearchSource(ctx, id);
    const list = await listResearchSources({});
    expect(list.find((s) => s.id === id)).toBeUndefined();
    const store = await readResearchLibrary();
    expect(store.sources.find((s) => s.id === id)?.processing_status).toBe("archived");
  });

  it("rejects unauthorized writers", async () => {
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
  });

  it("filters library search", async () => {
    await createResearchSource(ctx, {
      title: "Feeding guide",
      source_type: "book",
      author_text: "Author A",
      topics: ["nutrition"],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    await createResearchSource(ctx, {
      title: "Sleep study",
      source_type: "research_paper",
      topics: ["sleep"],
      life_stages: [],
      rights_attested: false,
      ingestion_path: "metadata_only",
    });
    const books = await listResearchSources({ tab: "books" });
    expect(books.every((s) => s.source_type === "book")).toBe(true);
    const search = await listResearchSources({ q: "sleep" });
    expect(search.map((s) => s.title)).toEqual(["Sleep study"]);
  });
});
