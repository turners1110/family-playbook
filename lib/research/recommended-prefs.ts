/**
 * Per-family Recommended Library preferences (hide / added).
 */
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResearchStorageMode, type ResearchStorageMode } from "@/lib/research/mode";
import {
  emptyRecommendedPrefs,
  type RecommendedFamilyPrefs,
} from "@/lib/research/recommended";

const LOCAL_PREFS_PATH = path.join(
  process.cwd(),
  "data",
  "research-recommended-prefs.json",
);

type PrefsFile = Record<string, RecommendedFamilyPrefs>;

const memoryPrefs = new Map<string, RecommendedFamilyPrefs>();
let modeOverride: ResearchStorageMode | null = null;

export function setRecommendedPrefsModeForTests(mode: ResearchStorageMode | null) {
  modeOverride = mode;
}

export function clearRecommendedPrefsForTests() {
  memoryPrefs.clear();
  modeOverride = null;
}

function resolveMode(): ResearchStorageMode {
  return modeOverride ?? getResearchStorageMode();
}

export function setMemoryRecommendedPrefsForTests(
  familyId: string,
  prefs: RecommendedFamilyPrefs,
) {
  memoryPrefs.set(familyId, structuredClone(prefs));
}

async function readLocalPrefsFile(): Promise<PrefsFile> {
  try {
    const raw = await fs.readFile(LOCAL_PREFS_PATH, "utf8");
    return JSON.parse(raw) as PrefsFile;
  } catch {
    return {};
  }
}

async function writeLocalPrefsFile(data: PrefsFile) {
  await fs.mkdir(path.dirname(LOCAL_PREFS_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PREFS_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function loadRecommendedPrefs(
  familyId: string,
): Promise<RecommendedFamilyPrefs> {
  if (memoryPrefs.has(familyId)) {
    return structuredClone(memoryPrefs.get(familyId)!);
  }

  const mode = resolveMode();
  if (mode === "local") {
    const file = await readLocalPrefsFile();
    return structuredClone(file[familyId] ?? emptyRecommendedPrefs());
  }

  if (mode === "supabase") {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("research_recommended_family_state")
        .select("recommended_slug,hidden_at,added_source_id")
        .eq("family_id", familyId);
      if (error) throw error;
      const prefs = emptyRecommendedPrefs();
      for (const row of data ?? []) {
        const slug = row.recommended_slug as string;
        if (row.hidden_at) prefs.hidden.push(slug);
        if (row.added_source_id) {
          prefs.added[slug] = row.added_source_id as string;
        }
      }
      return prefs;
    } catch {
      return emptyRecommendedPrefs();
    }
  }

  return emptyRecommendedPrefs();
}

async function saveLocalPrefs(familyId: string, prefs: RecommendedFamilyPrefs) {
  memoryPrefs.set(familyId, structuredClone(prefs));
  const file = await readLocalPrefsFile();
  file[familyId] = prefs;
  await writeLocalPrefsFile(file);
}

export async function hideRecommendedSource(familyId: string, slug: string) {
  const mode = resolveMode();
  if (mode === "supabase") {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("research_recommended_family_state").upsert(
      {
        family_id: familyId,
        recommended_slug: slug,
        hidden_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_id,recommended_slug" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const prefs = await loadRecommendedPrefs(familyId);
  if (!prefs.hidden.includes(slug)) prefs.hidden.push(slug);
  await saveLocalPrefs(familyId, prefs);
}

export async function markRecommendedAdded(
  familyId: string,
  slug: string,
  sourceId: string,
) {
  const mode = resolveMode();
  if (mode === "supabase") {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("research_recommended_family_state").upsert(
      {
        family_id: familyId,
        recommended_slug: slug,
        added_source_id: sourceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_id,recommended_slug" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const prefs = await loadRecommendedPrefs(familyId);
  prefs.added[slug] = sourceId;
  await saveLocalPrefs(familyId, prefs);
}
