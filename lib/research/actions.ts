"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import {
  addResearchNote,
  addResearchSummary,
  approveResearchSummary,
  archiveResearchSource,
  createResearchSource,
  linkResearchSource,
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

export async function actionCreateResearchSource(
  input: CreateResearchSourceInput,
  filePayload?: {
    name: string;
    size: number;
    type: string;
    base64: string;
  } | null,
) {
  const ctx = await requireIdentity();
  try {
    const file = filePayload
      ? {
          name: filePayload.name,
          size: filePayload.size,
          type: filePayload.type,
          buffer: Buffer.from(filePayload.base64, "base64"),
        }
      : null;
    const sourceId = await createResearchSource(ctx, input, file);
    revalidateResearch(sourceId);
    return { ok: true as const, sourceId };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not create source.",
    };
  }
}

export async function actionAddResearchSummary(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const summary = await addResearchSummary(ctx, input);
    revalidateResearch(summary.source_id);
    return { ok: true as const, summary };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not save summary.",
    };
  }
}

export async function actionAddResearchNote(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const note = await addResearchNote(ctx, input);
    revalidateResearch(note.source_id);
    return { ok: true as const, note };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not save note.",
    };
  }
}

export async function actionLinkResearchSource(input: unknown) {
  const ctx = await requireIdentity();
  try {
    const link = await linkResearchSource(ctx, input);
    revalidateResearch(link.source_id);
    return { ok: true as const, link };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not link source.",
    };
  }
}

export async function actionArchiveResearchSource(sourceId: string) {
  const ctx = await requireIdentity();
  try {
    await archiveResearchSource(ctx, sourceId);
    revalidateResearch(sourceId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not archive source.",
    };
  }
}

export async function actionApproveResearchSummary(summaryId: string, sourceId: string) {
  const ctx = await requireIdentity();
  try {
    await approveResearchSummary(ctx, summaryId);
    revalidateResearch(sourceId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not approve summary.",
    };
  }
}
