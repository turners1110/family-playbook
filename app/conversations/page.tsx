import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ModeStarter } from "@/components/conversations/ModeStarter";
import { BabymoonRoundCard } from "@/components/conversations/BabymoonRoundCard";
import { CONVERSATION_MODES } from "@/lib/conversations/modes";
import { BABYMOON_ROUNDS } from "@/lib/conversations/babymoon-set";
import { ENERGY_LABELS } from "@/lib/conversations/response-types";
import {
  getConversationSessionProgress,
  listConversationSessions,
} from "@/lib/services/conversations";
import { evaluateBabymoonRoundStatus } from "@/lib/services/round-status";
import { formatApproximateActiveTime } from "@/lib/conversations/timing";
import { getActiveQuickPrompts, countQuickToDeepLinks } from "@/lib/conversations/quick-prompts";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const store = await readStore();
  const sessions = await listConversationSessions();
  const unfinished = sessions.filter(
    (s) => s.status === "active" || s.status === "paused",
  );
  const prompts = getActiveQuickPrompts();

  const roundViews = BABYMOON_ROUNDS.map((round) =>
    evaluateBabymoonRoundStatus(store, round.round),
  );

  return (
    <AppShell
      title="Conversations"
      subtitle="Low-pressure prompts that lead into deeper planning when you want them."
    >
      <section className="surface mb-5 p-5">
        <h2 className="font-display text-xl">Start a conversation</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {prompts.length} curated quick prompts · {countQuickToDeepLinks()}{" "}
          link to deeper Essentials questions. Your full library and Essentials
          stay intact.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/questions/before-birth" className="btn btn-secondary">
            Open Essentials
          </Link>
          <Link href="/conversations/history" className="btn btn-secondary">
            History
          </Link>
        </div>
      </section>

      {unfinished.length > 0 ? (
        <section className="surface mb-5 border-accent/30 p-5">
          <h2 className="font-display text-xl">Resume saved progress</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your answers are kept with each session. Prefer Continue on a session
            with answered cards — empty sessions stay secondary.
          </p>
          <ul className="mt-3 space-y-3">
            {[...unfinished]
              .map((s) => ({
                session: s,
                progress: getConversationSessionProgress(store, s.id),
              }))
              .sort((a, b) => {
                if (a.progress.hasProgress !== b.progress.hasProgress) {
                  return a.progress.hasProgress ? -1 : 1;
                }
                return (
                  b.progress.answeredCount - a.progress.answeredCount
                );
              })
              .map(({ session: s, progress }) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-sm text-ink-muted">
                      {progress.answeredCount} of {progress.itemCount} answered ·{" "}
                      {s.mode.replace(/_/g, " ")} ·{" "}
                      {formatApproximateActiveTime(s.active_seconds)} active
                    </div>
                    {!progress.hasProgress ? (
                      <div className="text-xs text-ink-subtle">
                        Empty session — Not started. Prefer a session with
                        answered cards.
                      </div>
                    ) : (
                      <div className="text-xs text-ink-subtle">In progress</div>
                    )}
                  </div>
                  <Link
                    href={`/conversations/session/${s.id}`}
                    className={
                      progress.hasProgress
                        ? "btn btn-primary"
                        : "btn btn-secondary"
                    }
                  >
                    {progress.hasProgress ? "Continue" : "Open"}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="surface mb-5 p-5">
        <h2 className="font-display text-xl">Babymoon Set</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Three rounds of about 15 minutes. Warm-up, birth and first weeks, then
          values and wrap-up.
        </p>
        <div className="mt-4 space-y-4">
          {BABYMOON_ROUNDS.map((round, i) => (
            <BabymoonRoundCard
              key={round.id}
              round={round.round}
              title={round.title}
              promptCount={round.prompt_ids.length}
              view={roundViews[i]!}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Conversation Modes</h2>
        {CONVERSATION_MODES.filter((mode) => mode.id !== "qa_integrity").map(
          (mode) => {
            const mix = Object.entries(mode.energy_mix)
              .filter(([, n]) => (n ?? 0) > 0)
              .map(
                ([k, n]) =>
                  `${n} ${ENERGY_LABELS[k as keyof typeof ENERGY_LABELS]}`,
              )
              .join(" · ");
            const last = sessions.find((s) => s.mode === mode.id);
            return (
              <article key={mode.id} className="surface p-5">
                <h3 className="font-display text-lg">{mode.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{mode.description}</p>
                <dl className="mt-3 grid gap-1 text-sm text-ink-muted">
                  <div>
                    <span className="text-ink">Expected time:</span>{" "}
                    {mode.expected_minutes_label}
                  </div>
                  <div>
                    <span className="text-ink">Energy mix:</span> {mix}
                  </div>
                  <div>
                    <span className="text-ink">Topics:</span>{" "}
                    {mode.topics.map((t) => t.replace(/_/g, " ")).join(", ")}
                  </div>
                  {last ? (
                    <div>
                      <span className="text-ink">Last session:</span>{" "}
                      {new Date(last.started_at).toLocaleDateString()} ·{" "}
                      {last.status}
                    </div>
                  ) : (
                    <div>
                      <span className="text-ink">Progress:</span> Not started yet
                    </div>
                  )}
                </dl>
                <ModeStarter
                  mode={mode.id}
                  defaultMinutes={mode.default_planned_minutes}
                />
              </article>
            );
          },
        )}
      </section>
    </AppShell>
  );
}
