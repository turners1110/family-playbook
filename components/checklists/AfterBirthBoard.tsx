"use client";

import { useMemo, useState, useTransition } from "react";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import {
  actionImportAfterBirth,
  actionPreviewActualBirthDate,
  actionSetActualBirthDate,
  actionToggleChecklistTask,
} from "@/lib/actions/checklists";
import { effectiveDueDate } from "@/lib/checklists/scheduling";

const SECTION_ORDER = [
  "first_72h",
  "first_week",
  "week_two",
  "weeks_3_4",
  "six_week",
];

export function AfterBirthBoard({
  checklistId,
  initialTasks,
  templateTaskCount,
  settings: initialSettings,
}: {
  checklistId: string | null;
  initialTasks: ChecklistTask[];
  templateTaskCount: number;
  settings: FamilySettings;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [settings, setSettings] = useState(initialSettings);
  const [birthInput, setBirthInput] = useState(
    initialSettings.actual_birth_date ?? "",
  );
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, ChecklistTask[]>();
    for (const t of tasks) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((slug) => ({
      slug,
      label: map.get(slug)![0]!.category_label,
      tasks: map.get(slug)!,
    }));
  }, [tasks]);

  function toggle(taskId: string, completed: boolean) {
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
    startTransition(async () => {
      await actionToggleChecklistTask(taskId, completed);
    });
  }

  return (
    <div className="space-y-5">
      <section className="surface space-y-3 p-4">
        <h2 className="font-display text-xl">Actual birth date</h2>
        <p className="text-sm text-ink-muted">
          Before birth, post-birth dates are estimated from the due date. After
          you set the actual birth date, non-manual post-birth tasks recalculate.
          Completed and manual dates stay put.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Birth date
            <input
              type="date"
              className="mt-1 block rounded-lg border border-border px-3 py-2"
              value={birthInput}
              onChange={(e) => setBirthInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!birthInput || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await actionPreviewActualBirthDate(birthInput);
                if (!result.ok) {
                  setPreviewText(result.error);
                  return;
                }
                const p = result.preview;
                setPreviewText(
                  `${p.dates_moving} post-birth task dates will move. ${p.manual_unchanged} manual dates unchanged. ${p.completed_unchanged} completed tasks unchanged.`,
                );
              })
            }
          >
            Preview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!birthInput || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await actionSetActualBirthDate(birthInput, true);
                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }
                setSettings(result.settings);
                setMessage(
                  `Saved birth date. Updated ${result.tasksUpdated} post-birth dates.`,
                );
                setPreviewText(null);
              })
            }
          >
            Set actual birth date
          </button>
        </div>
        {previewText ? <p className="text-sm text-ink-muted">{previewText}</p> : null}
        {settings.actual_birth_date ? (
          <p className="text-xs text-ink-subtle">
            Current actual birth date: {settings.actual_birth_date}
          </p>
        ) : (
          <p className="text-xs text-ink-subtle">
            Using expected due date estimates
            {settings.expected_due_date
              ? ` (${settings.expected_due_date})`
              : ""}
            .
          </p>
        )}
        {message ? <p className="text-sm">{message}</p> : null}
      </section>

      {!checklistId || tasks.length < templateTaskCount ? (
        <section className="surface p-4">
          <p className="text-sm text-ink-muted">
            First Month template has {templateTaskCount} planning tasks.
            {tasks.length ? ` ${tasks.length} already imported.` : ""}
          </p>
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await actionImportAfterBirth();
                if (result.ok) {
                  setMessage(`Added ${result.added} First Month tasks.`);
                  window.location.reload();
                } else setMessage(result.error);
              })
            }
          >
            Import First Month tasks
          </button>
        </section>
      ) : null}

      <p className="text-sm text-ink-muted">
        Planning reminders only — not a medical tracker. Items that depend on
        clinical advice are labeled Confirm with provider.
      </p>

      {groups.map((group) => (
        <section key={group.slug} className="surface p-4">
          <h3 className="font-display text-xl">{group.label}</h3>
          <ul className="mt-3 space-y-2">
            {group.tasks.map((task) => {
              const due = effectiveDueDate(task);
              return (
                <li key={task.id} className="rounded-xl border border-border px-3 py-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={task.completed}
                      onChange={(e) => toggle(task.id, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{task.title}</span>
                      <span className="mt-1 block text-xs text-ink-subtle">
                        {due
                          ? task.date_estimated
                            ? `Estimated ${due} (from due date)`
                            : `Target ${due}`
                          : "No date yet"}
                        {task.provider_confirmation_needed
                          ? " · Confirm with provider"
                          : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
