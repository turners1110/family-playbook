"use client";

import { useState } from "react";
import type { SuggestedTaskPreview } from "@/lib/essentials/task-suggestions";
import { actionApplyEssentialsTaskSuggestions } from "@/lib/actions/essentials";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  RetrySavePanel,
  SaveButton,
  SlowSaveNotice,
} from "@/components/ui/save-feedback";

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
  const save = useSaveFeedback();

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
                disabled={s.already_present || save.isBusy}
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
      <SlowSaveNotice tier={save.slowTier} />
      <RetrySavePanel
        state={save.state}
        message={save.statusMessage}
        onRetry={() => void save.retry()}
        disabled={save.isBusy}
      />
      <p className="sr-only" aria-live="polite">
        {save.statusMessage}
      </p>
      <div className="flex flex-wrap gap-2">
        <SaveButton
          state={save.state}
          idleLabel="Add selected tasks"
          disabled={open.every((s) => !selected[s.id])}
          onClick={() =>
            void save.runSave(
              async () => {
                const ids = Object.entries(selected)
                  .filter(([, on]) => on)
                  .map(([id]) => id);
                const result = await actionApplyEssentialsTaskSuggestions(ids);
                if (!result.ok) {
                  const err = new Error(result.error);
                  throw err;
                }
                setMessage(`Added ${result.added} task(s) to Before Baby.`);
              },
              {
                operation: "confirm_task_suggestions",
                route: "/questions/before-birth",
              },
            )
          }
        />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={save.isBusy}
          onClick={() => setSelected({})}
        >
          Skip tasks
        </button>
      </div>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </section>
  );
}
