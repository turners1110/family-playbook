/**
 * Local private research library (Phase 1 fallback / tests).
 * Metadata in JSON; files under data/research-files/ — never in remote JSON store.
 */
import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import type {
  ResearchLibraryStore,
  ResearchSource,
  ResearchSourceCard,
  ResearchSourceFile,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
} from "@/lib/research/types";

const META_PATH = path.join(process.cwd(), "data", "research-library.json");
const FILES_DIR = path.join(process.cwd(), "data", "research-files");

function emptyStore(): ResearchLibraryStore {
  return {
    sources: [],
    files: [],
    summaries: [],
    notes: [],
    links: [],
  };
}

async function ensureDirs() {
  await fs.mkdir(path.dirname(META_PATH), { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
}

export async function readResearchLibrary(): Promise<ResearchLibraryStore> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    const parsed = JSON.parse(raw) as ResearchLibraryStore;
    return {
      sources: parsed.sources ?? [],
      files: parsed.files ?? [],
      summaries: parsed.summaries ?? [],
      notes: parsed.notes ?? [],
      links: parsed.links ?? [],
    };
  } catch {
    return emptyStore();
  }
}

async function writeResearchLibrary(store: ResearchLibraryStore) {
  await ensureDirs();
  const tmp = `${META_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, META_PATH);
}

export async function updateResearchLibrary(
  updater: (store: ResearchLibraryStore) => void | ResearchLibraryStore,
): Promise<ResearchLibraryStore> {
  const store = await readResearchLibrary();
  const next = updater(store) ?? store;
  await writeResearchLibrary(next);
  return next;
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function saveLocalResearchFile(input: {
  familyId: string;
  sourceId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<ResearchSourceFile> {
  const hash = hashBuffer(input.buffer);
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = path.join(input.familyId, input.sourceId, `${hash}_${safeName}`);
  const absolute = path.join(FILES_DIR, storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);

  return {
    id: newId("rsf"),
    source_id: input.sourceId,
    storage_path: storagePath,
    original_filename: input.filename,
    mime_type: input.mimeType,
    file_size: input.buffer.length,
    file_hash: hash,
    page_count: null,
    extraction_status: "not_started",
    created_at: nowIso(),
  };
}

export async function readLocalResearchFile(
  storagePath: string,
): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(FILES_DIR, storagePath));
  } catch {
    return null;
  }
}

export function toSourceCards(store: ResearchLibraryStore): ResearchSourceCard[] {
  return store.sources
    .filter((s) => !s.archived_at)
    .map((source) => enrichSource(source, store))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function enrichSource(
  source: ResearchSource,
  store: ResearchLibraryStore,
): ResearchSourceCard {
  const links = store.links.filter((l) => l.source_id === source.id);
  return {
    ...source,
    finding_count: 0,
    linked_question_count: links.filter((l) => l.question_id).length,
    linked_principle_count: links.filter((l) => l.principle_id).length,
    has_summary: store.summaries.some((s) => s.source_id === source.id),
    file_count: store.files.filter((f) => f.source_id === source.id).length,
  };
}

export function clearResearchLibraryForTests() {
  return writeResearchLibrary(emptyStore());
}

export type {
  ResearchSource,
  ResearchSourceCard,
  ResearchSourceFile,
  ResearchSourceLink,
  ResearchSourceNote,
  ResearchSourceSummary,
};
