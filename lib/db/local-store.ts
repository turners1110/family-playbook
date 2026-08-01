/** Backward-compatible re-export — prefer `@/lib/db/store`. */
export {
  readStore,
  writeStore,
  updateStore,
  clearMemoryStore,
  ensureDataDir,
  getStorePath,
  nowIso,
  id,
  usesRemoteJsonStore,
  getStorageMode,
  getRemoteStoreHealth,
} from "@/lib/db/store";
export type { UpdateStoreOptions } from "@/lib/db/store";
