"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { ChecklistTask } from "@/lib/types/models";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
  type ChecklistOwner,
  type ChecklistPriority,
} from "@/lib/checklists";
import {
  actionAddCustomChecklistTask,
  actionArchiveChecklistTask,
  actionBulkCompleteChecklistTasks,
  actionImportBeforeBaby,
  actionToggleChecklistTask,
  actionUpdateChecklistTask,
} from "@/lib/actions/checklists";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import {
  buildChecklistDashboard,
  groupTasksByCategory,
} from "@/lib/checklists/dashboard";
import { clsx } from "clsx";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import { saveButtonIdleLabel } from "@/lib/ui/save-feedback";
import { SaveStatus } from "@/components/ui/save-feedback";

type FilterStatus = "all" | "open" | "done" | "overdue";
type SortMode = "category" | "due" | "priority" | "title";

const PRIORITY_RANK: Record<ChecklistPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function BeforeBabyBoard({
  checklistId,
  initialTasks,
  templateTaskCount,
}: {
  checklistId: string | null;
  initialTasks: ChecklistTask[];
  templateTaskCount: number;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (current, update: { ids: string[]; completed: boolean }) =>
      current.map((task) =>
        update.ids.includes(task.id)
          ? {
              ...task,
              completed: update.completed,
              completed_at: update.completed ? new Date().toISOString() : null,
            }
          : task,
      ),
  );
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [owner, setOwner] = useState<"all" | ChecklistOwner>("all");
  const [priority, setPriority] = useState<"all" | ChecklistPriority>("all");
  const [sort, setSort] = useState<SortMode>("category");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ ids: string[]; completed: boolean } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboard = useMemo(
    () => buildChecklistDashboard(optimisticTasks),
    [optimisticTasks],
  );

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let list = [...optimisticTasks];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          t.category_label.toLowerCase().includes(q),
      );
    }
    if (owner !== "all") list = list.filter((t) => t.owner === owner);
    if (priority !== "all") list = list.filter((t) => t.priority === priority);
    if (status === "open") list = list.filter((t) => !t.completed);
    if (status === "done") list = list.filter((t) => t.completed);
    if (status === "overdue") {
      list = list.filter(
        (t) => !t.completed && t.due_date && t.due_date < today,
      );
    }

    if (sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "due") {
      list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return a.title.localeCompare(b.title);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    } else if (sort === "priority") {
      list.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.title.localeCompare(b.title),
      );
    } else {
      list.sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.title.localeCompare(b.title),
      );
    }
    return list;
  }, [optimisticTasks, query, owner, priority, status, sort]);

  const groups = useMemo(() => groupTasksByCategory(filtered), [filtered]);

  function syncTasks(next: ChecklistTask[]) {
    setTasks(next);
  }

  function toggleOne(task: ChecklistTask) {
    const nextCompleted = !task.completed;
    setError(null);
    startTransition(async () => {
      applyOptimistic({ ids: [task.id], completed: nextCompleted });
      const result = await actionToggleChecklistTask(task.id, nextCompleted);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      syncTasks(
        tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
              }
            : t,
        ),
      );
      setUndo({ ids: [task.id], completed: !nextCompleted });
      setMessage(nextCompleted ? "Nice — task complete." : "Marked incomplete.");
    });
  }

  function bulkComplete(completed: boolean) {
    const ids = [...selected];
    if (!ids.length) return;
    setError(null);
    startTransition(async () => {
      applyOptimistic({ ids, completed });
      const result = await actionBulkCompleteChecklistTasks(ids, completed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      syncTasks(
        tasks.map((t) =>
          ids.includes(t.id)
            ? {
                ...t,
                completed,
                completed_at: completed ? new Date().toISOString() : null,
              }
            : t,
        ),
      );
      setUndo({ ids, completed: !completed });
      setSelected(new Set());
      setMessage(
        completed
          ? `Completed ${result.count} task${result.count === 1 ? "" : "s"}.`
          : `Reopened ${result.count} task${result.count === 1 ? "" : "s"}.`,
      );
    });
  }

  function undoLast() {
    if (!undo) return;
    const { ids, completed } = undo;
    startTransition(async () => {
      applyOptimistic({ ids, completed });
      await actionBulkCompleteChecklistTasks(ids, completed);
      syncTasks(
        tasks.map((t) =>
          ids.includes(t.id)
            ? {
                ...t,
                completed,
                completed_at: completed ? new Date().toISOString() : null,
              }
            : t,
        ),
      );
      setUndo(null);
      setMessage("Undone.");
    });
  }

  if (!checklistId) {
    return (
      <EmptyImport
        templateTaskCount={templateTaskCount}
        onImported={(added, id) => {
          setMessage(
            added > 0
              ? `Imported ${added} Before Baby tasks.`
              : "Before Baby checklist is ready.",
          );
          // Soft reload via navigation
          window.location.href = "/before-baby";
          void id;
        }}
        onError={setError}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          Before Baby
        </p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
          You&apos;re getting ready — one calm step at a time.
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Track hospital, home, gear, paperwork, and final-week essentials. Check
          things off together and keep momentum without the stress spiral.
        </p>
        <div className="mt-6 max-w-xl">
          <ProgressBar
            value={dashboard.percent}
            label={`${dashboard.completed} / ${dashboard.total} complete`}
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall"
          value={`${dashboard.completed}/${dashboard.total}`}
          hint={`${dashboard.percent}% done`}
        />
        <StatCard
          label="Overdue"
          value={dashboard.overdue.length}
          hint={dashboard.overdue[0]?.title}
        />
        <StatCard
          label="This week"
          value={dashboard.dueThisWeek.length}
          hint={dashboard.dueThisWeek[0]?.title}
        />
        <StatCard
          label="Recently done"
          value={dashboard.recentlyCompleted.length}
          hint={dashboard.recentlyCompleted[0]?.title}
        />
      </div>

      {(message || error || undo) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-accent-strong">{message}</span>
          )}
          {undo && (
            <button type="button" className="btn btn-ghost" onClick={undoLast}>
              Undo
            </button>
          )}
        </div>
      )}

      <section className="surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="field">
              <span>Search</span>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a task…"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as FilterStatus)}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="done">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label className="field">
              <span>Owner</span>
              <select
                className="input"
                value={owner}
                onChange={(e) =>
                  setOwner(e.target.value as "all" | ChecklistOwner)
                }
              >
                <option value="all">Anyone</option>
                <option value="sam">Sam</option>
                <option value="michelle">Michelle</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select
                className="input"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "all" | ChecklistPriority)
                }
              >
                <option value="all">Any</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="field">
              <span>Sort</span>
              <select
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
              >
                <option value="category">Category</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending || selected.size === 0}
              onClick={() => bulkComplete(true)}
            >
              Bulk complete
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending || selected.size === 0}
              onClick={() => bulkComplete(false)}
            >
              Bulk reopen
            </button>
          </div>
        </div>
      </section>

      <AddCustomTaskForm
        checklistId={checklistId}
        onAdded={() => {
          window.location.reload();
        }}
      />

      <div className="space-y-4">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.slug];
          return (
            <section key={group.slug} className="surface overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [group.slug]: !prev[group.slug],
                  }))
                }
              >
                <div>
                  <h3 className="font-display text-xl text-ink">{group.label}</h3>
                  <p className="text-sm text-ink-muted">
                    {group.completed} / {group.total} complete
                  </p>
                </div>
                <span className="text-sm text-ink-subtle">
                  {isCollapsed ? "Expand" : "Collapse"}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="divide-y divide-border border-t border-border">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selected.has(task.id)}
                      onSelect={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(task.id);
                          else next.delete(task.id);
                          return next;
                        });
                      }}
                      onToggle={() => toggleOne(task)}
                      onSave={async (patch) => {
                        const result = await actionUpdateChecklistTask(
                          task.id,
                          patch,
                        );
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        syncTasks(
                          tasks.map((t) =>
                            t.id === task.id ? { ...t, ...patch } : t,
                          ),
                        );
                      }}
                      onArchive={async () => {
                        const result = await actionArchiveChecklistTask(task.id);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        syncTasks(tasks.filter((t) => t.id !== task.id));
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && (
          <div className="surface px-6 py-10 text-center text-ink-muted">
            No tasks match these filters.
          </div>
        )}
      </div>

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl">Need the defaults again?</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Import only adds missing template tasks. Custom tasks are never
              overwritten.
            </p>
          </div>
          <ImportButton
            label="Import missing defaults"
            onDone={(added) => {
              setMessage(
                added > 0
                  ? `Added ${added} missing default tasks.`
                  : "You already have every default task.",
              );
              if (added > 0) window.location.reload();
            }}
            onError={setError}
          />
        </div>
      </section>
    </div>
  );
}

