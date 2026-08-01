/**
 * Supabase-backed research repository (production / Trip Mode).
 * Uses the service-role client on the server only — never from the browser.
 */
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyContext } from "@/lib/auth/family-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ResearchNotFoundError } from "@/lib/research/errors";
import {
  filterAndSortSources,
  type ResearchListFilters,
} from "@/lib/research/filters";
import type {
  PrepareUploadResult,
  ResearchRepository,
  ResearchSourceDetail,
} from "@/lib/research/repository";
import type {
  ResearchSource,
  ResearchSourceCard,
  ResearchSourceFile,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
  ResearchAvailabilityType,
  ResearchProcessingStatus,
  ResearchSourceType,
  ResearchEvidenceRating,
  ResearchEvidenceBasis,
  ResearchOwnershipStatus,
  ResearchSummaryType,
  ResearchNoteScope,
  ResearchLinkType,
} from "@/lib/research/types";
import type { CreateResearchSourceInput } from "@/lib/research/validation";
import {
  deriveAvailability,
  deriveInitialProcessingStatus,
} from "@/lib/research/validation";

export const RESEARCH_BUCKET = "research-sources";
const SIGNED_UPLOAD_TTL = 5 * 60; // 5 minutes — signed upload URLs expire quickly
const SIGNED_DOWNLOAD_TTL = 60; // 60 seconds

type SourceRow = {
  id: string;
  family_id: string;
  title: string;
  subtitle: string | null;
  source_type: string;
  author_text: string | null;
  organization: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  isbn: string | null;
  description: string | null;
  source_url: string | null;
  cover_image_url: string | null;
  availability_type: string;
  processing_status: string;
  evidence_rating: string | null;
  evidence_rating_reason: string | null;
  evidence_basis: string | null;
  evidence_rating_approved: boolean;
  ownership_status: string | null;
  topics: string[] | null;
  life_stages: string[] | null;
  rights_attested: boolean;
  added_by_member_id: string | null;
  added_by_display_name: string | null;
  recommended_slug: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  archived_at: string | null;
};

function mapSource(row: SourceRow): ResearchSource {
  return {
    id: row.id,
    family_id: row.family_id,
    title: row.title,
    subtitle: row.subtitle,
    source_type: row.source_type as ResearchSourceType,
    author_text: row.author_text,
    organization: row.organization,
    publisher: row.publisher,
    publication_year: row.publication_year,
    edition: row.edition,
    isbn: row.isbn,
    description: row.description,
    source_url: row.source_url,
    cover_image_url: row.cover_image_url,
    availability_type: row.availability_type as ResearchAvailabilityType,
    processing_status: row.processing_status as ResearchProcessingStatus,
    evidence_rating: row.evidence_rating as ResearchEvidenceRating | null,
    evidence_rating_reason: row.evidence_rating_reason,
    evidence_basis: row.evidence_basis as ResearchEvidenceBasis | null,
    evidence_rating_approved: row.evidence_rating_approved,
    ownership_status: row.ownership_status as ResearchOwnershipStatus | null,
    topics: row.topics ?? [],
    life_stages: row.life_stages ?? [],
    rights_attested: row.rights_attested,
    added_by_member_id: row.added_by_member_id,
    added_by_display_name: row.added_by_display_name,
    recommended_slug: row.recommended_slug ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    processed_at: row.processed_at,
    archived_at: row.archived_at,
  };
}

function enrich(
  source: ResearchSource,
  counts: {
    linked_question_count: number;
    linked_principle_count: number;
    has_summary: boolean;
    file_count: number;
  },
): ResearchSourceCard {
  return {
    ...source,
    finding_count: 0,
    ...counts,
  };
}

