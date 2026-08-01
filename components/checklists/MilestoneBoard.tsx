"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import { buildMilestoneViews } from "@/lib/checklists/milestones";
import { CHECKLIST_OWNER_LABELS } from "@/lib/checklists";
import {
  actionSetDependencyOverride,
  actionToggleChecklistTask,
} from "@/lib/actions/checklists";

export function MilestoneBoard({
  tasks: initialTasks,
  settings,
}: {
  tasks: ChecklistTask[];
  settings: FamilySettings;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const due = settings.expected_due_date ?? null;

  const milestones = useMemo(
    () => buildMilestoneViews(tasks, due),
    [tasks, due],
  );

  async function toggle(taskId: string, completed: boolean) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    await actionToggleChecklistTask(taskId, completed);
  }

  async function overrideDep(taskId: string) {
    await actionSetDependencyOverride(taskId, true);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              dependency_override: true,
              dependency_status: "overridden",
              blocked_by_count: 0,
            }
          : t,
      ),
    );
  }

  return (
    <div className="space-y-4">
      {milestones.map((ms) => {
        const expanded = open[ms.def.id] ?? false;
        return (
          <section key={ms.def.id} className="surface p-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() =>
                setOpen((s) => ({ ...s, [ms.def.id]: !expanded }))
              }
            >
              <div>
                <h3 className="font-display text-xl">{ms.def.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{ms.def.description}</p>
                <p className="mt-2 text-xs text-ink-subtle">
                  Owner: {CHECKLIST_OWNER_LABELS[ms.primary_owner]}
                  {ms.contributor
                    ? ` · Contributor: ${CHECKLIST_OWNER_LABELS[ms.contributor]}`
                    : ""}
                  {ms.target_label ? ` · ${ms.target_label}` : ""}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">{ms.def.timing_reason}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold">{ms.percent}%</div>
                <div className="text-xs text-ink-subtle">
                  {ms.complete}/{ms.steps.length || ms.total} steps
                </div>
                {ms.blocked_count > 0 ? (
                  <div className="mt-1 text-xs text-amber-700">
                    {ms.blocked_count} blocked
                  </div>
                ) : null}
              </div>
            </button>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${ms.percent}%` }}
              />
            </div>

            {ms.next_action ? (
              <p className="mt-3 text-sm">
                Next: <span className="font-medium">{ms.next_action.title}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">All mapped steps complete.</p>
            )}

            {ms.notes ? (
              <p className="mt-2 text-xs text-ink-subtle">Notes: {ms.notes}</p>
            ) : null}

            {expanded ? (
              <ul className="mt-4 space-y-2 border-t border-border pt-3">
                {ms.steps.map((step) => (
                  <li
                    key={step.id}
                    className={clsx(
                      "rounded-xl border px-3 py-2",
                      step.dependency_status === "blocked"
                        ? "border-amber-300 bg-amber-50/50"
                        : "border-border",
                    )}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={step.completed}
                        onChange={(e) => toggle(step.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{step.title}</span>
                        {step.dependency_reason ? (
                          <span className="mt-1 block text-xs text-amber-800">
                            {step.dependency_reason}
                          </span>
                        ) : null}
                        {step.dependency_status === "blocked" ? (
                          <button
                            type="button"
                            className="mt-1 text-xs underline"
                            onClick={() => overrideDep(step.id)}
                          >
                            Override block (with caution)
                          </button>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
                {ms.missing_slugs.length ? (
                  <li className="text-xs text-ink-subtle">
                    Use “Import missing tasks” above to add{" "}
                    {ms.missing_slugs.length} mapped step(s).
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
