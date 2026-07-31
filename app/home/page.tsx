import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import { getDashboardStats } from "@/lib/services/stats";
import { readStore } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await readStore();
  const stats = await getDashboardStats();

  return (
    <AppShell
      title="Home"
      subtitle="Where you are, what needs attention, and what to discuss next."
      actions={
        <>
          <Link href="/discuss" className="btn btn-primary">
            Start a Discussion
          </Link>
          {stats.lastSession && stats.lastSession.status !== "completed" && (
            <Link href={`/discuss/${stats.lastSession.id}`} className="btn btn-secondary">
              Continue last session
            </Link>
          )}
        </>
      }
    >
      <section className="surface mb-6 overflow-hidden p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          Turner Family Principles
        </p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl text-ink sm:text-4xl">
          Prepare for parenthood through calm, structured conversation.
        </h2>
        <p className="mt-3 max-w-xl text-ink-muted">
          Work through major parenting questions together. Record shared decisions,
          preserve disagreement, and build your playbook over time.
        </p>
        <div className="mt-6 max-w-md">
          <ProgressBar value={stats.babymoonPct} label="Babymoon-weighted progress" />
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall completion" value={`${stats.completion}%`} />
        <StatCard
          label="Questions answered"
          value={stats.questionsAnswered}
          hint={`${stats.questionsRemaining} remaining`}
        />
        <StatCard label="Decisions reached" value={stats.decisionsReached} />
        <StatCard label="Active disagreements" value={stats.disagreements} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Undecided items" value={stats.undecided} />
        <StatCard label="Cooling-off" value={stats.coolingOff} />
        <StatCard label="Research needed" value={stats.researchNeeded} />
        <StatCard label="Low confidence" value={stats.lowConfidence} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Recommended next session</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Focus on essential-before-birth and early-years topics you have not covered yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {stats.essentialRemaining.slice(0, 5).map((q) => (
              <li key={q.id} className="rounded-xl border border-border px-3 py-2">
                <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                  {q.short_title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/babymoon" className="btn btn-primary mt-4">
            Open babymoon path
          </Link>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-xl">Needs attention</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span>Review items</span>
              <span className="font-semibold">{stats.reviewLater}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span>High-priority unanswered</span>
              <span className="font-semibold">{stats.highPriorityUnanswered}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span>Cooling-off active</span>
              <span className="font-semibold">{stats.coolingOff}</span>
            </div>
          </div>
          <h4 className="mt-5 font-semibold">Upcoming reviews</h4>
          <ul className="mt-2 space-y-2 text-sm text-ink-muted">
            {stats.upcomingReviews.length === 0 && <li>None scheduled.</li>}
            {stats.upcomingReviews.map((r) => (
              <li key={r.id}>
                {r.entity_type} · {r.review_date}
                {r.reason ? ` — ${r.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-xl">Recent decisions</h3>
          <ul className="mt-4 space-y-3">
            {stats.recentDecisions.length === 0 && (
              <li className="text-sm text-ink-muted">No decisions yet.</li>
            )}
            {stats.recentDecisions.map((d) => (
              <li key={d.id}>
                <Link href={`/decisions/${d.id}`} className="font-medium hover:text-accent">
                  {d.title}
                </Link>
                <p className="text-sm text-ink-muted line-clamp-2">{d.statement}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-xl">Progress by life stage</h3>
          <div className="mt-4 space-y-3">
            {stats.byStage
              .filter((s) => s.total > 0 && s.slug !== "all_stages")
              .slice(0, 8)
              .map((s) => (
                <ProgressBar key={s.slug} value={s.pct} label={`${s.label} (${s.answered}/${s.total})`} />
              ))}
          </div>
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Progress by topic</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.byCategory
            .sort((a, b) => b.total - a.total)
            .slice(0, 9)
            .map((c) => (
              <ProgressBar
                key={c.slug}
                value={c.pct}
                label={`${c.label} (${c.answered}/${c.total})`}
              />
            ))}
        </div>
      </section>

      <section className="surface mt-5 p-5">
        <h3 className="font-display text-xl">Progress by desired outcome</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.byOutcome
            .filter((o) => o.total > 0)
            .sort((a, b) => b.coverage - a.coverage)
            .slice(0, 9)
            .map((o) => (
              <ProgressBar
                key={o.slug}
                value={o.coverage}
                label={`${o.label}`}
              />
            ))}
        </div>
        <p className="mt-3 text-xs text-ink-subtle">
          Family: {store.family.name} · Demo mode {store.demo_mode ? "on" : "off"}
        </p>
      </section>
    </AppShell>
  );
}
