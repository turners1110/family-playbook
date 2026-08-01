"use client";

import { useState, useTransition } from "react";
import type { SuggestedTaskPreview } from "@/lib/essentials/task-suggestions";
import { actionApplyEssentialsTaskSuggestions } from "@/lib/actions/essentials";

export function TaskSuggestionPreview({
  suggestions,
}: {
  suggestions: SuggestedTaskPreview[];
}) {
  const open = suggestions.filter((s) => !s.already_present);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const s of open) next[s.id] = true;
    return next;
  });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (!suggestions.length) return null;

  return (
    <section className="surface space-y-3 p-4">
      <h2 className="font-display text-xl">Suggested checklist tasks</h2>
      <p className="text-sm text-ink-muted">
        Preview only. Nothing is added until you confirm.
      </p>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-xl border border-border px-3 py-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                disabled={s.already_present}
                checked={s.already_present ? false : Boolean(selected[s.id])}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium">{s.title}</span>
                <span className="mt-1 block text-xs text-ink-subtle">
                  From: {s.screen_title}. {s.reason}
                  {s.already_present ? " · Already on checklist" : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || open.every((s) => !selected[s.id])}
          onClick={() =>
            startTransition(async () => {
              const ids = Object.entries(selected)
                .filter(([, on]) => on)
                .map(([id]) => id);
              const result = await actionApplyEssentialsTaskSuggestions(ids);
              if (!result.ok) setMessage(result.error);
              else setMessage(`Added ${result.added} task(s) to Before Baby.`);
            })
          }
        >
          Add selected tasks
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setSelected({})}
        >
          Skip tasks
        </button>
      </div>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </section>
  );
}
