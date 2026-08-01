import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { BackupDownloadButton } from "@/components/settings/BackupDownloadButton";
import { readStore, getStorageMode, usesRemoteJsonStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireFamilyContext();
  const store = await readStore();
  const storageMode = getStorageMode();

  return (
    <AppShell
      title="Settings"
      subtitle="Family preferences, privacy controls, and export."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/storage-health" className="btn btn-ghost">
            Storage health
          </Link>
          <Link href="/settings/export" className="btn btn-secondary">
            Import / Export
          </Link>
        </div>
      }
    >
      {auth.mode === "emergency" && (
        <section className="surface mb-5 border-accent/30 bg-accent-soft/40 p-4 text-sm text-accent-strong">
          Trip Mode uses temporary remote JSON storage. Download a backup after each
          discussion.
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">
            {auth.mode === "emergency" ? "Trip session" : "Signed in"}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {auth.profile.display_name}
            {auth.mode === "supabase" ? ` · ${auth.profile.email}` : " · temporary actor"}
          </p>
          <h3 className="mt-4 font-semibold">Family</h3>
          <p className="mt-1 text-sm text-ink-muted">{auth.family.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Member role: {auth.member.role} · {auth.member.display_name}
          </p>
          <p className="mt-4 text-xs text-ink-subtle">
            Storage mode: {storageMode === "remote" ? "Remote JSON" : "Local JSON"}
            {usesRemoteJsonStore() ? " (online backup)" : ""}.
          </p>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Preferences</h2>
          <SettingsForm settings={store.settings} />
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl text-ink">Backup</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Download the full active family store as JSON. Keep a copy after important
          discussions.
        </p>
        <div className="mt-4">
          <BackupDownloadButton />
        </div>
      </section>

      <section className="surface mt-5 p-5 text-sm text-ink-muted">
        <h2 className="font-display text-xl text-ink">Authentication</h2>
        <p className="mt-2">
          Magic-link email login remains available at <Link href="/login">/login</Link> for
          testing. Trip Mode uses a shared access code at <Link href="/access">/access</Link>{" "}
          when enabled.
        </p>
      </section>
    </AppShell>
  );
}
