"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSessionSummary } from "@/lib/types/models";
import { actionUpdateConversationSummary } from "@/lib/actions/conversations";

export function SummaryEditor({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: ConversationSessionSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function listField(key: keyof ConversationSessionSummary, label: string) {
    const value = summary[key];
    if (!Array.isArray(value)) return null;
    return (
      <section className="surface mb-4 p-5">
        <h2 className="font-display text-lg">{label}</h2>
        <textarea
          className="mt-2 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
          rows={4}
          value={value.join("\n")}
          onChange={(e) =>
            setSummary({
              ...summary,
              [key]: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
        />
      </section>
    );
  }

  return (
    <div>
      {listField("agreed", "What we agreed on")}
      {listField("differed", "Where our instincts differed")}
      {listField("discuss_later", "What we want to discuss later")}
      {listField("tasks_suggested", "Tasks we might add")}
      {listField("provider_questions", "Questions for providers")}
      <section className="surface mb-4 p-5">
        <h2 className="font-display text-lg">Best light moment</h2>
        <input
          className="mt-2 w-full rounded-xl border border-border bg-bg-elevated px-3 py-3 text-base"
          value={summary.light_moment ?? ""}
          onChange={(e) =>
            setSummary({ ...summary, light_moment: e.target.value || null })
          }
        />
      </section>
      <section className="surface mb-4 p-5">
        <h2 className="font-display text-lg">One thing to remember</h2>
        <textarea
          className="mt-2 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
          rows={3}
          value={summary.trip_memory ?? ""}
          onChange={(e) =>
            setSummary({ ...summary, trip_memory: e.target.value || null })
          }
        />
      </section>
      <section className="surface mb-4 p-5">
        <h2 className="font-display text-lg">Notes</h2>
        <textarea
          className="mt-2 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
          rows={3}
          value={summary.notes ?? ""}
          onChange={(e) =>
            setSummary({ ...summary, notes: e.target.value || null })
          }
        />
      </section>
      <p className="mb-3 text-sm text-ink-muted">
        Tasks are suggestions only. Nothing is created without confirmation.
      </p>
      <button
        type="button"
        className="btn btn-primary min-h-11"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            await actionUpdateConversationSummary(sessionId, summary);
            setMessage("Saved.");
            router.refresh();
          });
        }}
      >
        {pending ? "Saving…" : "Save summary edits"}
      </button>
      {message ? <p className="mt-2 text-sm text-accent">{message}</p> : null}
    </div>
  );
}
