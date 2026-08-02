import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationCard } from "@/components/conversations/ConversationCard";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { canAccessTestLab } from "@/lib/qa/access";
import { getQaRun } from "@/lib/services/qa-lab";
import {
  advanceConversationItem,
  getConversationSession,
} from "@/lib/services/conversations";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { getConversationMode } from "@/lib/conversations/modes";
import {
  conversationReturnHref,
  resolveDeepQuestionTarget,
} from "@/lib/conversations/deep-link";
import { getQaQuestion, isQaQuestionId } from "@/lib/qa/question-pack";

export const dynamic = "force-dynamic";

export default async function QaDeepQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ testRunId: string; questionId: string }>;
  searchParams: Promise<{
    returnTo?: string;
    sessionId?: string;
    sessionItemId?: string;
    source?: string;
  }>;
}) {
  const ctx = await requireFamilyContext();
  const { testRunId, questionId } = await params;
  const sp = await searchParams;

  if (!isQaQuestionId(questionId) || !getQaQuestion(questionId)) {
    notFound();
  }

  const { run } = await getQaRun(testRunId);
  if (!run?.session_id) notFound();

  const data = await getConversationSession(run.session_id);
  if (!data) notFound();

  const { session, items, answers, differences, members } = data;
  if (!session.is_test_data || session.test_run_id !== testRunId) notFound();

  const itemIndex = items.findIndex((i) => i.prompt_id === questionId);
  if (itemIndex < 0) notFound();
  const item = items[itemIndex]!;
  const prompt = resolveConversationPrompt(item.prompt_id);
  if (!prompt) notFound();

  // Align session progress with this deep card so resume stays in the same session.
  if (session.current_item_index !== itemIndex) {
    await advanceConversationItem(session.id, "goto", itemIndex);
  }

  const returnHref = conversationReturnHref({
    returnTo: sp.returnTo,
    sessionId: session.id,
    testRunId,
  });

  const deepTarget = resolveDeepQuestionTarget({
    questionId,
    sessionId: session.id,
    sessionItemId: sp.sessionItemId ?? item.id,
    testRunId,
    returnTo: returnHref,
  });

  const itemAnswers = answers.filter((a) => a.session_item_id === item.id);
  const difference =
    differences.find((d) => d.prompt_id === item.prompt_id) ?? null;
  const mode = getConversationMode(session.mode);
  const labAccess = canAccessTestLab(ctx);

  return (
    <AppShell
      title="QA Deep Follow-Up"
      subtitle={`${testRunId} · ${questionId}`}
      focusMode
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={returnHref} className="btn btn-secondary">
            Return to QA session
          </Link>
          {labAccess ? (
            <Link
              href={`/settings/test-lab?run=${testRunId}`}
              className="btn btn-ghost"
            >
              Test Lab
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="mx-auto mb-3 w-full max-w-lg px-3">
        <div className="rounded-xl border border-warning/40 bg-warning-soft/50 p-3 text-sm">
          <p className="font-medium">QA deep question</p>
          <p className="mt-1 text-xs text-ink-muted">
            Answers save under <code>{questionId}</code> with{" "}
            <code>test_run_id={testRunId}</code>. Same session — no second run.
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-subtle">
            resolved: {deepTarget.type} · {deepTarget.href}
          </p>
        </div>
      </div>

      <ConversationCard
        session={{ ...session, current_item_index: itemIndex }}
        item={item}
        prompt={prompt}
        answers={itemAnswers}
        difference={difference}
        members={members}
        itemIndex={itemIndex}
        itemCount={items.length}
        momentum={[]}
        modeTitle={mode.title}
        deepTarget={deepTarget}
        sessionBaseHref={`/conversations/test/${testRunId}`}
      />
    </AppShell>
  );
}
