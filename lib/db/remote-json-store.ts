/**
 * Remote JSONB store bridge (Trip Online Mode).
 * Server-only — uses the Supabase service role. Never import from client components.
 */
import type { AppStore } from "@/lib/types/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getTurnerFamilyNameDiagnostics,
  resolveTurnerFamilyName,
} from "@/lib/db/family-name";
import {
  assertValidAppStore,
  logStoreError,
  RemoteStoreError,
} from "@/lib/db/store-errors";
import {
  asStoreVersion,
  runOptimisticStoreUpdate,
  type UpdateStoreOptions,
} from "@/lib/db/optimistic-store-update";
import { id } from "@/lib/db/local-json-store";

export { MAX_UPDATE_RETRIES } from "@/lib/db/optimistic-store-update";
export type { UpdateStoreOptions } from "@/lib/db/optimistic-store-update";

type StoreRow = {
  family_id: string;
  store_data: unknown;
  version: number | string;
  updated_at: string;
};

/**
 * Exact-name lookup of the Turner Family row.
 * Exported for unit tests with an injected admin client.
 */
export async function resolveTurnerFamilyId(
  adminClient?: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string> {
  const diagnostics = getTurnerFamilyNameDiagnostics();
  const familyName = resolveTurnerFamilyName();

  let admin;
  try {
    admin = adminClient ?? createSupabaseAdminClient();
  } catch (error) {
    logStoreError("resolve_family", error, diagnostics);
    throw new RemoteStoreError(
      "config",
      "Remote store admin client is not configured.",
    );
  }

  const { data, error } = await admin
    .from("families")
    .select("id,name")
    .eq("name", familyName)
    .limit(1);

  if (error) {
    logStoreError("resolve_family", error, diagnostics);
    throw new RemoteStoreError("unavailable", "Could not resolve family.");
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (!row?.id) {
    let familyRowCount: number | null = null;
    try {
      const { count, error: countError } = await admin
        .from("families")
        .select("id", { count: "exact", head: true });
      if (countError) {
        logStoreError("family_count", countError, diagnostics);
      } else {
        familyRowCount = count ?? 0;
      }
    } catch (countError) {
      logStoreError("family_count", countError, diagnostics);
    }

    logStoreError(
      "family_not_found",
      new RemoteStoreError(
        "setup",
        `No family row matched name "${familyName}". Run pnpm setup:family.`,
      ),
      {
        ...diagnostics,
        familyRowCount,
      },
    );

    throw new RemoteStoreError(
      "setup",
      "Family storage is not set up yet. Run pnpm setup:family, then pnpm upload:remote-store.",
    );
  }

  return row.id as string;
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

async function replaceOnce(args: {
  familyId: string;
  expectedVersion: number;
  store: AppStore;
  createdBy: string;
  mutationId: string;
}): Promise<{ version: number; idempotentReplay?: boolean }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("replace_family_json_store", {
    p_family_id: args.familyId,
    p_expected_version: args.expectedVersion,
    p_new_data: args.store,
    p_created_by: args.createdBy,
    p_mutation_id: args.mutationId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("family_json_store_version_conflict")) {
      throw new RemoteStoreError(
        "version_conflict",
        "Remote store version conflict.",
      );
    }
    logStoreError("replace_rpc", error, {
      mutationId: args.mutationId,
      operation: args.createdBy,
      expectedVersion: args.expectedVersion,
    });
    throw new RemoteStoreError("unavailable", "Could not update remote store.");
  }

  const payload =
    data && typeof data === "object"
      ? (data as { version?: number | string; idempotent_replay?: boolean })
      : null;
  if (!payload || payload.version == null) {
    logStoreError("replace_rpc_payload", new Error("Invalid RPC payload"), {
      mutationId: args.mutationId,
      operation: args.createdBy,
    });
    throw new RemoteStoreError("unavailable", "Could not update remote store.");
  }

  return {
    version: asStoreVersion(payload.version),
    idempotentReplay: Boolean(payload.idempotent_replay),
  };
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

  // Full replace: reread + rewrite on conflict so we never stamp an old expected
  // version onto a stale payload while skipping concurrent product mutations.
  // writeStore is intentionally a full overwrite of the document.
  const mutationId = id("mut");
  await runOptimisticStoreUpdate(
    familyId,
    () => store,
    { operation: "writeStore", mutationId },
    {
      readRow,
      replace: replaceOnce,
    },
  );
}

export async function updateStore(
  updater: (store: AppStore) => AppStore | void,
  options?: UpdateStoreOptions,
): Promise<AppStore> {
  const familyId = await resolveTurnerFamilyId();
  const mutationId = options?.mutationId ?? id("mut");
  return runOptimisticStoreUpdate(
    familyId,
    updater,
    {
      operation: options?.operation ?? "updateStore",
      mutationId,
    },
    {
      readRow,
      replace: replaceOnce,
    },
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
  const familyName = resolveTurnerFamilyName();
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
      version: row ? asStoreVersion(row.version as number | string) : null,
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
