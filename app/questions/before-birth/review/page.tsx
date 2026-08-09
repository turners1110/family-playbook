import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { buildBabymoonSummary } from "@/lib/essentials/summary";
import { collectTaskSuggestions } from "@/lib/essentials/task-suggestions";
import { TaskSuggestionPreview } from "@/components/essentials/TaskSuggestionPreview";
import {
  listReadyPrincipleProposals,
  buildTopicCoverage,
} from "@/lib/knowledge";
import { PrincipleReadyBanner } from "@/components/decisions/PrincipleReadyBanner";
import { TopicCoveragePanel } from "@/components/decisions/TopicCoveragePanels";

export const dynamic = "force-dynamic";

export default async function EssentialsReviewPage() {
  await requireFamilyContext();
  const store = await readStore();
  const dash = buildEssentialsDashboard(store);
  const summary = buildBabymoonSummary(store);
  const suggestions = collectTaskSuggestions(store);
  const readyPrinciples = listReadyPrincipleProposals(store);
  const topicCoverage = buildTopicCoverage(store).filter((r) =>
    [
      "visitors-after-birth",
      "sleep",
      "feeding",
      "birth-plan",
      "partnership",
      "childcare",
    ].includes(r.topicSlug),
  );

  const agreed = dash.screens.filter((s) => s.visible && s.state === "completed");
  const different = dash.unresolved_disagreements;
  const undecided = dash.screens.filter(
    (s) =>
      s.visible &&
      store.answers.some(
        (a) =>
          a.question_id === s.screen.question_id && a.status === "undecided",
      ),
  );
  const notStarted = dash.screens.filter(
    (s) => s.visible && s.state === "not_started",
  );

  return (
    <AppShell
      title="Babymoon review"
      subtitle="Agreements, open items, and suggested next actions — disagreement is not failure."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/questions/before-birth" className="btn btn-ghost">
            Dashboard
          </Link>
          {dash.resume_screen_id ? (
            <Link
              href={`/questions/before-birth/screen/${dash.resume_screen_id}`}
              className="btn btn-primary"
            >
              Continue
            </Link>
          ) : null}
        </div>
      }
    >
      <PrincipleReadyBanner proposals={readyPrinciples} />
      <TopicCoveragePanel rows={topicCoverage} />

      <section className="surface mb-5 space-y-3 p-5">
        <h2 className="font-display text-xl">Babymoon summary</h2>
        <p className="text-sm text-ink-muted">
          {summary.completed_count} shared or completed · {summary.open_count} still
          open · Generated {new Date(summary.generated_at).toLocaleString()}
        </p>
        <SummaryList title="Shared decisions" items={summary.shared_decisions.map((i) => `${i.title}: ${i.summary}`)} />
        <SummaryList title="Open decisions" items={summary.open_decisions.map((i) => `${i.title} (${i.reason})`)} />
        <SummaryList title="Different viewpoints" items={summary.different_viewpoints.map((i) => `${i.title} — ${i.note}`)} />
        <SummaryList title="Questions for providers" items={summary.provider_questions.map((i) => i.title)} />
        <SummaryList title="Draft policies" items={summary.policies_drafted.map((i) => `${i.title}: ${i.summary}`)} />
        <SummaryList title="Revisit after birth" items={summary.revisit_after_birth.map((i) => `${i.title} · ${i.trigger}`)} />
      </section>

      <div className="mb-5 grid gap-3">
        <ReviewBlock
          title="Agreed decisions"
          items={agreed.map((s) => ({
            id: s.screen.id,
            title: s.screen.title,
          }))}
        />
        <ReviewBlock
          title="Different answers"
          items={different.map((d) => ({ id: d.screen_id, title: d.title }))}
        />
        <ReviewBlock
          title="Undecided"
          items={undecided.map((s) => ({
            id: s.screen.id,
            title: s.screen.title,
          }))}
        />
        <ReviewBlock
          title="Waiting for provider"
          items={dash.waiting_provider.map((d) => ({
            id: d.screen_id,
            title: d.title,
          }))}
        />
        <ReviewBlock
          title="Waiting for research"
          items={dash.waiting_research.map((d) => ({
            id: d.screen_id,
            title: d.title,
          }))}
        />
        <ReviewBlock
          title="Discuss later"
          items={dash.discuss_later.map((d) => ({
            id: d.screen_id,
            title: d.title,
          }))}
        />
        <ReviewBlock
          title="Not started"
          items={notStarted.map((s) => ({
            id: s.screen.id,
            title: s.screen.title,
          }))}
        />
      </div>

      <TaskSuggestionPreview suggestions={suggestions} />
    </AppShell>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-1 space-y-1 text-sm text-ink-muted">
          {items.slice(0, 12).map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-subtle">None yet.</p>
      )}
    </div>
  );
}

function ReviewBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string }>;
}) {
  return (
    <section className="surface p-4">
      <h2 className="font-display text-lg">{title}</h2>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/questions/before-birth/screen/${item.id}`}
                className="text-sm text-accent underline"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-subtle">None.</p>
      )}
    </section>
  );
}
