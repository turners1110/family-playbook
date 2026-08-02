import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TestLabClient } from "@/components/qa/TestLabClient";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { canAccessTestLab } from "@/lib/qa/access";
import { listQaRuns, getQaRun } from "@/lib/services/qa-lab";
import { qaQuestionCount } from "@/lib/qa/question-pack";
import { auditQuickToDeepLinks } from "@/lib/conversations/deep-link";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function TestLabPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const ctx = await requireFamilyContext();
  if (!canAccessTestLab(ctx)) {
    notFound();
  }

  const params = await searchParams;
  const runs = await listQaRuns();
  const selected =
    params.run != null
      ? (await getQaRun(params.run)).run
      : runs[0] ?? null;
  const store = await readStore();
  const deepLinkAudit = auditQuickToDeepLinks(
    store.questions.map((q) => ({ id: q.id, slug: q.slug })),
  );

  return (
    <AppShell
      title="Test Lab"
      subtitle="Safe QA pack for Conversations, Essentials linkage, sync, and cleanup."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/settings" className="btn btn-ghost">
            Settings
          </Link>
          {selected ? (
            <Link
              href={`/conversations/test/${selected.test_run_id}`}
              className="btn btn-secondary"
            >
              Open QA Session
            </Link>
          ) : null}
        </div>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        {qaQuestionCount()} QA-only questions (qa_ prefix). They are not part of
        the 430-question library and stay out of normal navigation.
      </p>
      <TestLabClient
        runs={runs}
        selectedRun={selected}
        actorName={ctx.member.display_name}
        authMode={ctx.mode}
        deepLinkAudit={deepLinkAudit}
      />
    </AppShell>
  );
}
