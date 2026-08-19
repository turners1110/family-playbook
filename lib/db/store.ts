/**
 * Application store facade.
 * One backend per process: remote JSONB when USE_REMOTE_JSON_STORE=true, else local file.
 *
 * Deployed Vercel runtimes must not silently fall back to the local filesystem.
 */
import type { AppStore } from "@/lib/types/models";
import * as local from "@/lib/db/local-json-store";
import * as remote from "@/lib/db/remote-json-store";
import type { UpdateStoreOptions } from "@/lib/db/optimistic-store-update";
import { RemoteStoreError } from "@/lib/db/store-errors";

export type { UpdateStoreOptions } from "@/lib/db/optimistic-store-update";

export function usesRemoteJsonStore(env: NodeJS.ProcessEnv = process.env) {
  return env.USE_REMOTE_JSON_STORE === "true";
}

export function isDeployedVercelRuntime(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL === "1";
}

/**
 * Deployed Vercel Preview/Production must use the remote JSON store.
 * Local development (including `pnpm start` off Vercel) may use the filesystem.
 */
export function assertDeployedRemoteStore(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (isDeployedVercelRuntime(env) && !usesRemoteJsonStore(env)) {
    throw new RemoteStoreError(
      "config",
      "Remote family storage is required on Vercel. Set USE_REMOTE_JSON_STORE=true. Local filesystem fallback is not allowed in Preview or Production.",
    );
  }
}

export function getStorageMode(): "remote" | "local" {
  return usesRemoteJsonStore() ? "remote" : "local";
}

export async function readStore(): Promise<AppStore> {
  assertDeployedRemoteStore();
  return usesRemoteJsonStore() ? remote.readStore() : local.readStore();
}

export async function writeStore(store: AppStore): Promise<void> {
  assertDeployedRemoteStore();
  return usesRemoteJsonStore() ? remote.writeStore(store) : local.writeStore(store);
}

export async function updateStore(
  updater: (store: AppStore) => AppStore | void,
  options?: UpdateStoreOptions,
): Promise<AppStore> {
  assertDeployedRemoteStore();
  return usesRemoteJsonStore()
    ? remote.updateStore(updater, options)
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
