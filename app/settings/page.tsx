import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { readStore } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireFamilyContext();
  const store = await readStore();

  return (
    <AppShell
      title="Settings"
      subtitle="Family preferences, privacy controls, and export."
      actions={<Link href="/settings/export" className="btn btn-secondary">Import / Export</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">Signed in</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {auth.profile.display_name} · {auth.profile.email}
          </p>
          <h3 className="mt-4 font-semibold">Family</h3>
          <p className="mt-1 text-sm text-ink-muted">{auth.family.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Member role: {auth.member.role} · {auth.member.display_name}
          </p>
          <p className="mt-4 text-xs text-ink-subtle">
            Identity comes from Supabase Auth. Product discussion data still uses the local
            store in Phase 1.
          </p>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Preferences</h2>
          <SettingsForm settings={store.settings} />
        </section>
      </div>
      <section className="surface mt-5 p-5 text-sm text-ink-muted">
        <h2 className="font-display text-xl text-ink">Authentication</h2>
        <p className="mt-2">
          Magic-link email login is enabled. Family membership is managed with{" "}
          <code>pnpm setup:family</code>. See the README for redirect URLs and environment
          variables.
        </p>
      </section>
    </AppShell>
  );
}
