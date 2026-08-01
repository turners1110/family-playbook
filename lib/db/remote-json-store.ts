/**
 * Remote JSONB store bridge (Trip Online Mode).
 * Server-only — uses the Supabase service role. Never import from client components.
 */
import type { AppStore } from "@/lib/types/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertValidAppStore,
  logStoreError,
  RemoteStoreError,
} from "@/lib/db/store-errors";

const MAX_UPDATE_RETRIES = 3;
const FAMILY_NAME = () =>
  (process.env.TURNER_FAMILY_NAME?.trim() || "Turner Family");

type StoreRow = {
  family_id: string;
  store_data: unknown;
  version: number | string;
  updated_at: string;
};

function asVersion(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new RemoteStoreError("validation", "Invalid store version.");
  }
  return n;
}

async function resolveTurnerFamilyId(): Promise<string> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("families")
      .select("id,name")
      .eq("name", FAMILY_NAME())
      .maybeSingle();

    if (error) {
      logStoreError("resolve_family", error);
      throw new RemoteStoreError("unavailable", "Could not resolve family.");
    }
    if (!data?.id) {
      throw new RemoteStoreError(
        "not_found",
        "Turner Family record not found. Run pnpm setup:family first.",
      );
    }
    return data.id as string;
  } catch (error) {
    if (error instanceof RemoteStoreError) throw error;
    logStoreError("resolve_family", error);
    throw new RemoteStoreError("config", "Remote store admin client is not configured.");
  }
}

async function readRow(familyId: string): Promise<StoreRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("family_json_stores")
    .select("family_id,store_data,version,updated_at")
    .eq("family_id", familyId)
    .maybeSingle();

  if (error) {
    logStoreError("read_row", error);
    throw new RemoteStoreError("unavailable", "Could not read remote store.");
  }
  if (!data) {
    throw new RemoteStoreError(
      "not_found",
      "Remote store row missing. Run pnpm upload:remote-store.",
    );
  }
  return data as StoreRow;
}

export async function readStore(): Promise<AppStore> {
  const familyId = await resolveTurnerFamilyId();
  const row = await readRow(familyId);
  try {
    assertValidAppStore(row.store_data);
  } catch (error) {
    logStoreError("validate_read", error);
    throw new RemoteStoreError("validation", "Remote store failed validation.");
  }
  return structuredClone(row.store_data);
}

export async function writeStore(store: AppStore): Promise<void> {
  assertValidAppStore(store);
  const familyId = await resolveTurnerFamilyId();
  const admin = createSupabaseAdminClient();

  const existing = await admin
    .from("family_json_stores")
    .select("version")
    .eq("family_id", familyId)
    .maybeSingle();

  if (existing.error) {
    logStoreError("write_read", existing.error);
    throw new RemoteStoreError("unavailable", "Could not write remote store.");
  }

  if (!existing.data) {
    const { error: insertError } = await admin.from("family_json_stores").insert({
      family_id: familyId,
      store_data: store,
      version: 1,
    });
    if (insertError) {
      logStoreError("write_insert", insertError);
      throw new RemoteStoreError("unavailable", "Could not create remote store.");
    }
    const { error: histError } = await admin.from("family_json_store_versions").insert({
      family_id: familyId,
      version: 1,
      store_data: store,
      created_by: "writeStore",
    });
    if (histError) {
      logStoreError("write_history", histError);
    }
    return;
  }

  const expected = asVersion(existing.data.version as number | string);
  await replaceWithRetry(familyId, expected, store, "writeStore");
}

export async function updateStore(
  updater: (store: AppStore) => AppStore | void,
): Promise<AppStore> {
  const familyId = await resolveTurnerFamilyId();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPDATE_RETRIES; attempt += 1) {
    try {
      const row = await readRow(familyId);
      assertValidAppStore(row.store_data);
      const draft = structuredClone(row.store_data);
      const result = updater(draft) ?? draft;
      assertValidAppStore(result);
      await replaceWithRetry(
        familyId,
        asVersion(row.version),
        result,
        "updateStore",
        1,
      );
      return structuredClone(result);
    } catch (error) {
      lastError = error;
      if (
        error instanceof RemoteStoreError &&
        error.code === "version_conflict" &&
        attempt < MAX_UPDATE_RETRIES
      ) {
        continue;
      }
      break;
    }
  }

  if (lastError instanceof RemoteStoreError) throw lastError;
  logStoreError("updateStore", lastError);
  throw new RemoteStoreError(
    "version_conflict",
    "Could not save after repeated version conflicts.",
  );
}

async function replaceWithRetry(
  familyId: string,
  expectedVersion: number,
  store: AppStore,
  createdBy: string,
  attempts: number = MAX_UPDATE_RETRIES,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  let expected = expectedVersion;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await admin.rpc("replace_family_json_store", {
      p_family_id: familyId,
      p_expected_version: expected,
      p_new_data: store,
      p_created_by: createdBy,
    });

    if (!error) {
      return asVersion(data as number | string);
    }

    const message = error.message ?? "";
    if (message.includes("family_json_store_version_conflict")) {
      lastError = new RemoteStoreError(
        "version_conflict",
        "Remote store version conflict.",
      );
      if (attempt < attempts) {
        const row = await readRow(familyId);
        expected = asVersion(row.version);
        continue;
      }
      throw lastError;
    }

    logStoreError("replace_rpc", error);
    throw new RemoteStoreError("unavailable", "Could not update remote store.");
  }

  throw (
    lastError ??
    new RemoteStoreError("version_conflict", "Could not update remote store.")
  );
}

export type RemoteStoreHealth = {
  connected: boolean;
  familyName: string;
  familyId: string | null;
  version: number | null;
  updatedAt: string | null;
  backupCount: number;
  lastBackupAt: string | null;
};

export async function getRemoteStoreHealth(): Promise<RemoteStoreHealth> {
  const familyName = FAMILY_NAME();
  try {
    const familyId = await resolveTurnerFamilyId();
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("family_json_stores")
      .select("version,updated_at")
      .eq("family_id", familyId)
      .maybeSingle();

    if (error) {
      logStoreError("health_row", error);
      return {
        connected: false,
        familyName,
        familyId,
        version: null,
        updatedAt: null,
        backupCount: 0,
        lastBackupAt: null,
      };
    }

    const { data: versions, error: versionsError } = await admin
      .from("family_json_store_versions")
      .select("created_at")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (versionsError) {
      logStoreError("health_versions", versionsError);
    }

    const list = versions ?? [];
    return {
      connected: Boolean(row),
      familyName,
      familyId,
      version: row ? asVersion(row.version as number | string) : null,
      updatedAt: (row?.updated_at as string | undefined) ?? null,
      backupCount: list.length,
      lastBackupAt: (list[0]?.created_at as string | undefined) ?? null,
    };
  } catch (error) {
    logStoreError("health", error);
    return {
      connected: false,
      familyName,
      familyId: null,
      version: null,
      updatedAt: null,
      backupCount: 0,
      lastBackupAt: null,
    };
  }
}

export function clearMemoryStore() {
  // Remote adapter does not keep a process-wide mutable cache.
}

export { nowIso, id } from "@/lib/db/local-json-store";
