import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { getDashboardStats } from "@/lib/services/stats";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await readStore();
  const stats = await getDashboardStats();
  const statusIndex = buildQuestionStatusIndex(store);

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
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/before-baby" className="btn btn-secondary">
            Before Baby checklist
          </Link>
        </div>
        <div className="mt-6 max-w-md">
          <ProgressBar value={stats.babymoonPct} label="Babymoon-weighted progress" />
        </div>
      </section>

      <section className="surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">Your progress</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Deep discussions, conversation prompts, and Essentials are counted
          separately — Quick Picks do not automatically complete a library
          question.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Deep discussions answered"
            value={stats.progress.canonicalQuestionsAnswered}
            hint={`${stats.progress.canonicalQuestionsPartial} partial · ${stats.progress.canonicalQuestionsTotal} total`}
          />
          <StatCard
            label="Conversation prompts completed"
            value={stats.progress.conversationPromptsCompleted}
            hint={`${stats.progress.conversationQuickAnswers} quick answers saved`}
          />
          <StatCard
            label="Essentials screens"
            value={`${stats.progress.essentialsScreensCompleted} of ${stats.progress.essentialsScreensVisible}`}
            hint="Before Birth Essentials"
          />
          <StatCard
            label="Shared decisions"
            value={stats.progress.sharedDecisions}
          />
          <StatCard
            label="Open follow-ups"
            value={stats.progress.openFollowUps}
            hint="Partial, undecided, research, cooling-off"
          />
          <StatCard
            label="Overall completion"
            value={`${stats.completion}%`}
            hint="Based on deep discussions only"
          />
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Decisions reached" value={stats.decisionsReached} />
        <StatCard label="Active disagreements" value={stats.disagreements} />
        <StatCard label="Undecided items" value={stats.undecided} />
        <StatCard label="Cooling-off" value={stats.coolingOff} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Research needed" value={stats.researchNeeded} />
        <StatCard label="Low confidence" value={stats.lowConfidence} />
        <StatCard
          label="Legacy unique answer IDs"
          value={stats.progress.legacyUniqueAnsweredQuestionIds}
          hint="Old “questions answered” definition"
        />
        <StatCard
          label="Active session cards"
          value={
            stats.progress.activeSessionId
              ? `${stats.progress.activeSessionAnswered}/${stats.progress.activeSessionItemCount}`
              : "—"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Recommended next session</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Focus on essential-before-birth and early-years topics you have not covered yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {stats.essentialRemaining.slice(0, 5).map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
                <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
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
