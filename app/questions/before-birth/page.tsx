import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/shared/ui";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { collectTaskSuggestions } from "@/lib/essentials/task-suggestions";
import { TaskSuggestionPreview } from "@/components/essentials/TaskSuggestionPreview";
import { BEFORE_BIRTH_PATHWAY_VERSION } from "@/lib/essentials/pathway";

export const dynamic = "force-dynamic";

export default async function BeforeBirthEssentialsPage() {
  await requireFamilyContext();
  const store = await readStore();
  const dash = buildEssentialsDashboard(store);
  const suggestions = collectTaskSuggestions(store);

  return (
    <AppShell
      title="Before Birth Essentials"
      subtitle="A focused babymoon path — about 30 discussions, not the full library."
      actions={
        <div className="flex flex-wrap gap-2">
          {dash.resume_screen_id ? (
            <Link
              href={`/questions/before-birth/screen/${dash.resume_screen_id}`}
              className="btn btn-primary"
            >
              Resume where we left off
            </Link>
          ) : null}
          <Link
            href="/questions/before-birth/session"
            className="btn btn-secondary"
          >
            Babymoon session
          </Link>
          <Link
            href="/questions/before-birth/review"
            className="btn btn-ghost"
          >
            Review
          </Link>
          <Link href="/questions" className="btn btn-ghost">
            Full library
          </Link>
          <Link href="/conversations" className="btn btn-ghost">
            Try Babymoon Mode
          </Link>
        </div>
      }
    >
      <section className="surface mb-5 space-y-3 p-5">
        <p className="text-sm text-ink-muted">
          Prefer a lighter warm-up first?{" "}
          <Link href="/conversations" className="underline">
            Start a Conversation Mode
          </Link>{" "}
          — quick prompts link back into these Essentials discussions.
        </p>
      </section>

      <section className="surface mb-5 space-y-3 p-5">
        <ProgressBar
          value={
            dash.visible_primary
              ? Math.round((dash.completed / dash.visible_primary) * 100)
              : 0
          }
          label={`${dash.completed} of ${dash.visible_primary} discussions complete`}
        />
        <p className="text-sm text-ink-muted">
          About {dash.estimated_minutes_remaining} minutes remaining · Pathway{" "}
          {BEFORE_BIRTH_PATHWAY_VERSION} · {dash.total_primary} primary screens
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-ink-subtle">
          <span>{dash.in_progress} in progress</span>
          <span>{dash.not_started} not started</span>
          <span>{dash.needs_follow_up} needs follow-up</span>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        {dash.modules.map((mod) => (
          <Link
            key={mod.id}
            href={`/questions/before-birth/module/${mod.slug}`}
            className="surface block p-4 hover:border-accent"
          >
            <h2 className="font-display text-xl">{mod.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{mod.description}</p>
            <p className="mt-3 text-xs text-ink-subtle">
              {mod.question_count} screens · ~{mod.estimated_minutes} min ·{" "}
              {mod.progress_percent}% complete
            </p>
            <p className="mt-1 text-xs text-ink-subtle">
              {mod.completed} done · {mod.in_progress} in progress ·{" "}
              {mod.not_started} not started
              {mod.needs_follow_up ? ` · ${mod.needs_follow_up} follow-up` : ""}
            </p>
          </Link>
        ))}
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StatusCard
          title="Unresolved differences"
          items={dash.unresolved_disagreements.map((i) => i.title)}
        />
        <StatusCard
          title="Discuss later"
          items={dash.discuss_later.map((i) => i.title)}
        />
        <StatusCard
          title="Waiting for provider / research"
          items={[
            ...dash.waiting_provider.map((i) => i.title),
            ...dash.waiting_research.map((i) => i.title),
          ]}
        />
        <StatusCard
          title="Recently open"
          items={dash.screens
            .filter((s) => s.visible && s.state !== "completed")
            .slice(0, 5)
            .map((s) => s.screen.title)}
        />
      </div>

      <TaskSuggestionPreview suggestions={suggestions} />
    </AppShell>
  );
}

function StatusCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="surface p-4">
      <h3 className="font-display text-lg">{title}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-ink-muted">
          {items.slice(0, 6).map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-subtle">None right now.</p>
      )}
    </section>
  );
}
