"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { ResearchUnavailableError } from "@/lib/research/errors";
import {
  addResearchNote,
  addResearchSummary,
  approveResearchSummary,
  archiveResearchSource,
  createResearchSource,
  createSignedResearchFileUrl,
  finalizeResearchUpload,
  getResearchStorageStatus,
  linkResearchQuestion,
  prepareResearchUpload,
} from "@/lib/research/services";
import type { CreateResearchSourceInput } from "@/lib/research/validation";

async function requireIdentity() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  return ctx;
}

function revalidateResearch(sourceId?: string) {
  revalidatePath("/research");
  revalidatePath("/questions");
  if (sourceId) revalidatePath(`/research/${sourceId}`);
}

function toError(error: unknown) {
  if (error instanceof ResearchUnavailableError) {
    return { ok: false as const, error: error.message };
  }
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : "Research action failed.",
  };
}

export async function actionGetResearchStorageStatus() {
  return getResearchStorageStatus();
}

export async function actionCreateResearchSource(input: CreateResearchSourceInput) {
  const ctx = await requireIdentity();
  try {
    const sourceId = await createResearchSource(ctx, input);
    revalidateResearch(sourceId);
    return { ok: true as const, sourceId };
  } catch (error) {
    return toError(error);
  }
}

export async function actionPrepareResearchUpload(input: {
  sourceId: string;
  filename: string;
  size: number;
  type?: string;
  fileHash: string;
}) {
  const ctx = await requireIdentity();
  try {
    const prepared = await prepareResearchUpload(ctx, input);
    return { ok: true as const, prepared };
  } catch (error) {
    return toError(error);
  }
}

export async function actionFinalizeResearchUpload(input: {
  sourceId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
}) {
  const ctx = await requireIdentity();
  try {
    const file = await finalizeResearchUpload(ctx, input);
    revalidateResearch(input.sourceId);
    return { ok: true as const, file };
  } catch (error) {
    return toError(error);
  }
}

export async function actionCreateSignedResearchFileUrl(
  sourceId: string,
  fileId: string,
) {
  const ctx = await requireIdentity();
  try {
    const url = await createSignedResearchFileUrl(ctx, sourceId, fileId);
    return { ok: true as const, url };
  } catch (error) {
    return toError(error);
  }
}

export async function actionAddResearchSummary(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const summary = await addResearchSummary(ctx, input);
    revalidateResearch(summary.source_id);
    return { ok: true as const, summary };
  } catch (error) {
    return toError(error);
  }
}

export async function actionAddResearchNote(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const note = await addResearchNote(ctx, input);
    revalidateResearch(note.source_id);
    return { ok: true as const, note };
  } catch (error) {
    return toError(error);
  }
}

export async function actionLinkResearchSource(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const link = await linkResearchQuestion(ctx, input);
    revalidateResearch(link.source_id);
    return { ok: true as const, link };
  } catch (error) {
    return toError(error);
  }
}

export async function actionArchiveResearchSource(sourceId: string) {
  const ctx = await requireIdentity();
  try {
    await archiveResearchSource(ctx, sourceId);
    revalidateResearch(sourceId);
    return { ok: true as const };
  } catch (error) {
    return toError(error);
  }
}

export async function actionApproveResearchSummary(
  summaryId: string,
  sourceId: string,
) {
  const ctx = await requireIdentity();
  try {
    await approveResearchSummary(ctx, summaryId);
    revalidateResearch(sourceId);
    return { ok: true as const };
  } catch (error) {
    return toError(error);
  }
}
