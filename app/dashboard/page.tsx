import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import { getDashboardStats } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <AppShell
      title="Dashboard"
      subtitle="Progress, attention items, and babymoon focus."
      actions={<Link href="/babymoon" className="btn btn-primary">Babymoon mode</Link>}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total questions" value={stats.totalQuestions} />
        <StatCard label="Answered" value={stats.questionsAnswered} />
        <StatCard label="Remaining" value={stats.questionsRemaining} />
        <StatCard label="Completion" value={`${stats.completion}%`} />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Decisions reached" value={stats.decisionsReached} />
        <StatCard label="Undecided" value={stats.undecided} />
        <StatCard label="Disagreements" value={stats.disagreements} />
        <StatCard label="Cooling-off" value={stats.coolingOff} />
        <StatCard label="Research needed" value={stats.researchNeeded} />
        <StatCard label="Review later" value={stats.reviewLater} />
        <StatCard label="Low confidence" value={stats.lowConfidence} />
        <StatCard label="High-priority unanswered" value={stats.highPriorityUnanswered} />
      </div>

      <section className="surface mb-5 p-5">
        <h2 className="font-display text-2xl">Babymoon completion target</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Target date: {stats.babymoonTargetDate ?? "Not set"} · Extra weight on pregnancy through
          early childhood, partnership, health, sleep, feeding, and values.
        </p>
        <div className="mt-4 max-w-xl">
          <ProgressBar
            value={stats.babymoonPct}
            label={`${stats.babymoonAnswered}/${stats.babymoonTotal} babymoon-weighted questions`}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Progress by life stage</h3>
          <div className="mt-4 space-y-3">
            {stats.byStage.filter((s) => s.total > 0).slice(0, 12).map((s) => (
              <ProgressBar key={s.slug} value={s.pct} label={`${s.label} (${s.answered}/${s.total})`} />
            ))}
          </div>
        </section>
        <section className="surface p-5">
          <h3 className="font-display text-xl">Progress by category</h3>
          <div className="mt-4 space-y-3">
            {stats.byCategory.sort((a,b)=>b.total-a.total).slice(0, 12).map((c) => (
              <ProgressBar key={c.slug} value={c.pct} label={`${c.label} (${c.answered}/${c.total})`} />
            ))}
          </div>
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Coverage gaps & recent activity</h3>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h4 className="font-semibold">Gaps</h4>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {stats.byCategory
                .filter((c) => c.total >= 5 && c.pct < 20)
                .slice(0, 8)
                .map((c) => (
                  <li key={c.slug}>{c.label}: {c.pct}%</li>
                ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Recent activity</h4>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {stats.recentActivity.map((a) => (
                <li key={a.id}>
                  {a.created_at.slice(0, 10)} · {a.event_type} · {a.entity_type}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
