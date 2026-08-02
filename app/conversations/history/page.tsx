import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { listConversationSessions, getConversationSession } from "@/lib/services/conversations";
import { formatApproximateActiveTime } from "@/lib/conversations/timing";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";

export const dynamic = "force-dynamic";

export default async function ConversationHistoryPage() {
  const sessions = await listConversationSessions();

  return (
    <AppShell
      title="Conversation history"
      subtitle="Past sessions, shared decisions, and differences you chose to keep."
    >
      <div className="mb-4">
        <Link href="/conversations" className="btn btn-secondary">
          Start a conversation
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-ink-muted">No conversation sessions yet.</p>
      ) : (
        <ul className="space-y-4">
          {await Promise.all(
            sessions.map(async (s) => {
              const detail = await getConversationSession(s.id);
              const items = detail?.items ?? [];
              const completed = items.filter((i) =>
                [
                  "answered_same",
                  "answered_different",
                  "shared_answer_saved",
                ].includes(i.status),
              ).length;
              const topics = [
                ...new Set(
                  items
                    .map((i) => resolveConversationPrompt(i.prompt_id)?.topic)
                    .filter(Boolean),
                ),
              ];
              const diffs = detail?.differences.length ?? 0;
              return (
                <li key={s.id} className="surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg">{s.title}</h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        {new Date(s.started_at).toLocaleString()} ·{" "}
                        {s.mode.replace(/_/g, " ")} · Planned{" "}
                        {s.planned_minutes || "open"} min · {completed}{" "}
                        questions completed ·{" "}
                        {formatApproximateActiveTime(s.active_seconds)}
                      </p>
                      {topics.length ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          Topics: {topics.join(", ")}
                        </p>
                      ) : null}
                      {s.summary?.trip_memory ? (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Memory:</span>{" "}
                          {s.summary.trip_memory}
                        </p>
                      ) : null}
                      {diffs > 0 ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          Interesting differences saved: {diffs}
                        </p>
                      ) : null}
                      {(s.summary?.agreed.length ?? 0) > 0 ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          Shared decisions noted: {s.summary!.agreed.length}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      {s.status === "active" || s.status === "paused" ? (
                        <Link
                          href={`/conversations/session/${s.id}`}
                          className="btn btn-primary"
                        >
                          Resume
                        </Link>
                      ) : null}
                      <Link
                        href={`/conversations/session/${s.id}/summary`}
                        className="btn btn-secondary"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </AppShell>
  );
}
