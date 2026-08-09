import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EssentialsScreenView } from "@/components/essentials/EssentialsScreen";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import {
  getEssentialsModule,
  getEssentialsScreen,
} from "@/lib/essentials/pathway";
import { nextScreenId } from "@/lib/essentials/progress";
import { getQuickContextForDeep } from "@/lib/services/conversations";
import { companionForDeepQuestion } from "@/lib/conversations/companions";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { conversationReturnHref, resolveLibraryQuestionId } from "@/lib/conversations/deep-link";
import { getQuestionAnswerStatus } from "@/lib/services/question-status";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";

export const dynamic = "force-dynamic";

export default async function EssentialsScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{
    session?: string;
    fromSession?: string;
    quick?: string;
    returnTo?: string;
    sessionId?: string;
    sessionItemId?: string;
    testRunId?: string;
    source?: string;
  }>;
}) {
  await requireFamilyContext();
  const { screenId } = await params;
  const sp = await searchParams;
  const { session, fromSession, quick, returnTo, sessionId, testRunId } = sp;
  const store = await readStore();
  const screen = getEssentialsScreen(screenId);
  if (!screen) notFound();

  const resolvedQuestionId = resolveLibraryQuestionId(
    screen.question_id,
    store.questions,
  );
  const question = store.questions.find((q) => q.id === resolvedQuestionId);
  if (!question) notFound();

  const pairedQuestions = (screen.paired_question_ids ?? [])
    .map((id) => {
      const resolved = resolveLibraryQuestionId(id, store.questions);
      return store.questions.find((q) => q.id === resolved);
    })
    .filter(Boolean) as typeof store.questions;

  const answers = store.answers.filter(
    (a) =>
      a.question_id === question.id ||
      a.question_id === screen.question_id ||
      question.id.startsWith(a.question_id) ||
      a.question_id.startsWith(question.id),
  );
  const pairedAnswers: Record<string, typeof answers> = {};
  for (const pq of pairedQuestions) {
    pairedAnswers[pq.id] = store.answers.filter(
      (a) =>
        a.question_id === pq.id ||
        pq.id.startsWith(a.question_id) ||
        a.question_id.startsWith(pq.id),
    );
  }

  const answerStatus = getQuestionAnswerStatus(question.id, store);
  const previouslyAnswered =
    answerStatus.fullyAnswered || answerStatus.partiallyAnswered;

  const nextId = nextScreenId(screen.id, store);
  const conversationReturn = conversationReturnHref({
    returnTo,
    sessionId: sessionId ?? fromSession,
    testRunId,
  });
  const fromConversation = Boolean(
    returnTo || fromSession || sessionId || testRunId,
  );
  const nextHref = fromConversation
    ? conversationReturn
    : nextId
      ? `/questions/before-birth/screen/${nextId}${session ? "?session=1" : ""}`
      : "/questions/before-birth/review";

  const mod = getEssentialsModule(screen.module_id);
  const sessionMode = session === "1";
  const quickContext =
    getQuickContextForDeep(store, question.id) ??
    getQuickContextForDeep(store, screen.question_id);
  const companion =
    companionForDeepQuestion(question.id) ??
    companionForDeepQuestion(screen.question_id);
  const quickPrompt = quick
    ? resolveConversationPrompt(quick)
    : companion
      ? resolveConversationPrompt(companion.companion_prompt_id)
      : null;

  return (
    <AppShell
      title={sessionMode ? "Babymoon session" : "Before Birth Essentials"}
      subtitle={mod?.title}
      focusMode={sessionMode}
      actions={
        <div className="flex flex-wrap gap-2">
          {companion ? (
            <Link
              href={`/conversations?warmUp=${companion.companion_prompt_id}`}
              className="btn btn-ghost"
            >
              Try a lighter warm-up
            </Link>
          ) : null}
          <Link href="/questions/before-birth" className="btn btn-ghost">
            Exit to dashboard
          </Link>
        </div>
      }
    >
      {previouslyAnswered ? (
        <section className="surface mb-4 flex flex-wrap items-center gap-2 p-4">
          <span className="badge badge-info">Previously answered</span>
          <AnswerStatusBadge status={answerStatus} compact />
          <p className="text-sm text-ink-muted">
            Your existing answer is loaded below. Edit to update, or continue
            when you are satisfied.
          </p>
        </section>
      ) : null}
      {(quickContext || quickPrompt) && (
        <section className="surface mb-4 p-5">
          <h2 className="font-display text-lg">From your quick prompt</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {quickPrompt?.prompt ?? quickContext?.prompt}
          </p>
          <div className="mt-3 space-y-1 text-sm">
            {quickContext?.sam ? (
              <p>
                <span className="font-medium">Sam chose</span> {quickContext.sam}.
              </p>
            ) : null}
            {quickContext?.michelle ? (
              <p>
                <span className="font-medium">Michelle chose</span>{" "}
                {quickContext.michelle}.
              </p>
            ) : null}
          </div>
        </section>
      )}

      <EssentialsScreenView
        key={screen.id}
        screen={screen}
        question={question}
        pairedQuestions={pairedQuestions}
        answers={answers}
        pairedAnswers={pairedAnswers}
        members={store.members}
        nextHref={nextHref}
        moduleTitle={mod?.title ?? "Essentials"}
        progressLabel={`Screen ${screen.display_order}`}
        sessionMode={sessionMode}
      />
    </AppShell>
  );
}
