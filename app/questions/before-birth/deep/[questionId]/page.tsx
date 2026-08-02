import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EssentialsScreenView } from "@/components/essentials/EssentialsScreen";
import { getEssentialsScreenByQuestionId } from "@/lib/essentials/pathway";
import { readStore } from "@/lib/db/store";
import { getQuickContextForDeep } from "@/lib/services/conversations";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";

export const dynamic = "force-dynamic";

export default async function QuickToDeepPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ fromSession?: string; quick?: string }>;
}) {
  const { questionId } = await params;
  const sp = await searchParams;
  const screen = getEssentialsScreenByQuestionId(questionId);
  if (screen) {
    const q = new URLSearchParams();
    if (sp.fromSession) q.set("fromSession", sp.fromSession);
    if (sp.quick) q.set("quick", sp.quick);
    const qs = q.toString();
    redirect(
      `/questions/before-birth/screen/${screen.id}${qs ? `?${qs}` : ""}`,
    );
  }

  const store = await readStore();
  const question = store.questions.find((q) => q.id === questionId);
  if (!question) notFound();

  const answers = store.answers.filter((a) => a.question_id === questionId);
  const quickContext = getQuickContextForDeep(store, questionId);
  const quickPrompt = sp.quick
    ? resolveConversationPrompt(sp.quick)
    : quickContext
      ? resolveConversationPrompt(quickContext.promptId)
      : null;

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
        nextHref={
          sp.fromSession
            ? `/conversations/session/${sp.fromSession}`
            : "/conversations"
        }
        moduleTitle="Conversation follow-up"
        progressLabel="Quick → deep"
        sessionMode
      />

      {sp.fromSession ? (
        <div className="mt-4">
          <Link
            href={`/conversations/session/${sp.fromSession}`}
            className="btn btn-secondary"
          >
            Return to conversation
          </Link>
        </div>
      ) : null}
    </AppShell>
  );
}
