import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, ProgressBar, StatCard } from "@/components/shared/ui";
import { ProgressTile } from "@/components/home/ProgressTile";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { getDashboardStats } from "@/lib/services/stats";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";
import {
  buildTopicCoverage,
  decisionHref,
  decisionsNeedingAttention,
  listReadyPrincipleProposals,
  recommendNextQuestions,
} from "@/lib/knowledge";
import { buildDiscussionModeHomeStats } from "@/lib/discussions/discussion-stats";
import { PrincipleReadyBanner } from "@/components/decisions/PrincipleReadyBanner";
import {
  NextQuestionsPanel,
  TopicCoveragePanel,
} from "@/components/decisions/TopicCoveragePanels";
import {
  classifyPrebirthBucket,
  whyNowExplanation,
  PREBIRTH_BUCKET_LABELS,
} from "@/lib/research/prebirth-priority";
import { classifyResearchValue } from "@/lib/research/research-value";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await readStore();
  const stats = await getDashboardStats();
  const statusIndex = buildQuestionStatusIndex(store);
  const attentionDecisions = decisionsNeedingAttention(store).slice(0, 5);
  const discussionStats = buildDiscussionModeHomeStats(store);
  const readyPrinciples = listReadyPrincipleProposals(store).slice(0, 2);
  const nextQuestions = recommendNextQuestions(store, 5);
  const topicCoverage = buildTopicCoverage(store);
  const nextQuestion = nextQuestions[0]
    ? store.questions.find((q) => q.id === nextQuestions[0]!.questionId)
    : null;
  const nextValue = nextQuestion
    ? classifyResearchValue({
        id: nextQuestion.id,
        title: nextQuestion.short_title,
        text: nextQuestion.text,
        categories: nextQuestion.categories,
        evidence_needed: nextQuestion.evidence_needed,
        research_mode: nextQuestion.research_mode,
        priority: nextQuestion.priority,
      })
    : null;
  const nextBucket = nextQuestion
    ? classifyPrebirthBucket({
        title: nextQuestion.short_title,
        text: nextQuestion.text,
        priority: nextQuestion.priority,
        required_before_birth: nextQuestion.required_before_birth,
        babymoon_priority: nextQuestion.babymoon_priority,
        research_value: nextValue?.class,
        estimated_minutes: nextQuestion.estimated_minutes,
        life_stages: nextQuestion.life_stages,
      })
    : null;
  const nextWhy = nextBucket
    ? whyNowExplanation({
        bucket: nextBucket.bucket,
        title: nextQuestion?.short_title ?? "",
        estimated_minutes: nextQuestion?.estimated_minutes,
      })
    : null;

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
        <h2 className="font-display text-2xl text-ink">What to do next</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Start from the path that matches your energy — you should rarely need to
          choose between Questions and Conversations.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.lastSession && stats.lastSession.status !== "completed" ? (
            <Link
              href={`/discuss/${stats.lastSession.id}`}
              className="rounded-xl border border-border px-4 py-3 hover:border-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Continue
              </p>
              <p className="mt-1 font-medium text-ink">Resume last discussion</p>
              <p className="mt-1 text-sm text-ink-muted">Pick up where you left off</p>
            </Link>
          ) : (
            <Link
              href="/babymoon"
              className="rounded-xl border border-border px-4 py-3 hover:border-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Continue
              </p>
              <p className="mt-1 font-medium text-ink">Continue Babymoon</p>
              <p className="mt-1 text-sm text-ink-muted">Curated rounds + Essentials</p>
            </Link>
          )}
          {nextQuestions[0] ? (
            <Link
              href={`/questions/${nextQuestions[0].slug}`}
              className="rounded-xl border border-border px-4 py-3 hover:border-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Next important discussion
              </p>
              <p className="mt-1 font-medium text-ink">{nextQuestions[0].text}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {nextQuestions[0].estimatedMinutes
                  ? `About ${nextQuestions[0].estimatedMinutes} min`
                  : "High-value next topic"}
                {nextBucket
                  ? ` · ${PREBIRTH_BUCKET_LABELS[nextBucket.bucket]}`
                  : ""}
              </p>
              {nextWhy ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  Why now? {nextWhy}
                </p>
              ) : null}
            </Link>
          ) : (
            <Link
              href="/discuss"
              className="rounded-xl border border-border px-4 py-3 hover:border-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Next important discussion
              </p>
              <p className="mt-1 font-medium text-ink">Start a discussion</p>
              <p className="mt-1 text-sm text-ink-muted">Choose a guided session length</p>
            </Link>
          )}
          <Link
            href="/questions/before-birth"
            className="rounded-xl border border-border px-4 py-3 hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Before Birth
            </p>
            <p className="mt-1 font-medium text-ink">
              {stats.progress.essentialsScreensCompleted} of{" "}
              {stats.progress.essentialsScreensVisible} Essentials complete
            </p>
            <p className="mt-1 text-sm text-ink-muted">Guided planning workshop</p>
          </Link>
          <Link
            href="/decisions?filter=needs_attention"
            className="rounded-xl border border-border px-4 py-3 hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Decisions needing attention
            </p>
            <p className="mt-1 font-medium text-ink">
              {attentionDecisions.length} need follow-up
            </p>
            <p className="mt-1 text-sm text-ink-muted">Shared positions and open threads</p>
          </Link>
          <Link
            href="/conversations"
            className="rounded-xl border border-border px-4 py-3 hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Quick conversation
            </p>
            <p className="mt-1 font-medium text-ink">Have 10–15 minutes?</p>
            <p className="mt-1 text-sm text-ink-muted">Lightning prompts and Babymoon rounds</p>
          </Link>
          <Link
            href="/questions"
            className="rounded-xl border border-border px-4 py-3 hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Browse everything
            </p>
            <p className="mt-1 font-medium text-ink">Full question library</p>
            <p className="mt-1 text-sm text-ink-muted">430 topics when you want to explore</p>
          </Link>
        </div>
      </section>

      <PrincipleReadyBanner proposals={readyPrinciples} />
      <NextQuestionsPanel items={nextQuestions} />
      <TopicCoveragePanel rows={topicCoverage} />

      <section className="surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">Your progress</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tap a tile to see the exact records behind each count. Quick Picks do
          not automatically complete a library question.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProgressTile
            href="/progress/deep-discussions"
            label="Deep discussions"
            value={stats.progress.canonicalQuestionsAnswered}
            explanation="Canonical questions with a saved deep answer"
            hint={`${stats.progress.canonicalQuestionsPartial} partial · ${stats.progress.canonicalQuestionsTotal} total`}
          />
          <ProgressTile
            href="/progress/conversation-prompts"
            label="Conversation prompts"
            value={stats.progress.conversationPromptsCompleted}
            explanation="Quick and short prompts completed in Conversations"
            hint={`${stats.progress.conversationQuickAnswers} quick answers saved`}
          />
          <ProgressTile
            href="/questions/before-birth?filter=completed"
            label="Essentials"
            value={`${stats.progress.essentialsScreensCompleted} of ${stats.progress.essentialsScreensVisible}`}
            explanation="Completed Before Birth Essentials screens"
          />
          <ProgressTile
            href="/progress/shared-decisions"
            label="Shared decisions"
            value={stats.progress.sharedDecisions}
            explanation="Agreed shared answers saved by both parents"
          />
          <ProgressTile
            href="/progress/open-followups"
            label="Open follow-ups"
            value={stats.progress.openFollowUps}
            explanation="Items marked for later, provider input, research, or review"
          />
          <StatCard
            label="Overall completion"
            value={`${stats.completion}%`}
            hint="Based on deep discussions only"
          />
        </div>
      </section>

      <section className="surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">How you discuss</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Most parenting decisions are made together. Separate reflection is
          intentional when it helps.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Completed together"
            value={`${discussionStats.completedTogetherPct}%`}
            hint="Share of finished discussions that started shared-first"
          />
          <StatCard
            label="Separate reflection remaining"
            value={discussionStats.separateReflectionRemaining}
            hint="Topics that still benefit from independent thinking"
          />
          <StatCard
            label="Shared decisions completed"
            value={discussionStats.sharedDecisionsCompleted}
            hint="Family positions saved from discussion"
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
          <h3 className="font-display text-xl">Decisions that need attention</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Topics where discussion, evidence, or a shared position still needs
            work.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {attentionDecisions.length === 0 ? (
              <li className="text-ink-muted">Nothing urgent right now.</li>
            ) : (
              attentionDecisions.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <Link
                    href={decisionHref(d)}
                    className="font-medium hover:text-accent"
                  >
                    {d.title}
                  </Link>
                  <span className="text-xs text-ink-subtle">
                    {d.health.grade.replace(/_/g, " ")}
                  </span>
                </li>
              ))
            )}
          </ul>
          <Link href="/decisions?filter=needs_attention" className="btn btn-secondary mt-4">
            Browse decisions
          </Link>
        </section>

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
              <li>
                <EmptyState
                  title="Nothing needs attention here."
                  body="No decisions yet."
                />
              </li>
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