export function createSupabaseResearchRepository(
  adminClient?: SupabaseClient,
): ResearchRepository {
  const admin = () => adminClient ?? createSupabaseAdminClient();

  async function assertOwned(familyId: string, sourceId: string) {
    const { data, error } = await admin()
      .from("research_sources")
      .select("id")
      .eq("id", sourceId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ResearchNotFoundError();
  }

  async function syncTopicsLifeStages(
    sourceId: string,
    topics: string[],
    lifeStages: string[],
  ) {
    const client = admin();
    await client.from("research_source_topics").delete().eq("source_id", sourceId);
    await client
      .from("research_source_life_stages")
      .delete()
      .eq("source_id", sourceId);
    if (topics.length) {
      await client.from("research_source_topics").insert(
        topics.map((topic_key) => ({ source_id: sourceId, topic_key })),
      );
    }
    if (lifeStages.length) {
      await client.from("research_source_life_stages").insert(
        lifeStages.map((life_stage) => ({ source_id: sourceId, life_stage })),
      );
    }
  }

  async function countsForSources(sourceIds: string[]) {
    const empty = {
      linked_question_count: 0,
      linked_principle_count: 0,
      has_summary: false,
      file_count: 0,
    };
    const map = new Map(sourceIds.map((id) => [id, { ...empty }]));
    if (!sourceIds.length) return map;

    const client = admin();
    const [links, summaries, files] = await Promise.all([
      client
        .from("research_source_links")
        .select("source_id,question_id,principle_id")
        .in("source_id", sourceIds),
      client
        .from("research_source_summaries")
        .select("source_id")
        .in("source_id", sourceIds),
      client
        .from("research_source_files")
        .select("source_id")
        .in("source_id", sourceIds),
    ]);

    for (const row of links.data ?? []) {
      const c = map.get(row.source_id);
      if (!c) continue;
      if (row.question_id) c.linked_question_count += 1;
      if (row.principle_id) c.linked_principle_count += 1;
    }
    for (const row of summaries.data ?? []) {
      const c = map.get(row.source_id);
      if (c) c.has_summary = true;
    }
    for (const row of files.data ?? []) {
      const c = map.get(row.source_id);
      if (c) c.file_count += 1;
    }
    return map;
  }

  return {
    async healthCheck() {
      const { error } = await admin()
        .from("research_sources")
        .select("id", { head: true, count: "exact" })
        .limit(1);
      return !error;
    },

    async listSources(familyId, filters?: ResearchListFilters) {
      const { data, error } = await admin()
        .from("research_sources")
        .select("*")
        .eq("family_id", familyId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as SourceRow[];
      const counts = await countsForSources(rows.map((r) => r.id));
      const cards = rows.map((row) =>
        enrich(mapSource(row), counts.get(row.id)!),
      );
      return filterAndSortSources(cards, filters);
    },

    async getSource(familyId, sourceId): Promise<ResearchSourceDetail | null> {
      const client = admin();
      const { data, error } = await client
        .from("research_sources")
        .select("*")
        .eq("id", sourceId)
        .eq("family_id", familyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      const [files, summaries, notes, links] = await Promise.all([
        client.from("research_source_files").select("*").eq("source_id", sourceId),
        client
          .from("research_source_summaries")
          .select("*")
          .eq("source_id", sourceId)
          .order("created_at", { ascending: false }),
        client
          .from("research_source_notes")
          .select("*")
          .eq("source_id", sourceId)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        client.from("research_source_links").select("*").eq("source_id", sourceId),
      ]);

      const counts = await countsForSources([sourceId]);
      return {
        source: enrich(mapSource(data as SourceRow), counts.get(sourceId)!),
        files: (files.data ?? []) as ResearchSourceFile[],
        summaries: (summaries.data ?? []) as ResearchSourceSummary[],
        notes: (notes.data ?? []) as ResearchSourceNote[],
        links: (links.data ?? []) as ResearchSourceLink[],
      };
    },

    async createSource(
      familyId: string,
      ctx: FamilyContext,
      data: CreateResearchSourceInput,
    ) {
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
      const processing_status = deriveInitialProcessingStatus(availability);
      const topics = data.topics ?? [];
      const life_stages = data.life_stages ?? [];
      const sourceId = randomUUID();
      const timestamp = new Date().toISOString();

      const { error } = await admin()
        .from("research_sources")
        .insert({
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
          processing_status,
          evidence_rating: data.evidence_rating ?? null,
          evidence_rating_reason: data.evidence_rating_reason ?? null,
          evidence_basis: data.evidence_basis ?? null,
          evidence_rating_approved: false,
          ownership_status: data.ownership_status ?? null,
          topics,
          life_stages,
          rights_attested: data.rights_attested === true,
          added_by_member_id: ctx.member.id,
          added_by_display_name: ctx.member.display_name,
          recommended_slug: data.recommended_slug ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        });
      if (error) throw new Error(error.message);

      await syncTopicsLifeStages(sourceId, topics, life_stages);

      const noteRows: Array<Record<string, unknown>> = [];
      const push = (scope: ResearchNoteScope, text?: string) => {
        if (!text?.trim()) return;
        noteRows.push({
          source_id: sourceId,
          note_scope: scope,
          author_member_id: ctx.member.id,
          author_display_name: ctx.member.display_name,
          text: text.trim(),
          page_or_chapter: null,
          tags: [],
          pinned: false,
        });
      };
      push("sam", data.notes_from_sam);
      push("michelle", data.notes_from_michelle);
      push("shared", data.shared_notes);
      if (hasExcerpts) {
        noteRows.push({
          source_id: sourceId,
          note_scope: "shared",
          author_member_id: ctx.member.id,
          author_display_name: ctx.member.display_name,
          text: data.pasted_excerpts!.trim(),
          page_or_chapter: null,
          tags: ["excerpt"],
          pinned: true,
        });
      }
      if (noteRows.length) {
        const { error: noteError } = await admin()
          .from("research_source_notes")
          .insert(noteRows);
        if (noteError) throw new Error(noteError.message);
      }

      return sourceId;
    },

    async updateSource(familyId, sourceId, patch) {
      await assertOwned(familyId, sourceId);
      const { error } = await admin()
        .from("research_sources")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", sourceId)
        .eq("family_id", familyId);
      if (error) throw new Error(error.message);
      if (patch.topics || patch.life_stages) {
        const detail = await this.getSource(familyId, sourceId);
        if (detail) {
          await syncTopicsLifeStages(
            sourceId,
            patch.topics ?? detail.source.topics,
            patch.life_stages ?? detail.source.life_stages,
          );
        }
      }
    },

    async archiveSource(familyId, sourceId) {
      await assertOwned(familyId, sourceId);
      const timestamp = new Date().toISOString();
      const { error } = await admin()
        .from("research_sources")
        .update({
          archived_at: timestamp,
          processing_status: "archived",
          updated_at: timestamp,
        })
        .eq("id", sourceId)
        .eq("family_id", familyId);
      if (error) throw new Error(error.message);
    },

    async addNote(familyId, ctx, input) {
      await assertOwned(familyId, input.source_id);
      const { data, error } = await admin()
        .from("research_source_notes")
        .insert({
          source_id: input.source_id,
          note_scope: input.note_scope,
          author_member_id: ctx.member.id,
          author_display_name: ctx.member.display_name,
          text: input.text,
          page_or_chapter: input.page_or_chapter ?? null,
          tags: input.tags ?? [],
          pinned: input.pinned ?? false,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ResearchSourceNote;
    },

    async addSummary(familyId, input) {
      await assertOwned(familyId, input.source_id);
      const { data, error } = await admin()
        .from("research_source_summaries")
        .insert({
          source_id: input.source_id,
          summary_type: input.summary_type as ResearchSummaryType,
          content: input.content,
          content_basis: input.content_basis,
          chapter_title: input.chapter_title ?? null,
          review_status: "needs_review",
          source_version: 1,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ResearchSourceSummary;
    },

    async approveSummary(familyId, summaryId, memberId) {
      const { data: summary, error: findError } = await admin()
        .from("research_source_summaries")
        .select("id,source_id")
        .eq("id", summaryId)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!summary) throw new ResearchNotFoundError("Summary not found.");
      await assertOwned(familyId, summary.source_id);
      const { error } = await admin()
        .from("research_source_summaries")
        .update({
          review_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_member_id: memberId,
        })
        .eq("id", summaryId);
      if (error) throw new Error(error.message);
    },

    async linkQuestion(familyId, input) {
      await assertOwned(familyId, input.source_id);
      const { data, error } = await admin()
        .from("research_source_links")
        .insert({
          source_id: input.source_id,
          link_type: input.link_type as ResearchLinkType,
          question_id: input.question_id ?? null,
          principle_id: input.principle_id ?? null,
          relevance_note: input.relevance_note ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ResearchSourceLink;
    },

    async prepareUpload(familyId, input) {
      await assertOwned(familyId, input.sourceId);
      const { data: source } = await admin()
        .from("research_sources")
        .select("rights_attested")
        .eq("id", input.sourceId)
        .single();
      const attested =
        source?.rights_attested === true || input.rightsAttested === true;
      if (!attested) {
        throw new Error(
          "Rights attestation is required before uploading a file.",
        );
      }
      if (!source?.rights_attested && input.rightsAttested) {
        await admin()
          .from("research_sources")
          .update({ rights_attested: true, updated_at: new Date().toISOString() })
          .eq("id", input.sourceId)
          .eq("family_id", familyId);
      }

      const ext =
        input.filename.toLowerCase().endsWith(".epub")
          ? ".epub"
          : input.filename.includes(".")
            ? input.filename.slice(input.filename.lastIndexOf("."))
            : "";
      const storagePath = `${familyId}/${input.sourceId}/${randomUUID()}${ext}`;

      const { data, error } = await admin()
        .storage
        .from(RESEARCH_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error || !data) {
        throw new Error(error?.message ?? "Could not create signed upload URL.");
      }

      return {
        storagePath: data.path ?? storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
      };
    },

    async finalizeUpload(familyId, input) {
      await assertOwned(familyId, input.sourceId);

      // Validate storage path belongs to family/source
      const expectedPrefix = `${familyId}/${input.sourceId}/`;
      if (!input.storagePath.startsWith(expectedPrefix)) {
        throw new Error("Storage path does not match family and source.");
      }

      const { data: existing } = await admin()
        .from("research_source_files")
        .select("*")
        .eq("source_id", input.sourceId)
        .eq("file_hash", input.fileHash)
        .maybeSingle();
      if (existing) {
        if (existing.storage_path === input.storagePath) {
          return existing as ResearchSourceFile;
        }
        throw new Error("This file was already uploaded for this source.");
      }

      // Confirm object exists
      const { data: listed } = await admin()
        .storage
        .from(RESEARCH_BUCKET)
        .list(`${familyId}/${input.sourceId}`, { search: input.storagePath.split("/").pop() });
      if (!listed || listed.length === 0) {
        // Fallback: try download head
        const { error: dlErr } = await admin()
          .storage
          .from(RESEARCH_BUCKET)
          .download(input.storagePath);
        if (dlErr) {
          throw new Error("Uploaded object was not found in private storage.");
        }
      }

      const { data, error } = await admin()
        .from("research_source_files")
        .insert({
          source_id: input.sourceId,
          storage_path: input.storagePath,
          original_filename: input.originalFilename,
          mime_type: input.mimeType,
          file_size: input.fileSize,
          file_hash: input.fileHash,
          extraction_status: "queued",
        })
        .select("*")
        .single();
      if (error) {
        if (error.message?.toLowerCase().includes("duplicate") || error.code === "23505") {
          throw new Error("This file was already uploaded for this source.");
        }
        throw new Error(error.message);
      }

      await admin()
        .from("research_sources")
        .update({
          availability_type: "partial_text",
          processing_status: "source_text_uploaded",
          epub_uploaded: input.mimeType.includes("epub") || input.originalFilename.toLowerCase().endsWith(".epub"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.sourceId)
        .eq("family_id", familyId);

      return data as ResearchSourceFile;
    },

    async readUploadedBytes(familyId, storagePath) {
      if (!storagePath.startsWith(`${familyId}/`)) return null;
      const { data, error } = await admin()
        .storage
        .from(RESEARCH_BUCKET)
        .download(storagePath);
      if (error || !data) return null;
      const ab = await data.arrayBuffer();
      return Buffer.from(ab);
    },

    async createSignedDownloadUrl(
      familyId,
      sourceId,
      fileId,
      expiresInSeconds = SIGNED_DOWNLOAD_TTL,
    ) {
      await assertOwned(familyId, sourceId);
      const { data: file, error } = await admin()
        .from("research_source_files")
        .select("*")
        .eq("id", fileId)
        .eq("source_id", sourceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!file) throw new ResearchNotFoundError("File not found.");

      const { data: signed, error: signError } = await admin()
        .storage
        .from(RESEARCH_BUCKET)
        .createSignedUrl(file.storage_path, expiresInSeconds);
      if (signError || !signed?.signedUrl) {
        throw new Error(signError?.message ?? "Could not create signed URL.");
      }
      return signed.signedUrl;
    },

    async getLinksForQuestion(familyId, questionId) {
      const client = admin();
      const { data: links, error } = await client
        .from("research_source_links")
        .select("*")
        .eq("question_id", questionId);
      if (error) throw new Error(error.message);

      const results = [];
      for (const link of (links ?? []) as ResearchSourceLink[]) {
        const detail = await this.getSource(familyId, link.source_id);
        if (!detail || detail.source.archived_at) continue;
        const shortFinding =
          detail.summaries.find((s) => s.summary_type === "short_summary")
            ?.content ??
          link.relevance_note ??
          null;
        results.push({
          link,
          source: detail.source,
          shortFinding,
        });
      }
      return results;
    },
  };
}

// silence unused TTL constant warning if createSignedUploadUrl ignores it
void SIGNED_UPLOAD_TTL;
