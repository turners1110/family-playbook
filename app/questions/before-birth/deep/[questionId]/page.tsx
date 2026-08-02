import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EssentialsScreenView } from "@/components/essentials/EssentialsScreen";
import { readStore } from "@/lib/db/store";
import { getQuickContextForDeep } from "@/lib/services/conversations";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import {
  conversationReturnHref,
  resolveDeepQuestionTarget,
} from "@/lib/conversations/deep-link";
import { isQaQuestionId } from "@/lib/qa/question-pack";

export const dynamic = "force-dynamic";

/**
 * Legacy entry — redirects to the canonical target from resolveDeepQuestionTarget.
 * QA IDs must never resolve here.
 */
export default async function QuickToDeepPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{
    fromSession?: string;
    quick?: string;
    returnTo?: string;
    sessionId?: string;
    sessionItemId?: string;
    testRunId?: string;
    source?: string;
  }>;
}) {
  const { questionId } = await params;
  const sp = await searchParams;

  if (isQaQuestionId(questionId)) {
    if (sp.testRunId) {
      const target = resolveDeepQuestionTarget({
        questionId,
        sessionId: sp.sessionId ?? sp.fromSession,
        sessionItemId: sp.sessionItemId,
        testRunId: sp.testRunId,
        returnTo: sp.returnTo,
      });
      if (target.href) redirect(target.href);
    }
    notFound();
  }

  const store = await readStore();
  const target = resolveDeepQuestionTarget({
    questionId,
    sessionId: sp.sessionId ?? sp.fromSession,
    sessionItemId: sp.sessionItemId,
    testRunId: sp.testRunId,
    returnTo: sp.returnTo,
    questions: store.questions.map((q) => ({ id: q.id, slug: q.slug })),
  });

  // Essentials screens — canonical path
  if (
    (target.type === "essentials_screen" ||
      target.type === "essentials_grouped") &&
    target.href
  ) {
    redirect(target.href);
  }

  if (target.type === "normal_question" && target.href) {
    // Prefer slug route; keep a conversation-aware fallback below only if needed.
    redirect(target.href);
  }

  if (target.type === "unavailable" || !target.exists) {
    notFound();
  }

  const question = store.questions.find((q) => q.id === questionId);
  if (!question) notFound();

  const answers = store.answers.filter((a) => a.question_id === questionId);
  const quickContext = getQuickContextForDeep(store, questionId);
  const quickPrompt = sp.quick
    ? resolveConversationPrompt(sp.quick)
    : quickContext
      ? resolveConversationPrompt(quickContext.promptId)
      : null;

  const returnHref = conversationReturnHref({
    returnTo: sp.returnTo,
    sessionId: sp.sessionId ?? sp.fromSession,
    testRunId: sp.testRunId,
  });

  return (
    <AppShell
      title={question.short_title}
      subtitle="Deeper discussion from a conversation prompt"
    >
      {(quickContext || quickPrompt) && (
        <section className="surface mb-4 p-5">
          <h2 className="font-display text-lg">From your quick prompt</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {quickPrompt?.prompt ?? quickContext?.prompt}
          </p>
          <div className="mt-3 space-y-1 text-sm">
            {quickContext?.sam ? (
              <p>
                <span className="font-medium">Sam chose</span>{" "}
                {quickContext.sam}.
              </p>
            ) : null}
            {quickContext?.michelle ? (
              <p>
                <span className="font-medium">Michelle chose</span>{" "}
                {quickContext.michelle}.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            This deeper question helps turn that instinct into a shared plan.
            Answers save under the existing question ID.
          </p>
        </section>
      )}

      <EssentialsScreenView
        screen={{
          id: `deep_${questionId}`,
          module_id: "conversation",
          question_id: questionId,
          display_order: 0,
          is_primary: false,
          title: question.short_title,
          purpose: question.why_it_matters,
          helper: question.discussion_guidance,
          prompts: question.follow_up_prompts,
          response_type: "open_with_prompts",
          separate_answers: question.separate_answers_recommended,
          timing_reason: question.timing_reason ?? "Conversation follow-up",
          review_trigger: question.review_recommendation ?? "Revisit as needed",
        }}
        question={question}
        pairedQuestions={[]}
        answers={answers}
        pairedAnswers={{}}
        members={store.members}
        nextHref={returnHref}
        moduleTitle="Conversation follow-up"
        progressLabel="Quick → deep"
        sessionMode
      />

      <div className="mt-4">
        <Link href={returnHref} className="btn btn-secondary">
          Return to conversation
        </Link>
      </div>
    </AppShell>
  );
}
