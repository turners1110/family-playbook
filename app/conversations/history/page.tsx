import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  getConversationSessionProgress,
  listConversationSessions,
} from "@/lib/services/conversations";
import { formatApproximateActiveTime } from "@/lib/conversations/timing";
import { evaluateSessionCompletion } from "@/lib/services/round-status";
import { parseBabymoonRound } from "@/lib/services/round-status";
import { readStore } from "@/lib/db/store";
import { EmptyState } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

type HistoryFilter = "active" | "completed" | "followups" | "all";

export default async function ConversationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter as HistoryFilter) || "all";
  const store = await readStore();
  const sessions = await listConversationSessions();

  const enriched = sessions.map((s) => {
    const progress = getConversationSessionProgress(store, s.id);
    const eval_ = evaluateSessionCompletion(store, s);
    const isCompleted =
      s.status === "completed" || s.status === "completed_with_followups";
    const isActive = s.status === "active" || s.status === "paused";
    const withFollowups =
      isCompleted &&
      (eval_.openFollowupCount > 0 || s.status === "completed_with_followups");
    return { session: s, progress, eval_, isCompleted, isActive, withFollowups };
  });

  const filtered = enriched.filter((row) => {
    if (filter === "active") return row.isActive;
    if (filter === "completed") return row.isCompleted;
    if (filter === "followups") return row.withFollowups;
    return true;
  });

  const filters: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "followups", label: "With follow-ups" },
  ];

  return (
    <AppShell
      title="Conversation history"
      subtitle="Past sessions, shared decisions, and differences you chose to keep."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/conversations" className="btn btn-secondary">
          Start a conversation
        </Link>
        {filters.map((f) => (
          <Link
            key={f.id}
            href={`/conversations/history?filter=${f.id}`}
            className={
              filter === f.id ? "btn btn-primary" : "btn btn-ghost"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing needs attention here."
          body="No conversation sessions in this filter."
          action={
            <Link href="/conversations" className="btn btn-primary">
              Start a conversation
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {filtered.map(
            ({ session: s, progress, eval_, isCompleted, isActive }) => {
              const round = parseBabymoonRound(s.session_tag);
              const shared =
                s.summary?.shared_answers?.length ??
                s.summary?.agreed?.length ??
                0;
              return (
                <li key={s.id} className="surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg">{s.title}</h2>
                        {isCompleted ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
                            Completed
                          </span>
                        ) : isActive ? (
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                            Active
                          </span>
                        ) : null}
                        {s.is_repeat ? (
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
                            Repeat
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {round ? `Round ${round} · ` : ""}
                        {s.mode.replace(/_/g, " ")} ·{" "}
                        {progress.answeredCount} of {progress.itemCount} items ·{" "}
                        {formatApproximateActiveTime(s.active_seconds)}
                      </p>
                      {isCompleted && s.completed_at ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          Completed{" "}
                          {new Date(s.completed_at).toLocaleDateString()}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-ink-muted">
                        Shared decisions: {shared}
                        {eval_.openFollowupCount
                          ? ` · Open follow-ups: ${eval_.openFollowupCount}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {isActive && progress.hasProgress ? (
                        <Link
                          href={`/conversations/session/${s.id}`}
                          className="btn btn-primary"
                        >
                          Continue
                        </Link>
                      ) : null}
                      {isCompleted ? (
                        <>
                          <Link
                            href={`/conversations/session/${s.id}/review`}
                            className="btn btn-primary"
                          >
                            Review conversation
                          </Link>
                          <Link
                            href={`/conversations/session/${s.id}/summary`}
                            className="btn btn-secondary"
                          >
                            View summary
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/conversations/session/${s.id}/summary`}
                          className="btn btn-secondary"
                        >
                          Details
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            },
          )}
        </ul>
      )}
    </AppShell>
  );
}
