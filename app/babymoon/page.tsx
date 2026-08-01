import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/shared/ui";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { getDashboardStats } from "@/lib/services/stats";
import { readStore } from "@/lib/db/store";
import { SessionSetupForm } from "@/components/discuss/SessionSetupForm";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function BabymoonPage() {
  const stats = await getDashboardStats();
  const store = await readStore();
  const statusIndex = buildQuestionStatusIndex(store);
  const essential = store.questions
    .filter((q) => q.required_before_birth || q.priority === "essential_before_birth")
    .filter((q) => !statusIndex.get(q.id)?.fullyAnswered)
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
          <Link href="/questions/before-birth" className="btn btn-primary">
            Before Birth Essentials
          </Link>
          <Link href="/questions/before-birth/session?length=30&start=1" className="btn btn-secondary">
            Essentials · 30 min
          </Link>
          <Link href="/discuss?babymoon=1&preset=fifteen_minutes" className="btn btn-secondary">
            15-minute library session
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
              <span className="flex flex-wrap items-center gap-2">
                <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                  {q.short_title}
                </Link>
              </span>
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
