/**
 * Import data/research-library.json (+ local files) into Supabase research tables.
 *
 * Env (via .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TURNER_FAMILY_NAME (optional)
 *
 * Never prints secrets or file contents.
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { resolveTurnerFamilyName } from "@/lib/db/family-name";
import { RESEARCH_BUCKET } from "@/lib/research/supabase-repository";
import type { ResearchLibraryStore } from "@/lib/research/types";

function isStore(value: unknown): value is ResearchLibraryStore {
  if (!value || typeof value !== "object") return false;
  const v = value as ResearchLibraryStore;
  return Array.isArray(v.sources) && Array.isArray(v.files);
}

async function main() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const metaPath = path.join(process.cwd(), "data", "research-library.json");
  const filesDir = path.join(process.cwd(), "data", "research-files");
  let raw: string;
  try {
    raw = await fs.readFile(metaPath, "utf8");
  } catch {
    console.log("No local research library found at data/research-library.json");
    console.log("imported: 0 sources, 0 files, 0 notes, 0 summaries, 0 links");
    console.log("skipped_duplicates: 0");
    return;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!isStore(parsed)) {
    throw new Error("Invalid research-library.json shape.");
  }

  const familyName = resolveTurnerFamilyName();
  const admin = createSupabaseAdminClient();
  const { data: family, error: familyError } = await admin
    .from("families")
    .select("id,name")
    .eq("name", familyName)
    .maybeSingle();
  if (familyError) throw new Error(`Family lookup failed: ${familyError.message}`);
  if (!family) {
    throw new Error(`Family not found: ${familyName}. Run pnpm setup:family first.`);
  }

  console.log("family found:", family.name);

  let importedSources = 0;
  let importedFiles = 0;
  let importedNotes = 0;
  let importedSummaries = 0;
  let importedLinks = 0;
  let skippedDuplicates = 0;

  const idMap = new Map<string, string>();

  for (const source of parsed.sources) {
    const { data: existing } = await admin
      .from("research_sources")
      .select("id")
      .eq("family_id", family.id)
      .eq("title", source.title)
      .eq("author_text", source.author_text)
      .maybeSingle();

    if (existing?.id) {
      idMap.set(source.id, existing.id);
      skippedDuplicates += 1;
      continue;
    }

    const { data: inserted, error } = await admin
      .from("research_sources")
      .insert({
        family_id: family.id,
        title: source.title,
        subtitle: source.subtitle,
        source_type: source.source_type,
        author_text: source.author_text,
        organization: source.organization,
        publisher: source.publisher,
        publication_year: source.publication_year,
        edition: source.edition,
        isbn: source.isbn,
        description: source.description,
        source_url: source.source_url,
        cover_image_url: source.cover_image_url,
        availability_type: source.availability_type,
        processing_status: source.processing_status,
        evidence_rating: source.evidence_rating,
        evidence_rating_reason: source.evidence_rating_reason,
        evidence_basis: source.evidence_basis,
        evidence_rating_approved: source.evidence_rating_approved,
        ownership_status: source.ownership_status,
        topics: source.topics,
        life_stages: source.life_stages,
        rights_attested: source.rights_attested,
        added_by_member_id: source.added_by_member_id,
        added_by_display_name: source.added_by_display_name,
        created_at: source.created_at,
        updated_at: source.updated_at,
        processed_at: source.processed_at,
        archived_at: source.archived_at,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Source import failed: ${error.message}`);
    idMap.set(source.id, inserted.id);
    importedSources += 1;

    if (source.topics?.length) {
      await admin.from("research_source_topics").upsert(
        source.topics.map((topic_key) => ({
          source_id: inserted.id,
          topic_key,
        })),
        { onConflict: "source_id,topic_key", ignoreDuplicates: true },
      );
    }
    if (source.life_stages?.length) {
      await admin.from("research_source_life_stages").upsert(
        source.life_stages.map((life_stage) => ({
          source_id: inserted.id,
          life_stage,
        })),
        { onConflict: "source_id,life_stage", ignoreDuplicates: true },
      );
    }
  }

  for (const note of parsed.notes) {
    const sourceId = idMap.get(note.source_id);
    if (!sourceId) continue;
    const { error } = await admin.from("research_source_notes").insert({
      source_id: sourceId,
      note_scope: note.note_scope,
      author_member_id: note.author_member_id,
      author_display_name: note.author_display_name,
      text: note.text,
      page_or_chapter: note.page_or_chapter,
      tags: note.tags,
      pinned: note.pinned,
      created_at: note.created_at,
      updated_at: note.updated_at,
    });
    if (!error) importedNotes += 1;
  }

  for (const summary of parsed.summaries) {
    const sourceId = idMap.get(summary.source_id);
    if (!sourceId) continue;
    const { error } = await admin.from("research_source_summaries").insert({
      source_id: sourceId,
      summary_type: summary.summary_type,
      content: summary.content,
      content_basis: summary.content_basis,
      model_name: summary.model_name,
      prompt_version: summary.prompt_version,
      source_version: summary.source_version,
      chapter_title: summary.chapter_title,
      created_at: summary.created_at,
      approved_by_member_id: summary.approved_by_member_id,
      approved_at: summary.approved_at,
      review_status: summary.review_status,
    });
    if (!error) importedSummaries += 1;
  }

  for (const link of parsed.links) {
    const sourceId = idMap.get(link.source_id);
    if (!sourceId) continue;
    const { error } = await admin.from("research_source_links").insert({
      source_id: sourceId,
      link_type: link.link_type,
      question_id: link.question_id,
      principle_id: link.principle_id,
      outcome_id: link.outcome_id,
      knowledge_item_id: link.knowledge_item_id,
      checklist_task_id: link.checklist_task_id,
      relevance_note: link.relevance_note,
      created_at: link.created_at,
    });
    if (!error) importedLinks += 1;
  }

  for (const file of parsed.files) {
    const sourceId = idMap.get(file.source_id);
    if (!sourceId) continue;

    const { data: existingFile } = await admin
      .from("research_source_files")
      .select("id")
      .eq("source_id", sourceId)
      .eq("file_hash", file.file_hash)
      .maybeSingle();
    if (existingFile) {
      skippedDuplicates += 1;
      continue;
    }

    const localPath = path.join(filesDir, file.storage_path);
    let buffer: Buffer | null = null;
    try {
      buffer = await fs.readFile(localPath);
    } catch {
      buffer = null;
    }

    const storagePath = `${family.id}/${sourceId}/${file.file_hash.slice(0, 16)}_${file.original_filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    if (buffer) {
      const hash = createHash("sha256").update(buffer).digest("hex");
      if (hash !== file.file_hash) {
        console.log("hash_mismatch_skipped: 1");
        continue;
      }
      const { error: uploadError } = await admin.storage
        .from(RESEARCH_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mime_type,
          upsert: false,
        });
      if (uploadError && !uploadError.message.toLowerCase().includes("already")) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }
    }

    const { error } = await admin.from("research_source_files").insert({
      source_id: sourceId,
      storage_path: storagePath,
      original_filename: file.original_filename,
      mime_type: file.mime_type,
      file_size: file.file_size,
      file_hash: file.file_hash,
      page_count: file.page_count,
      extraction_status: file.extraction_status,
      created_at: file.created_at,
    });
    if (!error) importedFiles += 1;
  }

  console.log(
    `imported: ${importedSources} sources, ${importedFiles} files, ${importedNotes} notes, ${importedSummaries} summaries, ${importedLinks} links`,
  );
  console.log(`skipped_duplicates: ${skippedDuplicates}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
