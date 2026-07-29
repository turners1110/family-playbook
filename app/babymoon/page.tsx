import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/shared/ui";
import { getDashboardStats } from "@/lib/services/stats";
import { readStore } from "@/lib/db/local-store";
import { SessionSetupForm } from "@/components/discuss/SessionSetupForm";

export const dynamic = "force-dynamic";

export default async function BabymoonPage() {
  const stats = await getDashboardStats();
  const store = await readStore();
  const answered = new Set(store.answers.map((a) => a.question_id));
  const essential = store.questions
    .filter((q) => q.required_before_birth || q.priority === "essential_before_birth")
    .filter((q) => !answered.has(q.id))
    .slice(0, 15);

  return (
    <AppShell
      title="Babymoon mode"
      subtitle="Cover high-value early questions during your trip — without rushing the conversation."
    >
      <section className="surface mb-5 p-6">
        <ProgressBar
          value={stats.babymoonPct}
          label={`Babymoon completion · target ${stats.babymoonTargetDate ?? "unset"}`}
        />
        <p className="mt-3 text-sm text-ink-muted">
          Recommended daily pace: {store.settings.babymoon_daily_questions} questions. Progress
          saves automatically and resumes on any device when connected.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/discuss?babymoon=1&preset=fifteen_minutes" className="btn btn-primary">
            15-minute session
          </Link>
          <Link href="/discuss?babymoon=1&preset=practical" className="btn btn-secondary">
            Something practical
          </Link>
          <Link href="/discuss?babymoon=1&preset=philosophical" className="btn btn-secondary">
            Something philosophical
          </Link>
          <Link href="/discuss?babymoon=1&preset=not_considered" className="btn btn-secondary">
            Something new
          </Link>
          <Link href="/discuss?babymoon=1" className="btn btn-secondary">
            Deeper topic
          </Link>
        </div>
      </section>

      <section className="surface mb-5 p-5">
        <h2 className="font-display text-xl">Essential before birth</h2>
        <ul className="mt-3 space-y-2">
          {essential.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
              <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                {q.short_title}
              </Link>
              <span className="text-ink-subtle">~{q.estimated_minutes}m</span>
            </li>
          ))}
        </ul>
      </section>

      <SessionSetupForm
        lifeStages={store.life_stages}
        categories={store.categories}
        outcomes={store.outcomes}
        babymoonDefault
      />
    </AppShell>
  );
}
