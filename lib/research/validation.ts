import { z } from "zod";
import {
  RESEARCH_ALLOWED_EXTENSIONS,
  RESEARCH_ALLOWED_MIME_TYPES,
  RESEARCH_EVIDENCE_BASES,
  RESEARCH_EVIDENCE_RATINGS,
  RESEARCH_LINK_TYPES,
  RESEARCH_MAX_FILE_BYTES,
  RESEARCH_NOTE_SCOPES,
  RESEARCH_OWNERSHIP_STATUSES,
  RESEARCH_REJECTED_EXTENSIONS,
  RESEARCH_SOURCE_TYPES,
  RESEARCH_SUMMARY_TYPES,
  type ResearchAvailabilityType,
  type ResearchProcessingStatus,
} from "@/lib/research/types";

export const createResearchSourceSchema = z.object({
  title: z.string().trim().min(1).max(500),
  subtitle: z.string().trim().max(500).nullable().optional(),
  source_type: z.enum(RESEARCH_SOURCE_TYPES),
  author_text: z.string().trim().max(500).nullable().optional(),
  organization: z.string().trim().max(500).nullable().optional(),
  publisher: z.string().trim().max(500).nullable().optional(),
  publication_year: z.number().int().min(1500).max(2100).nullable().optional(),
  edition: z.string().trim().max(100).nullable().optional(),
  isbn: z.string().trim().max(32).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  source_url: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  cover_image_url: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  ownership_status: z.enum(RESEARCH_OWNERSHIP_STATUSES).nullable().optional(),
  topics: z.array(z.string()).default([]),
  life_stages: z.array(z.string()).default([]),
  evidence_rating: z.enum(RESEARCH_EVIDENCE_RATINGS).nullable().optional(),
  evidence_rating_reason: z.string().trim().max(2000).nullable().optional(),
  evidence_basis: z.enum(RESEARCH_EVIDENCE_BASES).nullable().optional(),
  notes_from_sam: z.string().trim().max(10000).optional(),
  notes_from_michelle: z.string().trim().max(10000).optional(),
  shared_notes: z.string().trim().max(10000).optional(),
  pasted_excerpts: z.string().trim().max(20000).optional(),
  rights_attested: z.boolean().default(false),
  ingestion_path: z.enum([
    "upload_file",
    "metadata_only",
    "public_url",
    "paste_excerpts",
    "owned_physical",
  ]),
  recommended_slug: z.string().trim().min(1).max(200).nullable().optional(),
});

export type CreateResearchSourceInput = z.input<typeof createResearchSourceSchema>;
export type CreateResearchSourceParsed = z.output<typeof createResearchSourceSchema>;

export const addResearchSummarySchema = z.object({
  source_id: z.string().min(1),
  summary_type: z.enum(RESEARCH_SUMMARY_TYPES),
  content: z.string().trim().min(1).max(20000),
  content_basis: z
    .enum(["manual", "source_states", "ai_interpretation", "practical_application"])
    .default("manual"),
  chapter_title: z.string().trim().max(300).nullable().optional(),
});

export const addResearchNoteSchema = z.object({
  source_id: z.string().min(1),
  note_scope: z.enum(RESEARCH_NOTE_SCOPES),
  text: z.string().trim().min(1).max(20000),
  page_or_chapter: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().optional(),
});

export const linkResearchSourceSchema = z.object({
  source_id: z.string().min(1),
  link_type: z.enum(RESEARCH_LINK_TYPES).default("informs"),
  question_id: z.string().nullable().optional(),
  principle_id: z.string().nullable().optional(),
  relevance_note: z.string().trim().max(2000).nullable().optional(),
});

export function deriveAvailability(input: {
  hasFile: boolean;
  hasExcerpts: boolean;
  hasNotes: boolean;
  ingestionPath: CreateResearchSourceInput["ingestion_path"];
}): ResearchAvailabilityType {
  if (input.hasFile) return "partial_text"; // Phase 1: uploaded ≠ fully processed
  if (input.hasExcerpts) return "partial_text";
  if (input.hasNotes) return "notes_only";
  if (input.ingestionPath === "owned_physical" || input.ingestionPath === "metadata_only") {
    return "metadata_only";
  }
  if (input.ingestionPath === "public_url") return "metadata_only";
  return "metadata_only";
}

export function deriveInitialProcessingStatus(
  availability: ResearchAvailabilityType,
): ResearchProcessingStatus {
  if (availability === "metadata_only") return "metadata_only";
  if (availability === "notes_only" || availability === "partial_text") {
    return "not_processed";
  }
  return "not_processed";
}

export function availabilityDisclosure(availability: ResearchAvailabilityType): string {
  switch (availability) {
    case "full_text":
      return "Full source text is available for private processing.";
    case "partial_text":
      return "Only selected text, excerpts, or an uploaded file is available — not a completed full-book process.";
    case "notes_only":
      return "A full summary requires source text. Current insights are based only on the notes and excerpts provided.";
    case "metadata_only":
      return "A full summary requires source text. Current insights are based only on the notes and excerpts provided.";
  }
}

export type FileValidationResult =
  | { ok: true; mimeType: string; extension: string }
  | { ok: false; error: string };

export function validateResearchUpload(file: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  const name = file.name.trim();
  const lower = name.toLowerCase();
  const extension = lower.includes(".") ? `.${lower.split(".").pop()}` : "";

  if (!name) return { ok: false, error: "Filename is required." };
  if (file.size <= 0) return { ok: false, error: "File is empty." };
  if (file.size > RESEARCH_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${RESEARCH_MAX_FILE_BYTES / (1024 * 1024)} MiB limit.`,
    };
  }

  if (
    (RESEARCH_REJECTED_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return { ok: false, error: "Executable and script files are not allowed." };
  }

  if (!(RESEARCH_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: PDF, EPUB, TXT, DOCX.",
    };
  }

  const mime = (file.type || "").toLowerCase();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !(RESEARCH_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return { ok: false, error: "Unsupported MIME type." };
  }

  const inferredMime =
    mime && mime !== "application/octet-stream"
      ? mime
      : extension === ".pdf"
        ? "application/pdf"
        : extension === ".epub"
          ? "application/epub+zip"
          : extension === ".txt"
            ? "text/plain"
            : extension === ".docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/msword";

  return { ok: true, mimeType: inferredMime, extension };
}

export function neverShowProcessedWithoutAvailability(
  status: ResearchProcessingStatus,
  availability: ResearchAvailabilityType,
): boolean {
  // Guardrail: "processed" must always be paired with an explicit availability label.
  if (status === "processed" && !availability) return false;
  return true;
}