function EmptyImport({
  templateTaskCount,
  onImported,
  onError,
}: {
  templateTaskCount: number;
  onImported: (added: number, checklistId: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="surface px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        Before Baby
      </p>
      <h2 className="mt-2 font-display text-3xl text-ink">
        Start your pre-baby checklist
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-ink-muted">
        Import {templateTaskCount} practical tasks across hospital, medical, home,
        gear, paperwork, and more. You can add unlimited custom tasks afterward.
      </p>
      <div className="mt-6 flex justify-center">
        <ImportButton
          label="Import Default Before Baby Checklist"
          primary
          onDone={(added, checklistId) => onImported(added, checklistId ?? "")}
          onError={onError}
        />
      </div>
    </div>
  );
}

function ImportButton({
  label,
  primary,
  onDone,
  onError,
}: {
  label: string;
  primary?: boolean;
  onDone: (added: number, checklistId?: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={clsx("btn", primary ? "btn-primary" : "btn-secondary")}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await actionImportBeforeBaby();
          if (!result.ok) {
            onError(result.error);
            return;
          }
          onDone(result.added, result.checklistId);
        });
      }}
    >
      {pending ? "Importing…" : label}
    </button>
  );
}

function AddCustomTaskForm({
  checklistId,
  onAdded,
}: {
  checklistId: string;
  onAdded: () => void;
}) {
  const save = useSaveFeedback();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
      >
        Add custom task
      </button>
    );
  }

  return (
    <form
      className="surface space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const title = String(formData.get("title") ?? "").trim();
        if (!title) {
          setError("Add a task title.");
          return;
        }
        setError(null);
        void save.runSave(
          async () => {
            const result = await actionAddCustomChecklistTask({
              checklistId,
              title,
              notes: String(formData.get("notes") ?? "") || null,
              due_date: String(formData.get("due_date") ?? "") || null,
              owner: String(formData.get("owner") ?? "both") as ChecklistOwner,
              priority: String(
                formData.get("priority") ?? "medium",
              ) as ChecklistPriority,
              category: "custom",
              category_label: "Custom",
            });
            if (!result.ok) {
              throw new Error(result.error);
            }
            return result;
          },
          {
            operation: "add_checklist_task",
            route: "/before-baby",
            onSuccess: async () => {
              onAdded();
              form.reset();
            },
          },
        );
      }}
    >
      <h3 className="font-display text-xl">Custom task</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          <span>Title</span>
          <input name="title" className="input" required placeholder="Buy extra burp cloths" />
        </label>
        <label className="field">
          <span>Due date</span>
          <input name="due_date" type="date" className="input" />
        </label>
        <label className="field">
          <span>Owner</span>
          <select name="owner" className="input" defaultValue="both">
            <option value="sam">Sam</option>
            <option value="michelle">Michelle</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select name="priority" className="input" defaultValue="medium">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          <span>Notes</span>
          <textarea name="notes" className="input min-h-20" />
        </label>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <SaveStatus
        state={save.state}
        message={save.statusMessage}
        slowTier={save.slowTier}
        onRetry={() => void save.retry()}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={save.isBusy}
          aria-busy={save.isBusy}
        >
          {saveButtonIdleLabel(save.state, "Add task")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
  onToggle,
  onSave,
  onArchive,
}: {
  task: ChecklistTask;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggle: () => void;
  onSave: (patch: {
    notes?: string | null;
    due_date?: string | null;
    owner?: ChecklistOwner;
    priority?: ChecklistPriority;
  }) => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(
    !task.completed && task.due_date && task.due_date < today,
  );

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${task.title}`}
        />
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition",
            task.completed
              ? "border-accent bg-accent text-white"
              : "border-border bg-bg hover:border-accent",
          )}
          aria-label={task.completed ? "Mark incomplete" : "Quick complete"}
        >
          {task.completed ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={clsx(
                "text-left font-medium",
                task.completed ? "text-ink-subtle line-through" : "text-ink",
              )}
              onClick={() => setExpanded((v) => !v)}
            >
              {task.title}
            </button>
            {task.is_custom && <span className="badge">Custom</span>}
            <span className="badge">{CHECKLIST_OWNER_LABELS[task.owner]}</span>
            <span
              className={clsx(
                "badge",
                task.priority === "high" ? "badge-warning" : "",
              )}
            >
              {CHECKLIST_PRIORITY_LABELS[task.priority]}
            </span>
            {task.due_date && (
              <span className={clsx("badge", overdue ? "badge-danger" : "")}>
                Due {task.due_date}
              </span>
            )}
          </div>
          {task.notes && !expanded && (
            <p className="mt-1 truncate text-sm text-ink-muted">{task.notes}</p>
          )}
          {expanded && (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                startTransition(async () => {
                  await onSave({
                    notes: String(form.get("notes") ?? "") || null,
                    due_date: String(form.get("due_date") ?? "") || null,
                    owner: String(form.get("owner") ?? task.owner) as ChecklistOwner,
                    priority: String(
                      form.get("priority") ?? task.priority,
                    ) as ChecklistPriority,
                  });
                  setExpanded(false);
                });
              }}
            >
              <label className="field">
                <span>Due date</span>
                <input
                  name="due_date"
                  type="date"
                  className="input"
                  defaultValue={task.due_date ?? ""}
                />
              </label>
              <label className="field">
                <span>Owner</span>
                <select
                  name="owner"
                  className="input"
                  defaultValue={task.owner}
                >
                  <option value="sam">Sam</option>
                  <option value="michelle">Michelle</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  name="priority"
                  className="input"
                  defaultValue={task.priority}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="field sm:col-span-3">
                <span>Notes</span>
                <textarea
                  name="notes"
                  className="input min-h-20"
                  defaultValue={task.notes ?? ""}
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setExpanded(false)}
                >
                  Close
                </button>
                {task.is_custom && (
                  <button
                    type="button"
                    className="btn btn-ghost text-danger"
                    onClick={() => startTransition(() => onArchive())}
                  >
                    Archive
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
