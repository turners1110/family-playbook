"use server";

import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import {
  assertValidAppStore,
  logStoreError,
  publicRemoteStoreMessage,
} from "@/lib/db/store-errors";
import {
  buildContentReviewMarkdown,
  buildContentReviewPackage,
  normalizeContentReviewOptions,
  type ContentReviewOptions,
} from "@/lib/content-review";

export async function actionGenerateContentReviewPackage(
  partialOptions?: Partial<ContentReviewOptions>,
): Promise<
  | {
      ok: true;
      jsonFilename: string;
      markdownFilename: string;
      json: string;
      markdown: string;
      questionCount: number;
      taskCount: number;
    }
  | { ok: false; error: string }
> {
  try {
    await requireFamilyContext();
    const store = await readStore();
    assertValidAppStore(store);
    const options = normalizeContentReviewOptions(partialOptions);
    const pkg = buildContentReviewPackage({
      store,
      options,
      now: new Date(),
    });
    const markdown = buildContentReviewMarkdown(pkg);
    // Deterministic stringify (stable key order via JSON.stringify insertion order)
    const json = `${JSON.stringify(pkg, null, 2)}\n`;
    return {
      ok: true,
      jsonFilename: "turner-family-content-review.json",
      markdownFilename: "turner-family-content-review.md",
      json,
      markdown,
      questionCount: pkg.question_bank?.questions.length ?? 0,
      taskCount: pkg.before_baby?.tasks.length ?? 0,
    };
  } catch (error) {
    logStoreError("content_review_export", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}
