"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { assertCanAccessTestLab } from "@/lib/qa/access";
import type { QaManualPhase } from "@/lib/types/models";
import {
  buildQaReport,
  cleanupQaData,
  completeQaSession,
  confirmQaTasks,
  createQaTestPack,
  previewQaCleanup,
  runQaIntegrityCheck,
  seedQaExpectedAnswers,
  updateQaManualPhase,
  getQaRun,
} from "@/lib/services/qa-lab";

async function requireTestLab() {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  assertCanAccessTestLab(ctx);
  return ctx;
}

function revalidateQa(testRunId?: string) {
  revalidatePath("/settings/test-lab");
  revalidatePath("/conversations");
  revalidatePath("/conversations/history");
  if (testRunId) {
    revalidatePath(`/conversations/test/${testRunId}`);
    revalidatePath(`/settings/test-lab/${testRunId}`);
  }
}

export async function actionCreateQaTestPack() {
  const ctx = await requireTestLab();
  const result = await createQaTestPack(ctx.profile.id);
  revalidateQa(result.testRunId);
  return result;
}

export async function actionSeedQaAnswers(testRunId: string) {
  await requireTestLab();
  await seedQaExpectedAnswers(testRunId);
  revalidateQa(testRunId);
  return { ok: true as const };
}

export async function actionRunQaIntegrity(testRunId: string) {
  await requireTestLab();
  const report = await runQaIntegrityCheck(testRunId);
  revalidateQa(testRunId);
  return report;
}

export async function actionUpdateQaPhase(
  testRunId: string,
  phaseId: string,
  patch: Partial<QaManualPhase>,
) {
  await requireTestLab();
  await updateQaManualPhase(testRunId, phaseId, patch);
  revalidateQa(testRunId);
  return { ok: true as const };
}

export async function actionConfirmQaTasks(
  testRunId: string,
  titles: string[],
) {
  await requireTestLab();
  await confirmQaTasks(testRunId, titles);
  revalidateQa(testRunId);
  return { ok: true as const };
}

export async function actionCompleteQaSession(testRunId: string) {
  await requireTestLab();
  await completeQaSession(testRunId);
  revalidateQa(testRunId);
  return { ok: true as const };
}

export async function actionPreviewQaCleanup(testRunId: string) {
  await requireTestLab();
  return previewQaCleanup(testRunId);
}

export async function actionCleanupQaData(
  testRunId: string,
  confirmation: string,
) {
  await requireTestLab();
  const result = await cleanupQaData(testRunId, confirmation);
  revalidateQa(testRunId);
  return result;
}

export async function actionExportQaReport(testRunId: string) {
  const ctx = await requireTestLab();
  const { run } = await getQaRun(testRunId);
  if (!run) throw new Error("QA run not found.");
  const report = await runQaIntegrityCheck(testRunId);
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "unknown";
  const { json, md } = buildQaReport({
    testRunId,
    report,
    authMode: ctx.mode,
    actor: ctx.member.display_name,
    host,
    startedAt: run.created_at,
    completedAt: run.completed_at,
    phases: run.manual_phases,
  });
  return {
    json,
    md,
    filenameJson: `turner-family-qa-report-${testRunId}.json`,
    filenameMd: `turner-family-qa-report-${testRunId}.md`,
  };
}
