"use server";

import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore, updateStore } from "@/lib/db/store";
import {
  applyContentUpgradeChanges,
  buildContentUpgradePreview,
  type ContentUpgradePreview,
} from "@/lib/content/upgrade";
import {
  logStoreError,
  publicRemoteStoreMessage,
} from "@/lib/db/store-errors";

export async function actionPreviewContentUpgrade(): Promise<
  | { ok: true; preview: ContentUpgradePreview }
  | { ok: false; error: string }
> {
  try {
    await requireFamilyContext();
    const store = await readStore();
    return { ok: true, preview: buildContentUpgradePreview(store) };
  } catch (error) {
    logStoreError("content_upgrade_preview", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}

export async function actionApplyContentUpgrade(
  changeIds: string[],
): Promise<
  | { ok: true; applied: number; skipped: number }
  | { ok: false; error: string }
> {
  try {
    await requireFamilyContext();
    let applied = 0;
    let skipped = 0;
    await updateStore((store) => {
      const result = applyContentUpgradeChanges(store, changeIds);
      applied = result.applied;
      skipped = result.skipped;
      store.questions = result.store.questions;
      store.checklist_tasks = result.store.checklist_tasks;
    });
    return { ok: true, applied, skipped };
  } catch (error) {
    logStoreError("content_upgrade_apply", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}
