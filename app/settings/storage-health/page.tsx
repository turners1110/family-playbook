import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import {
  getRemoteStoreHealth,
  getStorageMode,
  usesRemoteJsonStore,
} from "@/lib/db/store";
import { BackupDownloadButton } from "@/components/settings/BackupDownloadButton";

export const dynamic = "force-dynamic";

export default async function StorageHealthPage() {
  await requireFamilyContext();
  const mode = getStorageMode();
  const health = usesRemoteJsonStore()
    ? await getRemoteStoreHealth()
    : {
        connected: false,
        familyName: "Turner Family",
        familyId: null,
        version: null,
        updatedAt: null,
        backupCount: 0,
        lastBackupAt: null,
      };

  return (
    <AppShell
      title="Storage health"
      subtitle="Confirm where family answers are saved."
      actions={
        <Link href="/settings" className="btn btn-secondary">
          Back to settings
        </Link>
      }
    >
      <section className="surface p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Storage mode</dt>
            <dd className="mt-1 text-ink">
              {mode === "remote" ? "Remote JSON" : "Local JSON"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              Remote store connected
            </dt>
            <dd className="mt-1 text-ink">
              {mode === "remote" ? (health.connected ? "yes" : "no") : "n/a"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Family name</dt>
            <dd className="mt-1 text-ink">{health.familyName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Current version</dt>
            <dd className="mt-1 text-ink">{health.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Last saved</dt>
            <dd className="mt-1 text-ink">
              {health.updatedAt ? new Date(health.updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Number of backups</dt>
            <dd className="mt-1 text-ink">{health.backupCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Last backup time</dt>
            <dd className="mt-1 text-ink">
              {health.lastBackupAt
                ? new Date(health.lastBackupAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Download backup</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Keep an offline copy after discussions. Never share backup files publicly.
        </p>
        <div className="mt-4">
          <BackupDownloadButton />
        </div>
      </section>
    </AppShell>
  );
}
