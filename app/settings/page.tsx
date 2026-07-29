import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { getFamilyContext } from "@/lib/services/family";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getFamilyContext();

  return (
    <AppShell
      title="Settings"
      subtitle="Family preferences, privacy controls, and export."
      actions={<Link href="/settings/export" className="btn btn-secondary">Import / Export</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">Family</h2>
          <p className="mt-2 text-sm text-ink-muted">{ctx.family.name}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {ctx.members.map((m) => (
              <li key={m.id}>
                {m.display_name} · {m.role}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-subtle">
            First release is private to Sam and Michelle. Schema supports additional members later.
          </p>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Preferences</h2>
          <SettingsForm settings={ctx.settings} />
        </section>
      </div>
      <section className="surface mt-5 p-5 text-sm text-ink-muted">
        <h2 className="font-display text-xl text-ink">Authentication</h2>
        <p className="mt-2">
          Local demo mode uses an in-app family store. Production uses Supabase Auth with magic
          link email login, secure sessions, and row-level security. See{" "}
          <code>supabase/migrations/0001_init.sql</code> and the README.
        </p>
      </section>
    </AppShell>
  );
}
