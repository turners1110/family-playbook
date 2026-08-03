import Link from "next/link";
import { ProgressDetailShell } from "@/components/progress/ProgressDetailShell";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import {
  filterConversationPromptRows,
  listConversationPromptReviewRows,
  type ConversationPromptListFilter,
} from "@/lib/services/conversation-review";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const FILTERS: { id: ConversationPromptListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shared", label: "Shared only" },
  { id: "different", label: "Different answers" },
  { id: "discuss_later", label: "Discuss later" },
  { id: "research", label: "Research needed" },
  { id: "provider", label: "Provider" },
  { id: "babymoon", label: "Babymoon" },
  { id: "date_night", label: "Date night" },
  { id: "morning_coffee", label: "Morning coffee" },
  { id: "deep_dive", label: "Deep dive" },
  { id: "completed", label: "Completed sessions" },
];

export default async function ConversationPromptsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const store = await readStore();
  const metrics = buildFamilyProgressMetrics(store);
  const filter = (sp.filter as ConversationPromptListFilter) || "all";
  const allRows = listConversationPromptReviewRows(store);
  const rows = filterConversationPromptRows(allRows, {
    q: sp.q,
    filter,
  });

  return (
    <ProgressDetailShell
      title="Conversation prompts"
      subtitle="Quick and short prompts completed in Conversations — open the review record, not the answer flow."
      count={rows.length}
      expectedCount={
        sp.q || (filter !== "all")
          ? rows.length
          : metrics.conversationPromptsCompleted
      }
      search={sp.q}
      sort={sp.sort}
      filters={
        <label className="text-sm text-ink-muted">
          Filter
          <select
            name="filter"
            defaultValue={filter}
            className="mt-1 block rounded-xl border border-border bg-bg-elevated px-3 py-2 text-base"
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {rows.length === 0 ? (
        <p className="text-ink-muted">No conversation prompts match.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{r.prompt}</div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {r.round ? `Round ${r.round} · ` : ""}
                    {r.mode.replace(/_/g, " ")} ·{" "}
                    {new Date(r.date).toLocaleDateString()} · {r.participants}
                  </p>
                  <p className="mt-2 text-sm text-ink">
                    <span className="font-medium">{r.preview.label}</span>
                    {r.preview.snippet && r.preview.snippet !== r.preview.label
                      ? ` — ${r.preview.snippet}`
                      : ""}
                  </p>
                  {r.preview.kind === "different" ? (
                    <div className="mt-2 space-y-1 text-sm text-ink-muted">
                      {r.preview.samText ? (
                        <p>Sam: {r.preview.samText}</p>
                      ) : null}
                      {r.preview.michelleText ? (
                        <p>Michelle: {r.preview.michelleText}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-subtle">{r.statusLabel}</p>
                </div>
                <Link href={r.href} className="btn btn-primary shrink-0">
                  {r.sessionCompleted ? "Open review" : "Open session"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ProgressDetailShell>
  );
}
