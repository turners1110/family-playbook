import type { FamilyContext } from "@/lib/auth/family-context";
import type {
  ResearchCoverageComparison,
  ResearchExternalSource,
  ResearchPreliminaryFinding,
  ResearchProcessingJob,
  ResearchPublicOverview,
  ResearchSource,
  ResearchSourceCard,
  ResearchSourceCoverage,
  ResearchSourceFile,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
} from "@/lib/research/types";
import type { CreateResearchSourceInput } from "@/lib/research/validation";
import type { ResearchListFilters } from "@/lib/research/filters";

export type ResearchSourceDetail = {
  source: ResearchSourceCard;
  files: ResearchSourceFile[];
  summaries: ResearchSourceSummary[];
  notes: ResearchSourceNote[];
  links: ResearchSourceLink[];
  externalSources?: ResearchExternalSource[];
  publicOverview?: ResearchPublicOverview | null;
  sourceGroundedOverview?: ResearchPublicOverview | null;
  preliminaryFindings?: ResearchPreliminaryFinding[];
  jobs?: ResearchProcessingJob[];
  coverage?: ResearchSourceCoverage;
  comparisons?: ResearchCoverageComparison[];
};

export type PrepareUploadResult = {
  storagePath: string;
  token: string;
  signedUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
};

export type ResearchRepository = {
  listSources(
    familyId: string,
    filters?: ResearchListFilters,
  ): Promise<ResearchSourceCard[]>;
  getSource(
    familyId: string,
    sourceId: string,
  ): Promise<ResearchSourceDetail | null>;
  createSource(
    familyId: string,
    ctx: FamilyContext,
    data: CreateResearchSourceInput,
  ): Promise<string>;
  updateSource(
    familyId: string,
    sourceId: string,
    patch: Partial<ResearchSource>,
  ): Promise<void>;
  archiveSource(familyId: string, sourceId: string): Promise<void>;
  addNote(
    familyId: string,
    ctx: FamilyContext,
    input: {
      source_id: string;
      note_scope: "sam" | "michelle" | "shared";
      text: string;
      page_or_chapter?: string | null;
      tags?: string[];
      pinned?: boolean;
    },
  ): Promise<ResearchSourceNote>;
  addSummary(
    familyId: string,
    input: {
      source_id: string;
      summary_type: ResearchSourceSummary["summary_type"];
      content: string;
      content_basis: ResearchSourceSummary["content_basis"];
      chapter_title?: string | null;
    },
  ): Promise<ResearchSourceSummary>;
  approveSummary(
    familyId: string,
    summaryId: string,
    memberId: string,
  ): Promise<void>;
  linkQuestion(
    familyId: string,
    input: {
      source_id: string;
      question_id?: string | null;
      principle_id?: string | null;
      link_type: ResearchSourceLink["link_type"];
      relevance_note?: string | null;
    },
  ): Promise<ResearchSourceLink>;
  prepareUpload(
    familyId: string,
    input: {
      sourceId: string;
      filename: string;
      mimeType: string;
      fileSize: number;
      fileHash: string;
      rightsAttested?: boolean;
    },
  ): Promise<PrepareUploadResult>;
  finalizeUpload(
    familyId: string,
    input: {
      sourceId: string;
      storagePath: string;
      originalFilename: string;
      mimeType: string;
      fileSize: number;
      fileHash: string;
    },
  ): Promise<ResearchSourceFile>;
  /** Optional: load uploaded bytes for server-side extraction. */
  readUploadedBytes?(
    familyId: string,
    storagePath: string,
  ): Promise<Buffer | null>;
  /** Local/dev only — write bytes to private storage. */
  uploadFileBytes?(
    familyId: string,
    input: {
      sourceId: string;
      filename: string;
      mimeType: string;
      buffer: Buffer;
      fileHash: string;
      rightsAttested?: boolean;
    },
  ): Promise<ResearchSourceFile>;
  createSignedDownloadUrl(
    familyId: string,
    sourceId: string,
    fileId: string,
    expiresInSeconds?: number,
  ): Promise<string>;
  getLinksForQuestion(
    familyId: string,
    questionId: string,
  ): Promise<
    {
      link: ResearchSourceLink;
      source: ResearchSourceCard | null;
      shortFinding: string | null;
    }[]
  >;
  healthCheck(): Promise<boolean>;
};
