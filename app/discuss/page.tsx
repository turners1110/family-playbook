import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SessionSetupForm } from "@/components/discuss/SessionSetupForm";
import { readStore } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default async function DiscussSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; babymoon?: string }>;
}) {
  const params = await searchParams;
  const store = await readStore();
  const unfinished = store.sessions.filter(
    (s) => s.status === "active" || s.status === "paused",
  );

  return (
    <AppShell
      title="Discuss"
      subtitle="Start a thoughtful session. Choose a path, topic, or length that fits the moment."
    >
      {unfinished.length > 0 && (
        <section className="surface mb-5 p-5">
          <h2 className="font-display text-xl">Resume unfinished session</h2>
          <ul className="mt-3 space-y-2">
            {unfinished.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-sm text-ink-muted">
                    {s.status} · question {s.current_index + 1}
                  </div>
                </div>
                <Link href={`/discuss/${s.id}`} className="btn btn-secondary">
                  Resume
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/discuss?preset=fifteen_minutes" className="btn btn-secondary">
          We only have 15 minutes
        </Link>
        <Link href="/discuss?preset=philosophical" className="btn btn-secondary">
          Something philosophical
        </Link>
        <Link href="/discuss?preset=practical" className="btn btn-secondary">
          Something practical
        </Link>
        <Link href="/discuss?preset=not_considered" className="btn btn-secondary">
          Something we have not considered
        </Link>
        <Link href="/babymoon" className="btn btn-secondary">
          Babymoon recommended path
        </Link>
      </div>

      <SessionSetupForm
        lifeStages={store.life_stages}
        categories={store.categories}
        outcomes={store.outcomes}
        babymoonDefault={params.babymoon === "1"}
        preset={params.preset}
      />
    </AppShell>
  );
}
