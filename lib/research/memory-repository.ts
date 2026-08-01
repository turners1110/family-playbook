/**
 * In-memory research repository for unit tests (simulates durable store within process).
 */
import { createHash, randomUUID } from "crypto";
import type { FamilyContext } from "@/lib/auth/family-context";
import type { ResearchRepository, ResearchSourceDetail } from "@/lib/research/repository";
import type {
  ResearchLibraryStore,
  ResearchSource,
  ResearchSourceCard,
  ResearchSourceFile,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
} from "@/lib/research/types";
import type { CreateResearchSourceInput } from "@/lib/research/validation";
import {
  deriveAvailability,
  deriveInitialProcessingStatus,
} from "@/lib/research/validation";
import { filterAndSortSources, type ResearchListFilters } from "@/lib/research/filters";
import { ResearchNotFoundError } from "@/lib/research/errors";

function empty(): ResearchLibraryStore {
  return { sources: [], files: [], summaries: [], notes: [], links: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function enrich(
  source: ResearchSource,
  store: ResearchLibraryStore,
): ResearchSourceCard {
  const links = store.links.filter((l) => l.source_id === source.id);
  return {
    ...source,
    recommended_slug: source.recommended_slug ?? null,
    finding_count: 0,
    linked_question_count: links.filter((l) => l.question_id).length,
    linked_principle_count: links.filter((l) => l.principle_id).length,
    has_summary: store.summaries.some((s) => s.source_id === source.id),
    file_count: store.files.filter((f) => f.source_id === source.id).length,
  };
}

export function createMemoryResearchRepository(
  initial?: ResearchLibraryStore,
): ResearchRepository & {
  _store: ResearchLibraryStore;
  _files: Map<string, Buffer>;
  snapshot(): ResearchLibraryStore;
} {
  const store: ResearchLibraryStore = initial
    ? structuredClone(initial)
    : empty();
  const files = new Map<string, Buffer>();

  const assertOwned = (familyId: string, sourceId: string) => {
    const source = store.sources.find(
      (s) => s.id === sourceId && s.family_id === familyId,
    );
    if (!source) throw new ResearchNotFoundError();
    return source;
  };

  const repo: ResearchRepository & {
    _store: ResearchLibraryStore;
    _files: Map<string, Buffer>;
    snapshot(): ResearchLibraryStore;
  } = {
    _store: store,
    _files: files,
    snapshot: () => structuredClone(store),

    async healthCheck() {
      return true;
    },

    async listSources(familyId, filters) {
      const list = store.sources
        .filter((s) => s.family_id === familyId && !s.archived_at)
        .map((s) => enrich(s, store));
      return filterAndSortSources(list, filters);
    },

    async getSource(familyId, sourceId) {
      const source = store.sources.find(
        (s) => s.id === sourceId && s.family_id === familyId,
      );
      if (!source) return null;
      return {
        source: enrich(source, store),
        files: store.files.filter((f) => f.source_id === sourceId),
        summaries: store.summaries
          .filter((s) => s.source_id === sourceId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        notes: store.notes
          .filter((n) => n.source_id === sourceId)
          .sort(
            (a, b) =>
              Number(b.pinned) - Number(a.pinned) ||
              b.created_at.localeCompare(a.created_at),
          ),
        links: store.links.filter((l) => l.source_id === sourceId),
      } satisfies ResearchSourceDetail;
    },

    async createSource(familyId, ctx, data) {
      const timestamp = nowIso();
      const sourceId = randomUUID();
      const hasNotes = Boolean(
        data.notes_from_sam?.trim() ||
          data.notes_from_michelle?.trim() ||
          data.shared_notes?.trim(),
      );
      const hasExcerpts = Boolean(data.pasted_excerpts?.trim());
      const availability = deriveAvailability({
        hasFile: false,
        hasExcerpts,
        hasNotes,
        ingestionPath: data.ingestion_path,
      });
      store.sources.unshift({
        id: sourceId,
        family_id: familyId,
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
        processing_status: deriveInitialProcessingStatus(availability),
        evidence_rating: data.evidence_rating ?? null,
        evidence_rating_reason: data.evidence_rating_reason ?? null,
        evidence_basis: data.evidence_basis ?? null,
        evidence_rating_approved: false,
        ownership_status: data.ownership_status ?? null,
        topics: data.topics ?? [],
        life_stages: data.life_stages ?? [],
        rights_attested: data.rights_attested === true,
        added_by_member_id: ctx.member.id,
        added_by_display_name: ctx.member.display_name,
        recommended_slug: data.recommended_slug ?? null,
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
          id: id("rsn"),
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
          id: id("rsn"),
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
      return sourceId;
    },

    async updateSource(familyId, sourceId, patch) {
      const source = assertOwned(familyId, sourceId);
      Object.assign(source, patch, { updated_at: nowIso() });
    },

    async archiveSource(familyId, sourceId) {
      const source = assertOwned(familyId, sourceId);
      source.archived_at = nowIso();
      source.processing_status = "archived";
      source.updated_at = nowIso();
    },

    async addNote(familyId, ctx, input) {
      assertOwned(familyId, input.source_id);
      const timestamp = nowIso();
      const note: ResearchSourceNote = {
        id: id("rsn"),
        source_id: input.source_id,
        note_scope: input.note_scope,
        author_member_id: ctx.member.id,
        author_display_name: ctx.member.display_name,
        text: input.text,
        page_or_chapter: input.page_or_chapter ?? null,
        tags: input.tags ?? [],
        pinned: input.pinned ?? false,
        created_at: timestamp,
        updated_at: timestamp,
      };
      store.notes.unshift(note);
      return note;
    },

    async addSummary(familyId, input) {
      assertOwned(familyId, input.source_id);
      const summary: ResearchSourceSummary = {
        id: id("rss"),
        source_id: input.source_id,
        summary_type: input.summary_type,
        content: input.content,
        content_basis: input.content_basis,
        model_name: null,
        prompt_version: null,
        source_version: 1,
        chapter_title: input.chapter_title ?? null,
        created_at: nowIso(),
        approved_by_member_id: null,
        approved_at: null,
        review_status: "needs_review",
      };
      store.summaries.unshift(summary);
      return summary;
    },

    async approveSummary(familyId, summaryId, memberId) {
      const summary = store.summaries.find((s) => s.id === summaryId);
      if (!summary) throw new ResearchNotFoundError("Summary not found.");
      assertOwned(familyId, summary.source_id);
      summary.review_status = "approved";
      summary.approved_at = nowIso();
      summary.approved_by_member_id = memberId;
    },

    async linkQuestion(familyId, input) {
      assertOwned(familyId, input.source_id);
      const link: ResearchSourceLink = {
        id: id("rsl"),
        source_id: input.source_id,
        link_type: input.link_type,
        question_id: input.question_id ?? null,
        principle_id: input.principle_id ?? null,
        outcome_id: null,
        knowledge_item_id: null,
        checklist_task_id: null,
        finding_id: null,
        relevance_note: input.relevance_note ?? null,
        created_at: nowIso(),
      };
      store.links.unshift(link);
      return link;
    },

    async prepareUpload(familyId, input) {
      const source = assertOwned(familyId, input.sourceId);
      if (!source.rights_attested && !input.rightsAttested) {
        throw new Error(
          "Rights attestation is required before uploading a file.",
        );
      }
      if (!source.rights_attested && input.rightsAttested) {
        source.rights_attested = true;
      }
      const ext = input.filename.toLowerCase().endsWith(".epub")
        ? ".epub"
        : input.filename.includes(".")
          ? input.filename.slice(input.filename.lastIndexOf("."))
          : "";
      const storagePath = `${familyId}/${input.sourceId}/${randomUUID()}${ext}`;
      return {
        storagePath,
        token: `mem_${input.fileHash.slice(0, 12)}`,
        signedUrl: `memory://upload/${storagePath}`,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
      };
    },

    async finalizeUpload(familyId, input) {
      assertOwned(familyId, input.sourceId);
      if (!input.storagePath.startsWith(`${familyId}/${input.sourceId}/`)) {
        throw new Error("Storage path does not match family and source.");
      }
      const existing = store.files.find(
        (f) =>
          f.source_id === input.sourceId && f.file_hash === input.fileHash,
      );
      if (existing) {
        if (existing.storage_path === input.storagePath) return existing;
        throw new Error("This file was already uploaded for this source.");
      }
      const file: ResearchSourceFile = {
        id: id("rsf"),
        source_id: input.sourceId,
        storage_path: input.storagePath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        file_hash: input.fileHash,
        page_count: null,
        extraction_status: "queued",
        created_at: nowIso(),
      };
      store.files.push(file);
      const source = assertOwned(familyId, input.sourceId);
      source.availability_type = "partial_text";
      source.processing_status = "source_text_uploaded";
      source.updated_at = nowIso();
      return file;
    },

    async readUploadedBytes(familyId, storagePath) {
      if (!storagePath.startsWith(`${familyId}/`)) return null;
      return files.get(storagePath) ?? null;
    },

    async uploadFileBytes(familyId, input) {
      const prepared = await repo.prepareUpload(familyId, {
        sourceId: input.sourceId,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        fileHash: input.fileHash,
        rightsAttested: input.rightsAttested !== false,
      });
      files.set(prepared.storagePath, input.buffer);
      return repo.finalizeUpload(familyId, {
        sourceId: input.sourceId,
        storagePath: prepared.storagePath,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        fileHash: input.fileHash,
      });
    },

    async createSignedDownloadUrl(familyId, sourceId, fileId) {
      assertOwned(familyId, sourceId);
      const file = store.files.find(
        (f) => f.id === fileId && f.source_id === sourceId,
      );
      if (!file) throw new ResearchNotFoundError("File not found.");
      return `memory://download/${file.storage_path}?sig=test`;
    },

    async getLinksForQuestion(familyId, questionId) {
      return store.links
        .filter((l) => l.question_id === questionId)
        .map((link) => {
          const source = store.sources.find(
            (s) => s.id === link.source_id && s.family_id === familyId,
          );
          if (!source || source.archived_at) {
            return { link, source: null, shortFinding: null };
          }
          return {
            link,
            source: enrich(source, store),
            shortFinding:
              store.summaries.find(
                (s) =>
                  s.source_id === link.source_id &&
                  s.summary_type === "short_summary",
              )?.content ??
              link.relevance_note ??
              null,
          };
        })
        .filter((row) => row.source);
    },
  };

  return repo;
}

export function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export type { CreateResearchSourceInput, FamilyContext, ResearchListFilters };
