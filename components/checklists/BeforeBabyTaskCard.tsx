"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { ChecklistTask } from "@/lib/types/models";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
  type ChecklistOwner,
  type ChecklistPriority,
} from "@/lib/checklists";
import {
  TIMELINE_BADGE_LABELS,
  effectiveDueDate,
  getTimelineBadge,
  recommendedByLabel,
} from "@/lib/checklists/scheduling";
import {
  formatRelativeTimingDisplay,
  taskOriginBadge,
} from "@/lib/checklists/manual-tasks";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import { SaveStatus } from "@/components/ui/save-feedback";
import { saveButtonIdleLabel } from "@/lib/ui/save-feedback";
import {
  actionArchiveChecklistTask,
  actionUpdateChecklistTask,
} from "@/lib/actions/checklists";

export function BeforeBabyTaskCard({
  task,
  dueDate,
  onToggle,
  onReconcile,
}: {
  task: ChecklistTask;
  dueDate: string | null;
  onToggle: () => void;
  onReconcile: (tasks: ChecklistTask[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const save = useSaveFeedback();
  const badge = getTimelineBadge(task, dueDate);
  const due = effectiveDueDate(task);
  const why = task.timing_reason;
  const recommended = recommendedByLabel(task);
  const origin = taskOriginBadge(task);
  const urgency =
    badge === "overdue"
      ? "border-l-4 border-l-danger"
      : badge === "do_now"
        ? "border-l-4 border-l-accent"
        : "";

  return (
    <li className={clsx("px-3 py-3 sm:px-4", urgency)}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={save.isBusy}
          className={clsx(
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg transition",
            task.completed
              ? "border-accent bg-accent text-white"
              : "border-border bg-bg hover:border-accent",
          )}
          aria-label={task.completed ? "Mark incomplete" : "Complete"}
        >
          {task.completed ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className={clsx(
              "min-h-11 text-left font-medium",
              task.completed ? "text-ink-subtle line-through" : "text-ink",
            )}
            onClick={() => setOpen((v) => !v)}
          >
            {task.title}
          </button>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {origin ? (
              <span className={clsx("badge", origin === "Manual" && "badge-accent")}>
                {origin}
              </span>
            ) : null}
            {task.inbox ? <span className="badge badge-warning">Inbox</span> : null}
            <span className="badge">{TIMELINE_BADGE_LABELS[badge]}</span>
            <span className="badge">{CHECKLIST_OWNER_LABELS[task.owner]}</span>
            {task.priority === "high" || task.priority === "critical" ? (
              <span className="badge badge-warning">
                {CHECKLIST_PRIORITY_LABELS[task.priority]}
              </span>
            ) : null}
            {formatRelativeTimingDisplay(task) ? (
              <span className="badge">{formatRelativeTimingDisplay(task)}</span>
            ) : recommended ? (
              <span className="badge">{recommended}</span>
            ) : null}
            {task.dependency_status === "blocked" ? (
              <span className="badge badge-warning">Blocked</span>
            ) : null}
            {task.provider_confirmation_needed ? (
              <span className="badge">Confirm with provider</span>
            ) : null}
          </div>
          {task.dependency_reason ? (
            <p className="mt-1 text-xs text-ink-muted">{task.dependency_reason}</p>
          ) : null}
          {why ? <p className="mt-1 text-xs text-ink-subtle">Why: {why}</p> : null}
          {open ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const nextDue = String(form.get("due_date") || "");
                void save.runSave(
                  async () => {
                    const result = await actionUpdateChecklistTask(task.id, {
                      title: String(form.get("title") || task.title),
                      notes: String(form.get("notes") || "") || null,
                      owner: String(form.get("owner") || task.owner) as ChecklistOwner,
                      priority: String(
                        form.get("priority") || task.priority,
                      ) as ChecklistPriority,
                      ...(nextDue
                        ? { manual_timing: { mode: "exact" as const, date: nextDue } }
                        : {}),
                    });
                    if (!result.ok) throw new Error(result.error);
                    return result;
                  },
                  {
                    operation: "update_checklist_task",
                    route: "/before-baby",
                    onSuccess: async (result) => {
                      const payload = result as { tasks?: ChecklistTask[] };
                      if (payload.tasks) onReconcile(payload.tasks);
                      setOpen(false);
                    },
                  },
                );
              }}
            >
              <label className="field">
                <span>Title</span>
                <input name="title" className="input" defaultValue={task.title} />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  name="notes"
                  className="input min-h-16"
                  defaultValue={task.notes ?? ""}
                />
              </label>
              <label className="field">
                <span>Owner</span>
                <select name="owner" className="input" defaultValue={task.owner}>
                  {(["unassigned", "sam", "michelle", "both"] as const).map((o) => (
                    <option key={o} value={o}>
                      {CHECKLIST_OWNER_LABELS[o]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select name="priority" className="input" defaultValue={task.priority}>
                  {(["low", "medium", "high", "critical"] as ChecklistPriority[]).map(
                    (p) => (
                      <option key={p} value={p}>
                        {CHECKLIST_PRIORITY_LABELS[p]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                <span>Manual due date</span>
                <input
                  name="due_date"
                  type="date"
                  className="input"
                  defaultValue={due ?? ""}
                />
              </label>
              <SaveStatus
                state={save.state}
                message={save.statusMessage}
                slowTier={save.slowTier}
                onRetry={() => void save.retry()}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn btn-primary min-h-11"
                  disabled={save.isBusy}
                >
                  {saveButtonIdleLabel(save.state, "Save")}
                </button>
                {task.is_custom ? (
                  <button
                    type="button"
                    className="btn btn-ghost text-danger min-h-11"
                    disabled={save.isBusy}
                    onClick={() => {
                      if (!confirm(`Delete “${task.title}”?`)) return;
                      void save.runSave(
                        async () => {
                          const result = await actionArchiveChecklistTask(task.id);
                          if (!result.ok) throw new Error(result.error);
                          return result;
                        },
                        {
                          operation: "archive_checklist_task",
                          route: "/before-baby",
                          onSuccess: async (result) => {
                            const payload = result as { tasks?: ChecklistTask[] };
                            if (payload.tasks) onReconcile(payload.tasks);
                          },
                        },
                      );
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
