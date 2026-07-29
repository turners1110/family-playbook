import { promises as fs } from "fs";
import path from "path";
import type { AppStore } from "@/lib/types/models";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "local-store.json");

let memoryStore: AppStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function getStorePath() {
  return STORE_PATH;
}

export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "seed"), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "exports"), { recursive: true });
}

export async function readStore(): Promise<AppStore> {
  if (memoryStore) return structuredClone(memoryStore);
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    memoryStore = JSON.parse(raw) as AppStore;
    return structuredClone(memoryStore);
  } catch {
    throw new Error(
      "Local store not found. Run `pnpm seed` to initialize Turner Family Principles data.",
    );
  }
}

export async function writeStore(store: AppStore): Promise<void> {
  memoryStore = structuredClone(store);
  writeQueue = writeQueue.then(async () => {
    await ensureDataDir();
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmp, STORE_PATH);
  });
  await writeQueue;
}

export async function updateStore(
  updater: (store: AppStore) => AppStore | void,
): Promise<AppStore> {
  const store = await readStore();
  const result = updater(store) ?? store;
  await writeStore(result);
  return structuredClone(result);
}

export function clearMemoryStore() {
  memoryStore = null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
