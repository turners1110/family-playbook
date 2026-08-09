import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  getConversationSession,
} from "@/lib/services/conversations";
import { evaluateSessionCompletion } from "@/lib/services/round-status";
import { readStore } from "@/lib/db/store";
import { parseBabymoonRound } from "@/lib/services/round-status";
import { notFound, redirect } from "next/navigation";
import { readyProposalsForQuestionIds } from "@/lib/knowledge";
import { PrincipleReadyBanner } from "@/components/decisions/PrincipleReadyBanner";

export const dynamic = "force-dynamic";

export default async function SessionCompletePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getConversationSession(sessionId);
  if (!detail) notFound();

  const store = await readStore();
  const eval_ = evaluateSessionCompletion(store, detail.session);
  const session = detail.session;

  if (
    session.status !== "completed" &&
    session.status !== "completed_with_followups"
  ) {
    if (eval_.allRequiredComplete) {
      // Persist then show — handled by caller; if we landed early, send to summary path after complete action
      redirect(`/conversations/session/${sessionId}`);
    }
    redirect(`/conversations/session/${sessionId}`);
  }

  const round = parseBabymoonRound(session.session_tag);
  const title = round
    ? `Babymoon Round ${round} complete`
    : `${session.title} complete`;

  const promptCount =
    session.completed_item_count ?? eval_.completedItemCount;
  const deepCount = (detail.answers ?? []).length > 0
    ? new Set(
        detail.items
          .map((i) => i.source_question_id)
          .filter(Boolean),
      ).size
    : 0;
  const sharedCount =
    detail.items.filter((i) => i.status === "shared_answer_saved").length +
    (session.summary?.shared_answers?.length ?? 0);

  const followUps = eval_.followUps;
  const nextRound = round && round < 3 ? ((round + 1) as 2 | 3) : null;
  const touchedQuestionIds = detail.items
    .map((i) => i.source_question_id)
    .filter((id): id is string => Boolean(id));
  const readyPrinciples = readyProposalsForQuestionIds(
    store,
    touchedQuestionIds,
  );

  return (
    <AppShell title={title} subtitle="Nice work — your progress is saved.">
      <PrincipleReadyBanner proposals={readyPrinciples} />
      <section className="surface mb-5 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
          Round finished
        </p>
        <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
        <p className="mt-2 text-ink-muted">
          Completed{" "}
          {session.completed_at
            ? new Date(session.completed_at).toLocaleString()
            : "just now"}
          . Refresh and relaunch will still show Completed.
        </p>

        <div className="mt-6">
          <h3 className="font-semibold text-ink">You completed</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            <li>{promptCount} prompts</li>
            <li>
              {deepCount} deep discussion link
              {deepCount === 1 ? "" : "s"} in this session
            </li>
            <li>{sharedCount} shared decisions</li>
          </ul>
        </div>

        {(followUps.total > 0 ||
          (session.summary?.discuss_later?.length ?? 0) > 0) && (
          <div className="mt-6">
            <h3 className="font-semibold text-ink">Open items</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {followUps.discussLater > 0 ||
              (session.summary?.discuss_later?.length ?? 0) > 0 ? (
                <li>
                  Discuss later (
                  {Math.max(
                    followUps.discussLater,
                    session.summary?.discuss_later?.length ?? 0,
                  )}
                  )
                </li>
              ) : null}
              {followUps.waitingProvider > 0 ||
              followUps.needsResearch > 0 ||
              (session.summary?.waiting_provider?.length ?? 0) > 0 ? (
                <li>Provider questions / research</li>
              ) : null}
              {followUps.unresolvedDifferences > 0 ||
              (session.summary?.kept_separate?.length ?? 0) > 0 ? (
                <li>Differences kept separate</li>
              ) : null}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href={`/conversations/session/${sessionId}/summary`}
            className="btn btn-primary"
          >
            View summary
          </Link>
          <Link
            href={`/conversations/session/${sessionId}/review`}
            className="btn btn-secondary"
          >
            Review answers
          </Link>
          {nextRound ? (
            <Link
              href="/conversations"
              className="btn btn-secondary"
            >
              Continue to Round {nextRound}
            </Link>
          ) : null}
          <Link href="/conversations" className="btn btn-ghost">
            Back to Conversations
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
