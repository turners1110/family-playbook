/**
 * Research library services (Phase 1).
 * Uses local private store by default; Supabase path reserved for trip/prod
 * once migrations 0004/0005 are applied (see docs/research-library.md).
 */
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  enrichSource,
  newId,
  nowIso,
  readResearchLibrary,
  saveLocalResearchFile,
  toSourceCards,
  updateResearchLibrary,
} from "@/lib/research/local-store";
import type {
  ResearchSourceCard,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
} from "@/lib/research/types";
import {
  addResearchNoteSchema,
  addResearchSummarySchema,
  createResearchSourceSchema,
  deriveAvailability,
  deriveInitialProcessingStatus,
  linkResearchSourceSchema,
  validateResearchUpload,
  type CreateResearchSourceInput,
} from "@/lib/research/validation";

function canWriteResearch(ctx: FamilyContext) {
  const name = ctx.member.display_name.toLowerCase();
  return name.includes("sam") || name.includes("michelle");
}

export function assertCanWriteResearch(ctx: FamilyContext) {
  if (!canWriteResearch(ctx)) {
    throw new Error("Only Sam or Michelle can add or edit research sources.");
  }
}

export async function listResearchSources(filters?: {
  q?: string;
  sourceType?: string;
  processingStatus?: string;
  topic?: string;
  lifeStage?: string;
  evidenceRating?: string;
  linkedQuestions?: boolean;
  linkedPrinciples?: boolean;
  addedBy?: "sam" | "michelle";
  sort?: string;
  tab?: string;
}): Promise<ResearchSourceCard[]> {
  const store = await readResearchLibrary();
  let list = toSourceCards(store);

  if (filters?.tab === "books") {
    list = list.filter((s) => s.source_type === "book");
  } else if (filters?.tab === "papers") {
    list = list.filter((s) => s.source_type === "research_paper");
  } else if (filters?.tab === "guidelines") {
    list = list.filter((s) =>
      [
        "clinical_guideline",
        "government_guidance",
        "professional_org_guidance",
      ].includes(s.source_type),
    );
  } else if (filters?.tab === "articles") {
    list = list.filter((s) =>
      ["article", "website", "podcast", "video"].includes(s.source_type),
    );
  } else if (filters?.tab === "queue") {
    list = list.filter((s) =>
      ["queued", "processing", "processing_failed", "needs_review"].includes(
        s.processing_status,
      ),
    );
  }

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.author_text ?? "").toLowerCase().includes(q) ||
        (s.organization ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.topics.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters?.sourceType) {
    list = list.filter((s) => s.source_type === filters.sourceType);
  }
  if (filters?.processingStatus) {
    list = list.filter((s) => s.processing_status === filters.processingStatus);
  }
  if (filters?.topic) {
    list = list.filter((s) => s.topics.includes(filters.topic!));
  }
  if (filters?.lifeStage) {
    list = list.filter((s) => s.life_stages.includes(filters.lifeStage!));
  }
  if (filters?.evidenceRating) {
    list = list.filter((s) => s.evidence_rating === filters.evidenceRating);
  }
  if (filters?.linkedQuestions) {
    list = list.filter((s) => s.linked_question_count > 0);
  }
  if (filters?.linkedPrinciples) {
    list = list.filter((s) => s.linked_principle_count > 0);
  }
  if (filters?.addedBy === "sam") {
    list = list.filter((s) =>
      (s.added_by_display_name ?? "").toLowerCase().includes("sam"),
    );
  }
  if (filters?.addedBy === "michelle") {
    list = list.filter((s) =>
      (s.added_by_display_name ?? "").toLowerCase().includes("michelle"),
    );
  }

  const sort = filters?.sort ?? "recent";
  list.sort((a, b) => {
    if (sort === "author") {
      return (a.author_text ?? "").localeCompare(b.author_text ?? "") ||
        a.title.localeCompare(b.title);
    }
    if (sort === "year") {
      return (b.publication_year ?? 0) - (a.publication_year ?? 0);
    }
    if (sort === "linked") {
      return (
        b.linked_question_count +
        b.linked_principle_count -
        (a.linked_question_count + a.linked_principle_count)
      );
    }
    if (sort === "evidence") {
      const rank: Record<string, number> = {
        high: 5,
        moderate: 4,
        low: 3,
        expert_opinion: 2,
        personal_experience: 1,
        unknown: 0,
      };
      return (
        (rank[b.evidence_rating ?? "unknown"] ?? 0) -
        (rank[a.evidence_rating ?? "unknown"] ?? 0)
      );
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "processed") {
      return (b.processed_at ?? "").localeCompare(a.processed_at ?? "");
    }
    return b.created_at.localeCompare(a.created_at);
  });

  return list;
}

