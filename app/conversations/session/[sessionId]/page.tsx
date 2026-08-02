import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationCard } from "@/components/conversations/ConversationCard";
import { getConversationSession } from "@/lib/services/conversations";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { getConversationMode } from "@/lib/conversations/modes";
import { suggestMomentum } from "@/lib/conversations/momentum";
import { resolveDeepQuestionTarget } from "@/lib/conversations/deep-link";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function ConversationSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getConversationSession(sessionId);
  if (!data) notFound();

  const { session, items, answers, differences, members } = data;
  if (session.is_test_data && session.test_run_id) {
    redirect(`/conversations/test/${session.test_run_id}`);
  }
  if (!items.length) {
    return (
      <AppShell title="Conversation" subtitle="This session has no prompts.">
        <Link href="/conversations" className="btn btn-primary">
          Back to Conversations
        </Link>
      </AppShell>
    );
  }

  const index = Math.min(
    Math.max(session.current_item_index, 0),
    items.length - 1,
  );
  const item = items[index]!;
  const prompt = resolveConversationPrompt(item.prompt_id);
  if (!prompt) {
    return (
      <AppShell title="Conversation" subtitle="Missing prompt definition.">
        <p className="text-sm text-ink-muted">Prompt id: {item.prompt_id}</p>
        <Link href="/conversations" className="btn btn-primary mt-4">
          Back
        </Link>
      </AppShell>
    );
  }

  const itemAnswers = answers.filter((a) => a.session_item_id === item.id);
  const difference =
    differences.find((d) => d.prompt_id === item.prompt_id) ?? null;
  const mode = getConversationMode(session.mode);
  const answeredIds = items
    .filter((i) =>
      ["answered_same", "answered_different", "shared_answer_saved"].includes(
        i.status,
      ),
    )
    .map((i) => i.prompt_id);
  const plannedSeconds =
    session.planned_minutes > 0 ? session.planned_minutes * 60 : 45 * 60;
  const used = items.reduce((s, i) => s + i.actual_time_seconds, 0);
  const momentum = suggestMomentum({
    current: prompt,
    mode: session.mode,
    answeredIds,
    remainingSeconds: Math.max(60, plannedSeconds - used),
    sessionPromptIds: items.map((i) => i.prompt_id),
  });

  const store = await readStore();
  const deepTarget = resolveDeepQuestionTarget({
    questionId: prompt.follow_up_open_question_id,
    sessionId: session.id,
    sessionItemId: item.id,
    testRunId: session.test_run_id,
    returnTo: `/conversations/session/${session.id}`,
    questions: store.questions.map((q) => ({ id: q.id, slug: q.slug })),
  });

  return (
    <AppShell title={session.title} subtitle={`${mode.title} · card view`}>
      <ConversationCard
        session={session}
        item={item}
        prompt={prompt}
        answers={itemAnswers}
        difference={difference}
        members={members}
        itemIndex={index}
        itemCount={items.length}
        momentum={momentum}
        modeTitle={mode.title}
        deepTarget={deepTarget}
        sessionBaseHref={`/conversations/session/${session.id}`}
      />
    </AppShell>
  );
}
