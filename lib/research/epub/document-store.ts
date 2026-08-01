/**
 * In-process EPUB document/chapter store (local + tests).
 * Supabase persistence happens in the processing pipeline when configured.
 */
import type { EpubChapter, EpubInspectionResult } from "@/lib/research/epub/extract";
import { newId, nowIso } from "@/lib/research/public-research/artifact-store";

export type ResearchSourceDocument = {
  id: string;
  source_id: string;
  file_id: string;
  extraction_version: string;
  language: string | null;
  total_word_count: number;
  chapter_count: number;
  full_text_available: boolean;
  extraction_status: string;
  extraction_error_code: string | null;
  title: string | null;
  author: string | null;
  publisher: string | null;
  identifier: string | null;
  drm_protected: boolean;
  created_at: string;
  updated_at: string;
};

export type ResearchSourceChapterMeta = {
  id: string;
  document_id: string;
  source_id: string;
  chapter_index: number;
  chapter_title: string;
  source_href: string | null;
  word_count: number;
  summary_status: string;
  finding_count: number;
  review_status: string;
  created_at: string;
  /** Full text kept server-side only; never returned to browser by default. */
  extracted_text?: string;
};

const documents: ResearchSourceDocument[] = [];
const chapters: ResearchSourceChapterMeta[] = [];

export function clearEpubDocumentsForTests() {
  documents.length = 0;
  chapters.length = 0;
}

export function listDocumentsForSource(sourceId: string) {
  return documents.filter((d) => d.source_id === sourceId);
}

export function listChapterMetaForSource(sourceId: string) {
  return chapters
    .filter((c) => c.source_id === sourceId)
    .map(({ extracted_text: _t, ...meta }) => meta)
    .sort((a, b) => a.chapter_index - b.chapter_index);
}

export function getChapterText(chapterId: string): string | null {
  return chapters.find((c) => c.id === chapterId)?.extracted_text ?? null;
}

export function saveEpubExtraction(input: {
  sourceId: string;
  fileId: string;
  result: EpubInspectionResult;
}): { document: ResearchSourceDocument; chapters: ResearchSourceChapterMeta[] } {
  // Replace prior docs for this file
  const existing = documents.filter((d) => d.file_id === input.fileId);
  for (const doc of existing) {
    for (let i = chapters.length - 1; i >= 0; i -= 1) {
      if (chapters[i].document_id === doc.id) chapters.splice(i, 1);
    }
  }
  for (let i = documents.length - 1; i >= 0; i -= 1) {
    if (documents[i].file_id === input.fileId) documents.splice(i, 1);
  }

  const ts = nowIso();
  const document: ResearchSourceDocument = {
    id: newId("doc"),
    source_id: input.sourceId,
    file_id: input.fileId,
    extraction_version: "epub-v1",
    language: input.result.language,
    total_word_count: input.result.totalWordCount,
    chapter_count: input.result.chapterCount,
    full_text_available: input.result.fullTextAvailable,
    extraction_status: input.result.status,
    extraction_error_code: input.result.errorCode,
    title: input.result.title,
    author: input.result.author,
    publisher: input.result.publisher,
    identifier: input.result.identifier,
    drm_protected: input.result.drmProtected,
    created_at: ts,
    updated_at: ts,
  };
  documents.push(document);

  const savedChapters: ResearchSourceChapterMeta[] = input.result.chapters.map(
    (ch: EpubChapter) => {
      const row: ResearchSourceChapterMeta = {
        id: newId("ch"),
        document_id: document.id,
        source_id: input.sourceId,
        chapter_index: ch.chapterIndex,
        chapter_title: ch.chapterTitle,
        source_href: ch.sourceHref,
        word_count: ch.wordCount,
        summary_status: "not_started",
        finding_count: 0,
        review_status: "needs_review",
        created_at: ts,
        extracted_text: ch.extractedText,
      };
      chapters.push(row);
      return row;
    },
  );

  return { document, chapters: savedChapters };
}
