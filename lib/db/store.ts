/**
 * Application store facade.
 * One backend per process: remote JSONB when USE_REMOTE_JSON_STORE=true, else local file.
 */
import type { AppStore } from "@/lib/types/models";
import * as local from "@/lib/db/local-json-store";
import * as remote from "@/lib/db/remote-json-store";

export function usesRemoteJsonStore() {
  return process.env.USE_REMOTE_JSON_STORE === "true";
}

export function getStorageMode(): "remote" | "local" {
  return usesRemoteJsonStore() ? "remote" : "local";
}

export async function readStore(): Promise<AppStore> {
  return usesRemoteJsonStore() ? remote.readStore() : local.readStore();
}

export async function writeStore(store: AppStore): Promise<void> {
  return usesRemoteJsonStore() ? remote.writeStore(store) : local.writeStore(store);
}

export async function updateStore(
  updater: (store: AppStore) => AppStore | void,
): Promise<AppStore> {
  return usesRemoteJsonStore()
    ? remote.updateStore(updater)
    : local.updateStore(updater);
}

export function clearMemoryStore() {
  local.clearMemoryStore();
  remote.clearMemoryStore();
}

export {
  ensureDataDir,
  getStorePath,
  nowIso,
  id,
} from "@/lib/db/local-json-store";

export { getRemoteStoreHealth } from "@/lib/db/remote-json-store";
