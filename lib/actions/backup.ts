"use server";

import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import {
  assertValidAppStore,
  logStoreError,
  publicRemoteStoreMessage,
} from "@/lib/db/store-errors";

function backupFilename(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `turner-family-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export async function downloadStoreBackupAction(): Promise<
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string }
> {
  try {
    await requireFamilyContext();
    const store = await readStore();
    assertValidAppStore(store);
    return {
      ok: true,
      filename: backupFilename(),
      json: JSON.stringify(store, null, 2),
    };
  } catch (error) {
    logStoreError("backup_download", error);
    return { ok: false, error: publicRemoteStoreMessage(error) };
  }
}
