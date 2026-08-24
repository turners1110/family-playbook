"use client";

import type { ChecklistTask } from "@/lib/types/models";
import { CHECKLIST_OWNER_LABELS, CHECKLIST_PRIORITY_LABELS } from "@/lib/checklists";
import { getTaskDetail } from "@/lib/checklists/task-details";
import { effectiveDueDate } from "@/lib/checklists/scheduling";

export function TaskDetailModal({
  task,
  onClose,
}: {
  task: ChecklistTask;
  onClose: () => void;
}) {
  const detail = getTaskDetail(task.template_task_slug);
  const due = effectiveDueDate(task);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-ink">{task.title}</h2>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="badge">{CHECKLIST_PRIORITY_LABELS[task.priority]}</span>
          <span className="badge">{CHECKLIST_OWNER_LABELS[task.owner]}</span>
          {due ? <span className="badge">Due {due}</span> : null}
          {task.completed ? <span className="badge badge-accent">Complete</span> : null}
        </div>

        {detail ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                What this is
              </p>
              <p className="mt-1 text-sm text-ink">{detail.explanation}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                Why it&apos;s here
              </p>
              <p className="mt-1 text-sm text-ink">{detail.rationale}</p>
            </div>
            {detail.tips?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  Tips
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink">
                  {detail.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            No additional context written for this task yet.
          </p>
        )}

        {task.timing_reason ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              Timing
            </p>
            <p className="mt-1 text-sm text-ink-muted">{task.timing_reason}</p>
          </div>
        ) : null}

        {task.notes ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              Your notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{task.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
