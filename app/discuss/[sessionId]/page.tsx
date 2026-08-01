import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { QuestionInterview } from "@/components/discuss/QuestionInterview";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { getSession } from "@/lib/services/sessions";
import { getSeparateAnswerState } from "@/lib/services/answers";
import { readStore } from "@/lib/db/store";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
  personStateLabel,
} from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function DiscussionSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getSession(sessionId);
  if (!detail) notFound();

  if (detail.session.status === "completed") {
    redirect(`/discuss/${sessionId}/summary`);
  }

  const current = detail.items[detail.session.current_index];
  if (!current?.question) {
    redirect(`/discuss/${sessionId}/summary`);
  }

  const store = await readStore();
  const answers = store.answers.filter((a) => a.question_id === current.question_id);
  const separate = await getSeparateAnswerState(current.question_id);
  const status = getQuestionAnswerStatus(current.question_id, store);
  const statusIndex = buildQuestionStatusIndex(store);
  const member = store.members.find((m) => m.user_id === store.current_user_id)!;
  const bookmarked = store.bookmarks.some(
    (b) => b.question_id === current.question_id && b.member_id === member.id,
  );

  const minutes = detail.items.reduce(
    (sum, item) => sum + (item.question?.estimated_minutes ?? 0),
    0,
  );

  return (
    <AppShell
      title={detail.session.title}
      subtitle={`${detail.items.length} questions · ~${minutes} min · ${
        detail.session.babymoon_mode ? "Babymoon mode" : "Standard discussion"
      }`}
      actions={
        <Link href={`/discuss/${sessionId}/summary`} className="btn btn-ghost">
          Session summary
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-sm">
        <span className="text-ink-muted">Before you answer:</span>
        <AnswerStatusBadge status={status} />
        <span className="text-ink-muted">
          Sam {personStateLabel(status.sam)} · Michelle{" "}
          {personStateLabel(status.michelle)} · Shared{" "}
          {personStateLabel(status.shared)}
        </span>
      </div>

      <QuestionInterview
        sessionId={sessionId}
        question={current.question}
        index={detail.session.current_index}
        total={detail.items.length}
        members={store.members}
        answers={answers}
        revealSeparate={separate.reveal}
        bookmarked={bookmarked}
        currentMemberId={member.id}
        answerStatusLabel={status.label}
      />

      {current.question.related_questions.length > 0 && (
        <section className="surface mt-5 p-4">
          <h3 className="font-display text-lg">Related questions</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {current.question.related_questions.map((id) => {
              const q = store.questions.find((item) => item.id === id);
              if (!q) return null;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                  <Link href={`/questions/${q.slug}`} className="text-accent hover:underline">
                    {q.short_title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
