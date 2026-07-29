import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSessionSummary } from "@/lib/services/sessions";
import { SessionNoteForm } from "@/components/discuss/SessionNoteForm";

export const dynamic = "force-dynamic";

export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const summary = await getSessionSummary(sessionId);
  if (!summary) notFound();

  return (
    <AppShell
      title="Session summary"
      subtitle={summary.session.title}
      actions={
        <>
          <Link href="/discuss" className="btn btn-secondary">
            New session
          </Link>
          <Link href="/home" className="btn btn-primary">
            Back home
          </Link>
        </>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4">
          <div className="text-sm text-ink-muted">Completed</div>
          <div className="font-display text-3xl">
            {summary.completed}/{summary.total}
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-sm text-ink-muted">Skipped</div>
          <div className="font-display text-3xl">{summary.skipped}</div>
        </div>
        <div className="surface p-4">
          <div className="text-sm text-ink-muted">Undecided</div>
          <div className="font-display text-3xl">{summary.undecided}</div>
        </div>
        <div className="surface p-4">
          <div className="text-sm text-ink-muted">Low confidence</div>
          <div className="font-display text-3xl">{summary.lowConfidence}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">Follow-up</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li>Separate answers recorded: {summary.separate}</li>
            <li>Research items: {summary.research}</li>
            <li>Cooling-off items: {summary.coolingOff}</li>
            <li>Review-later items: {summary.reviewLater}</li>
            <li>Outcomes touched: {summary.outcomes.join(", ") || "None tagged"}</li>
          </ul>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Decisions linked</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.decisions.length === 0 && (
              <li className="text-ink-muted">No linked decisions yet.</li>
            )}
            {summary.decisions.map((d) => (
              <li key={d.id}>
                <Link href={`/decisions/${d.id}`} className="hover:text-accent">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/discuss?preset=not_considered" className="btn btn-secondary mt-4">
            Suggested next: something new
          </Link>
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Session note</h2>
        <SessionNoteForm sessionId={sessionId} initialNote={summary.session.note ?? ""} />
      </section>
    </AppShell>
  );
}