export async function getResearchSource(sourceId: string) {
  const store = await readResearchLibrary();
  const source = store.sources.find((s) => s.id === sourceId);
  if (!source) return null;
  return {
    source: enrichSource(source, store),
    files: store.files.filter((f) => f.source_id === sourceId),
    summaries: store.summaries
      .filter((s) => s.source_id === sourceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    notes: store.notes
      .filter((n) => n.source_id === sourceId)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)),
    links: store.links.filter((l) => l.source_id === sourceId),
  };
}

export async function createResearchSource(
  ctx: FamilyContext,
  raw: CreateResearchSourceInput,
  file?: { name: string; size: number; type?: string; buffer: Buffer } | null,
) {
  assertCanWriteResearch(ctx);
  const data = createResearchSourceSchema.parse({
    ...raw,
    rights_attested: raw.rights_attested === true,
  });

  if (data.ingestion_path === "upload_file" && !file) {
    throw new Error("A file is required for upload ingestion.");
  }
  if (file) {
    const check = validateResearchUpload(file);
    if (!check.ok) throw new Error(check.error);
  }
  if (data.rights_attested !== true && file) {
    throw new Error("Rights attestation is required before uploading a file.");
  }

  const hasNotes = Boolean(
    data.notes_from_sam?.trim() ||
      data.notes_from_michelle?.trim() ||
      data.shared_notes?.trim(),
  );
  const hasExcerpts = Boolean(data.pasted_excerpts?.trim());
  const availability = deriveAvailability({
    hasFile: Boolean(file),
    hasExcerpts,
    hasNotes,
    ingestionPath: data.ingestion_path,
  });
  const processing_status = deriveInitialProcessingStatus(availability);
  const timestamp = nowIso();
  const sourceId = newId("rs");

  await updateResearchLibrary((store) => {
    store.sources.unshift({
      id: sourceId,
      family_id: ctx.family.id,
      title: data.title,
      subtitle: data.subtitle ?? null,
      source_type: data.source_type,
      author_text: data.author_text ?? null,
      organization: data.organization ?? null,
      publisher: data.publisher ?? null,
      publication_year: data.publication_year ?? null,
      edition: data.edition ?? null,
      isbn: data.isbn ?? null,
      description: data.description ?? null,
      source_url: data.source_url ?? null,
      cover_image_url: data.cover_image_url ?? null,
      availability_type: availability,
      processing_status,
      evidence_rating: data.evidence_rating ?? null,
      evidence_rating_reason: data.evidence_rating_reason ?? null,
      evidence_basis: data.evidence_basis ?? null,
      evidence_rating_approved: false,
      ownership_status: data.ownership_status ?? null,
      topics: data.topics,
      life_stages: data.life_stages,
      rights_attested: data.rights_attested === true,
      added_by_member_id: ctx.member.id,
      added_by_display_name: ctx.member.display_name,
      created_at: timestamp,
      updated_at: timestamp,
      processed_at: null,
      archived_at: null,
    });

    const pushNote = (
      scope: "sam" | "michelle" | "shared",
      text: string | undefined,
    ) => {
      if (!text?.trim()) return;
      store.notes.push({
        id: newId("rsn"),
        source_id: sourceId,
        note_scope: scope,
        author_member_id: ctx.member.id,
        author_display_name: ctx.member.display_name,
        text: text.trim(),
        page_or_chapter: null,
        tags: [],
        pinned: false,
        created_at: timestamp,
        updated_at: timestamp,
      });
    };
    pushNote("sam", data.notes_from_sam);
    pushNote("michelle", data.notes_from_michelle);
    pushNote("shared", data.shared_notes);
    if (hasExcerpts) {
      store.notes.push({
        id: newId("rsn"),
        source_id: sourceId,
        note_scope: "shared",
        author_member_id: ctx.member.id,
        author_display_name: ctx.member.display_name,
        text: data.pasted_excerpts!.trim(),
        page_or_chapter: null,
        tags: ["excerpt"],
        pinned: true,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  });

  if (file) {
    const check = validateResearchUpload(file);
    if (!check.ok) throw new Error(check.error);
    const saved = await saveLocalResearchFile({
      familyId: ctx.family.id,
      sourceId,
      filename: file.name,
      buffer: file.buffer,
      mimeType: check.mimeType,
    });
    await updateResearchLibrary((store) => {
      const duplicate = store.files.find(
        (f) => f.source_id === sourceId && f.file_hash === saved.file_hash,
      );
      if (!duplicate) store.files.push(saved);
    });
  }

  return sourceId;
}

export async function addResearchSummary(
  ctx: FamilyContext,
  raw: unknown,
): Promise<ResearchSourceSummary> {
  assertCanWriteResearch(ctx);
  const data = addResearchSummarySchema.parse(raw);
  const timestamp = nowIso();
  const summary: ResearchSourceSummary = {
    id: newId("rss"),
    source_id: data.source_id,
    summary_type: data.summary_type,
    content: data.content,
    content_basis: data.content_basis,
    model_name: null,
    prompt_version: null,
    source_version: 1,
    chapter_title: data.chapter_title ?? null,
    created_at: timestamp,
    approved_by_member_id: null,
    approved_at: null,
    review_status: "needs_review",
  };
  await updateResearchLibrary((store) => {
    if (!store.sources.some((s) => s.id === data.source_id)) {
      throw new Error("Source not found.");
    }
    store.summaries.unshift(summary);
    const source = store.sources.find((s) => s.id === data.source_id)!;
    source.updated_at = timestamp;
  });
  return summary;
}

export async function addResearchNote(
  ctx: FamilyContext,
  raw: unknown,
): Promise<ResearchSourceNote> {
  assertCanWriteResearch(ctx);
  const data = addResearchNoteSchema.parse(raw);
  const timestamp = nowIso();
  const note: ResearchSourceNote = {
    id: newId("rsn"),
    source_id: data.source_id,
    note_scope: data.note_scope,
    author_member_id: ctx.member.id,
    author_display_name: ctx.member.display_name,
    text: data.text,
    page_or_chapter: data.page_or_chapter ?? null,
    tags: data.tags,
    pinned: data.pinned ?? false,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await updateResearchLibrary((store) => {
    if (!store.sources.some((s) => s.id === data.source_id)) {
      throw new Error("Source not found.");
    }
    store.notes.unshift(note);
  });
  return note;
}

export async function linkResearchSource(
  ctx: FamilyContext,
  raw: unknown,
): Promise<ResearchSourceLink> {
  assertCanWriteResearch(ctx);
  const data = linkResearchSourceSchema.parse(raw);
  if (!data.question_id && !data.principle_id) {
    throw new Error("Link a question or principle.");
  }
  const link: ResearchSourceLink = {
    id: newId("rsl"),
    source_id: data.source_id,
    link_type: data.link_type,
    question_id: data.question_id ?? null,
    principle_id: data.principle_id ?? null,
    outcome_id: null,
    knowledge_item_id: null,
    checklist_task_id: null,
    finding_id: null,
    relevance_note: data.relevance_note ?? null,
    created_at: nowIso(),
  };
  await updateResearchLibrary((store) => {
    if (!store.sources.some((s) => s.id === data.source_id)) {
      throw new Error("Source not found.");
    }
    store.links.unshift(link);
  });
  return link;
}

export async function archiveResearchSource(ctx: FamilyContext, sourceId: string) {
  assertCanWriteResearch(ctx);
  const timestamp = nowIso();
  await updateResearchLibrary((store) => {
    const source = store.sources.find((s) => s.id === sourceId);
    if (!source) throw new Error("Source not found.");
    source.archived_at = timestamp;
    source.processing_status = "archived";
    source.updated_at = timestamp;
  });
}

export async function getResearchForQuestion(questionId: string) {
  const store = await readResearchLibrary();
  const links = store.links.filter((l) => l.question_id === questionId);
  return links.map((link) => {
    const source = store.sources.find((s) => s.id === link.source_id);
    return {
      link,
      source: source ? enrichSource(source, store) : null,
      shortFinding:
        store.summaries.find(
          (s) =>
            s.source_id === link.source_id && s.summary_type === "short_summary",
        )?.content ??
        link.relevance_note ??
        null,
    };
  }).filter((row) => row.source && !row.source.archived_at);
}

export async function approveResearchSummary(
  ctx: FamilyContext,
  summaryId: string,
) {
  assertCanWriteResearch(ctx);
  const timestamp = nowIso();
  await updateResearchLibrary((store) => {
    const summary = store.summaries.find((s) => s.id === summaryId);
    if (!summary) throw new Error("Summary not found.");
    summary.review_status = "approved";
    summary.approved_at = timestamp;
    summary.approved_by_member_id = ctx.member.id;
  });
}
