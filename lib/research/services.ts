/**
 * Backend-neutral Research & Books service layer (Phase 1.5).
 * Pages/components import only from here — not local-store or Supabase clients.
 */
import type { FamilyContext } from "@/lib/auth/family-context";
import {
  assertCanWriteResearch,
  resolveResearchFamilyId,
} from "@/lib/research/access";
import { ResearchUnavailableError } from "@/lib/research/errors";
import type { ResearchListFilters } from "@/lib/research/filters";
import { createLocalResearchRepository } from "@/lib/research/local-repository";
import {
  getResearchStorageMode,
  researchStorageLabel,
  researchWritesAllowed,
  type ResearchStorageMode,
} from "@/lib/research/mode";
import type { ResearchRepository } from "@/lib/research/repository";
import { createSupabaseResearchRepository } from "@/lib/research/supabase-repository";
import {
  addResearchNoteSchema,
  addResearchSummarySchema,
  createResearchSourceSchema,
  linkResearchSourceSchema,
  validateResearchUpload,
  type CreateResearchSourceInput,
} from "@/lib/research/validation";

let overrideRepository: ResearchRepository | null = null;
let overrideMode: ResearchStorageMode | null = null;

export function setResearchRepositoryForTests(
  repo: ResearchRepository | null,
  mode: ResearchStorageMode | null = null,
) {
  overrideRepository = repo;
  overrideMode = mode;
}

export function getResearchStorageStatus(): {
  mode: ResearchStorageMode;
  label: string;
  writesAllowed: boolean;
} {
  const mode = overrideMode ?? getResearchStorageMode();
  return {
    mode,
    label: researchStorageLabel(mode),
    writesAllowed: researchWritesAllowed(mode),
  };
}

function getRepository(): ResearchRepository {
  if (overrideRepository) return overrideRepository;
  const mode = getResearchStorageMode();
  if (mode === "local") return createLocalResearchRepository();
  if (mode === "supabase") return createSupabaseResearchRepository();
  throw new ResearchUnavailableError();
}

async function familyIdFor(ctx?: FamilyContext | null) {
  if (!ctx) {
    // Read-only paths that need family without write context (Trip Mode emergency
    // still goes through requireFamilyContext at the page layer).
    const { resolveTurnerFamilyId } = await import("@/lib/db/remote-json-store");
    const mode = overrideMode ?? getResearchStorageMode();
    if (mode === "local") return "family_turner";
    return resolveTurnerFamilyId();
  }
  const mode = overrideMode ?? getResearchStorageMode();
  if (mode === "local") return ctx.family.id;
  return resolveResearchFamilyId(ctx);
}

function assertWritable() {
  const status = getResearchStorageStatus();
  if (!status.writesAllowed) throw new ResearchUnavailableError();
}

export async function listResearchSources(
  filters?: ResearchListFilters,
  ctx?: FamilyContext,
) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    return repo.listSources(familyId, filters);
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return [];
    throw error;
  }
}

export async function getResearchSource(sourceId: string, ctx?: FamilyContext) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    return repo.getSource(familyId, sourceId);
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return null;
    throw error;
  }
}

export async function createResearchSource(
  ctx: FamilyContext,
  raw: CreateResearchSourceInput,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = createResearchSourceSchema.parse({
    ...raw,
    rights_attested: raw.rights_attested === true,
  });
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.createSource(familyId, ctx, data);
}

export async function updateResearchSource(
  ctx: FamilyContext,
  sourceId: string,
  patch: Parameters<ResearchRepository["updateSource"]>[2],
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.updateSource(familyId, sourceId, patch);
}

export async function archiveResearchSource(
  ctx: FamilyContext,
  sourceId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.archiveSource(familyId, sourceId);
}

export async function addResearchNote(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = addResearchNoteSchema.parse(raw);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.addNote(familyId, ctx, data);
}

export async function addResearchSummary(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = addResearchSummarySchema.parse(raw);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.addSummary(familyId, data);
}

export async function approveResearchSummary(
  ctx: FamilyContext,
  summaryId: string,
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  await repo.approveSummary(familyId, summaryId, ctx.member.id);
}

export async function linkResearchQuestion(ctx: FamilyContext, raw: unknown) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const data = linkResearchSourceSchema.parse(raw);
  if (!data.question_id && !data.principle_id) {
    throw new Error("Link a question or principle.");
  }
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.linkQuestion(familyId, data);
}

/** @deprecated Use linkResearchQuestion */
export const linkResearchSource = linkResearchQuestion;

export async function prepareResearchUpload(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    filename: string;
    size: number;
    type?: string;
    fileHash: string;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const check = validateResearchUpload({
    name: input.filename,
    size: input.size,
    type: input.type,
  });
  if (!check.ok) throw new Error(check.error);

  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.prepareUpload(familyId, {
    sourceId: input.sourceId,
    filename: input.filename,
    mimeType: check.mimeType,
    fileSize: input.size,
    fileHash: input.fileHash,
  });
}

export async function finalizeResearchUpload(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    fileHash: string;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const check = validateResearchUpload({
    name: input.originalFilename,
    size: input.fileSize,
    type: input.mimeType,
  });
  if (!check.ok) throw new Error(check.error);

  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.finalizeUpload(familyId, {
    sourceId: input.sourceId,
    storagePath: input.storagePath,
    originalFilename: input.originalFilename,
    mimeType: check.mimeType,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
  });
}

/** Local/memory only helper used by import script and tests. */
export async function uploadResearchFile(
  ctx: FamilyContext,
  input: {
    sourceId: string;
    filename: string;
    mimeType?: string;
    buffer: Buffer;
    fileHash: string;
  },
) {
  assertWritable();
  assertCanWriteResearch(ctx);
  const check = validateResearchUpload({
    name: input.filename,
    size: input.buffer.length,
    type: input.mimeType,
  });
  if (!check.ok) throw new Error(check.error);
  const repo = getRepository();
  if (!repo.uploadFileBytes) {
    throw new Error(
      "Direct byte upload is only available for local/import paths. Use signed upload in production.",
    );
  }
  const familyId = await familyIdFor(ctx);
  return repo.uploadFileBytes(familyId, {
    sourceId: input.sourceId,
    filename: input.filename,
    mimeType: check.mimeType,
    buffer: input.buffer,
    fileHash: input.fileHash,
  });
}

export async function createSignedResearchFileUrl(
  ctx: FamilyContext,
  sourceId: string,
  fileId: string,
) {
  const repo = getRepository();
  const familyId = await familyIdFor(ctx);
  return repo.createSignedDownloadUrl(familyId, sourceId, fileId);
}

export async function getResearchForQuestion(
  questionId: string,
  ctx?: FamilyContext,
) {
  try {
    const repo = getRepository();
    const familyId = await familyIdFor(ctx ?? null);
    return repo.getLinksForQuestion(familyId, questionId);
  } catch (error) {
    if (error instanceof ResearchUnavailableError) return [];
    throw error;
  }
}

export async function checkResearchBackendHealth(): Promise<boolean> {
  try {
    const mode = overrideMode ?? getResearchStorageMode();
    if (mode === "unavailable") return false;
    return getRepository().healthCheck();
  } catch {
    return false;
  }
}
