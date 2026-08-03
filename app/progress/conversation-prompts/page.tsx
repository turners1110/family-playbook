import Link from "next/link";
import { ProgressDetailShell } from "@/components/progress/ProgressDetailShell";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import {
  listConversationPromptRecords,
  sortProgressRecords,
  type ProgressRecordSort,
} from "@/lib/services/progress-records";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function ConversationPromptsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const store = await readStore();
  const metrics = buildFamilyProgressMetrics(store);
  const q = (sp.q ?? "").trim().toLowerCase();
  let records = listConversationPromptRecords(store);
  if (q) {
    records = records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.mode.toLowerCase().includes(q),
    );
  }
  records = sortProgressRecords(
    records,
    (sp.sort as ProgressRecordSort) ?? "newest",
  );

  return (
    <ProgressDetailShell
      title="Conversation prompts"
      subtitle="Quick and short prompts completed in Conversations"
      count={records.length}
      expectedCount={metrics.conversationPromptsCompleted}
      search={sp.q}
      sort={sp.sort}
    >
      {records.length === 0 ? (
        <p className="text-ink-muted">No conversation prompts completed yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id} className="surface p-4">
              <div className="font-medium">{r.title}</div>
              <p className="mt-1 text-sm text-ink-muted">
                {r.responseType} · {r.mode.replace(/_/g, " ")}
                {r.round ? ` · Round ${r.round}` : ""} · {r.actorsAnswered}
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                Updated {new Date(r.lastUpdated).toLocaleString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={r.href} className="btn btn-secondary">
                  Open session
                </Link>
                {r.deepQuestionId ? (
                  <span className="text-xs text-ink-subtle self-center">
                    Linked deep: {r.deepQuestionId}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ProgressDetailShell>
  );
}
