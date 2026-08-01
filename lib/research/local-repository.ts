/**
 * Local-development research repository.
 * Only used when USE_LOCAL_RESEARCH_STORE=true and not on Vercel.
 */
import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { ResearchNotFoundError } from "@/lib/research/errors";
import {
  filterAndSortSources,
  type ResearchListFilters,
} from "@/lib/research/filters";
import type { ResearchRepository } from "@/lib/research/repository";
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

const META_PATH = path.join(process.cwd(), "data", "research-library.json");
const FILES_DIR = path.join(process.cwd(), "data", "research-files");

function emptyStore(): ResearchLibraryStore {
  return { sources: [], files: [], summaries: [], notes: [], links: [] };
}

async function ensureDirs() {
  await fs.mkdir(path.dirname(META_PATH), { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
}

async function readStore(): Promise<ResearchLibraryStore> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    const parsed = JSON.parse(raw) as ResearchLibraryStore;
    return {
      sources: parsed.sources ?? [],
      files: parsed.files ?? [],
      summaries: parsed.summaries ?? [],
      notes: parsed.notes ?? [],
      links: parsed.links ?? [],
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ResearchLibraryStore) {
  await ensureDirs();
  const tmp = `${META_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, META_PATH);
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
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

export function createLocalResearchRepository(): ResearchRepository {
  return {
    async healthCheck() {
      await ensureDirs();
      return true;
    },

    async listSources(familyId, filters?: ResearchListFilters) {
      const store = await readStore();
      const list = store.sources
        .filter((s) => s.family_id === familyId && !s.archived_at)
        .map((s) => enrich(s, store));
      return filterAndSortSources(list, filters);
    },

    async getSource(familyId, sourceId) {
      const store = await readStore();
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
      };
    },

    async createSource(familyId, ctx, data: CreateResearchSourceInput) {
      const store = await readStore();
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
      await writeStore(store);
      return sourceId;
    },

    async updateSource(familyId, sourceId, patch) {
      const store = await readStore();
      const source = store.sources.find(
        (s) => s.id === sourceId && s.family_id === familyId,
      );
      if (!source) throw new ResearchNotFoundError();
      Object.assign(source, patch, { updated_at: nowIso() });
      await writeStore(store);
    },

    async archiveSource(familyId, sourceId) {
      const store = await readStore();
      const source = store.sources.find(
        (s) => s.id === sourceId && s.family_id === familyId,
      );
      if (!source) throw new ResearchNotFoundError();
      source.archived_at = nowIso();
      source.processing_status = "archived";
      source.updated_at = nowIso();
      await writeStore(store);
    },

    async addNote(familyId, ctx, input) {
      const store = await readStore();
      if (
        !store.sources.some(
          (s) => s.id === input.source_id && s.family_id === familyId,
        )
      ) {
        throw new ResearchNotFoundError();
      }
      const timestamp = nowIso();
      const note: ResearchSourceNote = {
        id: newId("rsn"),
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
      await writeStore(store);
      return note;
    },

    async addSummary(familyId, input) {
      const store = await readStore();
      if (
        !store.sources.some(
          (s) => s.id === input.source_id && s.family_id === familyId,
        )
      ) {
        throw new ResearchNotFoundError();
      }
      const summary: ResearchSourceSummary = {
        id: newId("rss"),
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
      await writeStore(store);
      return summary;
    },

    async approveSummary(familyId, summaryId, memberId) {
      const store = await readStore();
      const summary = store.summaries.find((s) => s.id === summaryId);
      if (!summary) throw new ResearchNotFoundError("Summary not found.");
      if (
        !store.sources.some(
          (s) => s.id === summary.source_id && s.family_id === familyId,
        )
      ) {
        throw new ResearchNotFoundError();
      }
      summary.review_status = "approved";
      summary.approved_at = nowIso();
      summary.approved_by_member_id = memberId;
      await writeStore(store);
    },

    async linkQuestion(familyId, input) {
      const store = await readStore();
      if (
        !store.sources.some(
          (s) => s.id === input.source_id && s.family_id === familyId,
        )
      ) {
        throw new ResearchNotFoundError();
      }
      const link: ResearchSourceLink = {
        id: newId("rsl"),
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
      await writeStore(store);
      return link;
    },

    async prepareUpload(familyId, input) {
      const store = await readStore();
      const source = store.sources.find(
        (s) => s.id === input.sourceId && s.family_id === familyId,
      );
      if (!source) throw new ResearchNotFoundError();
      if (!source.rights_attested) {
        throw new Error(
          "Rights attestation is required before uploading a file.",
        );
      }
      const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${familyId}/${input.sourceId}/${input.fileHash.slice(0, 16)}_${safe}`;
      return {
        storagePath,
        token: "local",
        signedUrl: `local://${storagePath}`,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
      };
    },

    async finalizeUpload(familyId, input) {
      const store = await readStore();
      const source = store.sources.find(
        (s) => s.id === input.sourceId && s.family_id === familyId,
      );
      if (!source) throw new ResearchNotFoundError();
      const existing = store.files.find(
        (f) =>
          f.source_id === input.sourceId && f.file_hash === input.fileHash,
      );
      if (existing) return existing;
      const file: ResearchSourceFile = {
        id: newId("rsf"),
        source_id: input.sourceId,
        storage_path: input.storagePath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        file_hash: input.fileHash,
        page_count: null,
        extraction_status: "not_started",
        created_at: nowIso(),
      };
      store.files.push(file);
      source.availability_type = "partial_text";
      source.processing_status = "not_processed";
      source.updated_at = nowIso();
      await writeStore(store);
      return file;
    },

    async uploadFileBytes(familyId, input) {
      const prepared = await this.prepareUpload!(familyId, {
        sourceId: input.sourceId,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        fileHash: input.fileHash,
      });
      const absolute = path.join(FILES_DIR, prepared.storagePath);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, input.buffer);
      return this.finalizeUpload(familyId, {
        sourceId: input.sourceId,
        storagePath: prepared.storagePath,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
        fileHash: input.fileHash,
      });
    },

    async createSignedDownloadUrl(familyId, sourceId, fileId) {
      const store = await readStore();
      if (
        !store.sources.some(
          (s) => s.id === sourceId && s.family_id === familyId,
        )
      ) {
        throw new ResearchNotFoundError();
      }
      const file = store.files.find(
        (f) => f.id === fileId && f.source_id === sourceId,
      );
      if (!file) throw new ResearchNotFoundError("File not found.");
      // Local signed URL is a private app route token, not a public storage URL.
      return `/api/research/files/${fileId}?sourceId=${sourceId}&sig=local`;
    },

    async getLinksForQuestion(familyId, questionId) {
      const store = await readStore();
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
}

export function hashLocalBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function clearLocalResearchLibraryForTests() {
  await writeStore(emptyStore());
}

/** @deprecated Prefer createLocalResearchRepository via services. */
export {
  readStore as readResearchLibrary,
  writeStore as writeResearchLibraryFile,
};
