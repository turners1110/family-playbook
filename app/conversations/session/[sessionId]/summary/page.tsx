import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SummaryEditor } from "@/components/conversations/SummaryEditor";
import { getConversationSession } from "@/lib/services/conversations";
import { formatApproximateActiveTime } from "@/lib/conversations/timing";
import { buildSessionSummary } from "@/lib/conversations/summary";

export const dynamic = "force-dynamic";

export default async function ConversationSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getConversationSession(sessionId);
  if (!data) notFound();

  const { session, items, answers, differences } = data;
  const summary =
    session.summary ??
    buildSessionSummary({ session, items, answers, differences });
  const completed = items.filter((i) =>
    [
      "answered_same",
      "answered_different",
      "shared_answer_saved",
      "skipped",
      "discuss_later",
      "undecided",
    ].includes(i.status),
  ).length;

  return (
    <AppShell
      title="Session summary"
      subtitle={`${session.title} · ${completed}/${items.length} completed`}
    >
      <div className="mb-4 text-sm text-ink-muted">
        Planned {session.planned_minutes || "open"} min · Approximate active
        time: {formatApproximateActiveTime(session.active_seconds)}
      </div>

      {summary.trip_memory ? (
        <section className="mb-5 rounded-2xl border-2 border-accent bg-accent-soft/50 p-5">
          <h2 className="font-display text-xl">One thing to remember</h2>
          <p className="mt-2 text-lg leading-relaxed">{summary.trip_memory}</p>
        </section>
      ) : null}

      {summary.differed.length > 0 ? (
        <section className="surface mb-4 p-5">
          <h2 className="font-display text-lg">Interesting differences</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {summary.differed.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <SummaryEditor sessionId={sessionId} initial={summary} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/conversations" className="btn btn-primary">
          Back to Conversations
        </Link>
        <Link href="/conversations/history" className="btn btn-secondary">
          History
        </Link>
        <Link
          href={`/conversations/session/${sessionId}`}
          className="btn btn-secondary"
        >
          Review cards
        </Link>
      </div>
    </AppShell>
  );
}
