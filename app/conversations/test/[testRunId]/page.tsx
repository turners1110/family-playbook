import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { QaSessionView } from "@/components/qa/QaSessionView";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { canAccessTestLab } from "@/lib/qa/access";
import { getQaRun } from "@/lib/services/qa-lab";
import { getConversationSession } from "@/lib/services/conversations";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { getConversationMode } from "@/lib/conversations/modes";
import { countQaRecords } from "@/lib/qa/integrity";
import { readStore } from "@/lib/db/store";
import { QA_SESSION_ORDER } from "@/lib/qa/question-pack";

export const dynamic = "force-dynamic";

export default async function QaConversationSessionPage({
  params,
}: {
  params: Promise<{ testRunId: string }>;
}) {
  const ctx = await requireFamilyContext();
  // Michelle may open the same run for two-phone tests when enabled;
  // otherwise Sam-only. For Trip Mode Michelle two-phone, allow any family member
  // to open an existing QA session by test_run_id (read/write answers) but hide Test Lab.
  const { testRunId } = await params;
  const { run } = await getQaRun(testRunId);
  if (!run || !run.session_id) notFound();

  const data = await getConversationSession(run.session_id);
  if (!data) notFound();

  const { session, items, answers, differences, members } = data;
  if (!session.is_test_data || session.test_run_id !== testRunId) notFound();

  if (!items.length) {
    return (
      <AppShell title="QA Session" subtitle="No items">
        <Link href="/settings/test-lab" className="btn btn-primary">
          Back to Test Lab
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
  if (!prompt) notFound();

  const store = await readStore();
  const counts = countQaRecords(store, testRunId);
  const mode = getConversationMode("qa_integrity");
  const labAccess = canAccessTestLab(ctx);

  // End-of-session comparison panel when on last card or completed
  const showAudit =
    session.status === "completed" || index >= items.length - 1;

  return (
    <AppShell
      title="QA Integrity Session"
      subtitle={`${testRunId} · ${ctx.member.display_name}`}
      focusMode
      actions={
        labAccess ? (
          <Link
            href={`/settings/test-lab?run=${testRunId}`}
            className="btn btn-ghost"
          >
            Test Lab
          </Link>
        ) : null
      }
    >
      <QaSessionView
        testRunId={testRunId}
        session={session}
        item={item}
        prompt={prompt}
        answers={answers.filter((a) => a.session_item_id === item.id)}
        difference={
          differences.find((d) => d.prompt_id === item.prompt_id) ?? null
        }
        members={members}
        itemIndex={index}
        itemCount={items.length}
        modeTitle={mode.title}
      />

      {showAudit ? (
        <section className="mx-auto mt-6 max-w-lg px-3 pb-32">
          <div className="surface p-5">
            <h2 className="font-display text-xl">Expected vs actual</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-medium">Expected items</dt>
                <dd className="text-ink-muted">{QA_SESSION_ORDER.length}</dd>
              </div>
              <div>
                <dt className="font-medium">Actual items</dt>
                <dd className="text-ink-muted">{counts.session_items}</dd>
              </div>
              <div>
                <dt className="font-medium">Quick answers</dt>
                <dd className="text-ink-muted">{counts.quick_answers}</dd>
              </div>
              <div>
                <dt className="font-medium">Differences</dt>
                <dd className="text-ink-muted">{counts.differences}</dd>
              </div>
              <div>
                <dt className="font-medium">Sessions for this run</dt>
                <dd className="text-ink-muted">{counts.sessions}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-subtle">
              Missing / duplicate / invalid detail is in Test Lab → Run Automated
              Integrity Check.
            </p>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
