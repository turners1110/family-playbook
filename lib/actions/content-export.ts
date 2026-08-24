"use server";

import { requireFamilyContext } from "@/lib/auth/family-context";
import { logStoreError, publicRemoteStoreMessage } from "@/lib/db/store-errors";
import { buildContentExports } from "@/lib/services/content-export";

type ExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string };

function stamp(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function exportQuestionsAction(
  format: "markdown" | "json",
): Promise<ExportResult> {
  try {
    await requireFamilyContext();
    const { questionsMarkdown, questionsJson } = await buildContentExports();
    return format === "markdown"
      ? {
          ok: true,
          filename: `questions-${stamp()}.md`,
          content: questionsMarkdown,
        }
      : {
          ok: true,
          filename: `questions-${stamp()}.json`,
          content: questionsJson,
        };
  } catch (error) {
    logStoreError("export_questions", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}

export async function exportBeforeBabyChecklistAction(
  format: "markdown" | "json",
): Promise<ExportResult> {
  try {
    await requireFamilyContext();
    const { beforeBabyMarkdown, beforeBabyJson } = await buildContentExports();
    return format === "markdown"
      ? {
          ok: true,
          filename: `before-baby-checklist-${stamp()}.md`,
          content: beforeBabyMarkdown,
        }
      : {
          ok: true,
          filename: `before-baby-checklist-${stamp()}.json`,
          content: beforeBabyJson,
        };
  } catch (error) {
    logStoreError("export_before_baby_checklist", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}
