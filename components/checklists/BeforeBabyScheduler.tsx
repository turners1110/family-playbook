"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import type { PregnancyProgress } from "@/lib/checklists/date-math";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
  type ChecklistOwner,
  type ChecklistPriority,
} from "@/lib/checklists";
import {
  actionArchiveChecklistTask,
  actionGenerateBeforeBabySchedule,
  actionImportBeforeBaby,
  actionToggleChecklistTask,
  actionUpdateChecklistTask,
} from "@/lib/actions/checklists";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import { buildChecklistDashboard } from "@/lib/checklists/dashboard";
import {
  TIMELINE_BADGE_LABELS,
  effectiveDueDate,
  filterTasksByView,
  getTimelineBadge,
  groupTasksForTimeline,
  recommendedByLabel,
  type TimelineView,
} from "@/lib/checklists/scheduling";
import { DueDateHeader } from "@/components/checklists/DueDateHeader";
import { BeforeBabySchedulingSettings } from "@/components/checklists/BeforeBabySchedulingSettings";
import { MilestoneBoard } from "@/components/checklists/MilestoneBoard";
import { QuickAddTaskSheet } from "@/components/checklists/QuickAddTaskSheet";
import {
  formatRelativeTimingDisplay,
  taskOriginBadge,
} from "@/lib/checklists/manual-tasks";

type BoardMode = "milestones" | "timeline" | "owner" | "category";

const BOARD_MODES: Array<{ id: BoardMode; label: string }> = [
  { id: "milestones", label: "Milestones" },
  { id: "timeline", label: "Timeline" },
  { id: "owner", label: "Owner" },
  { id: "category", label: "Category" },
];

const VIEWS: Array<{ id: TimelineView; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "recommended", label: "Recommended timeline" },
  { id: "do_now", label: "Do now" },
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "next_week", label: "Next week" },
  { id: "next_2_weeks", label: "Next 2 weeks" },
  { id: "final_month", label: "Final month" },
  { id: "final_week", label: "Final week" },
  { id: "after_birth", label: "After birth" },
  { id: "overdue", label: "Overdue" },
  { id: "by_priority", label: "Priority" },
  { id: "by_category", label: "By category" },
  { id: "by_owner", label: "By owner" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All tasks" },
];

export function BeforeBabyScheduler({
  checklistId,
  initialTasks,
  templateTaskCount,
  settings,
  pregnancy,
}: {
  checklistId: string | null;
  initialTasks: ChecklistTask[];
  templateTaskCount: number;
  settings: FamilySettings;
  pregnancy: PregnancyProgress | null;
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
  const [boardMode, setBoardMode] = useState<BoardMode>("milestones");
  const [view, setView] = useState<TimelineView>("recommended");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const dueDate = settings.expected_due_date ?? null;
  const dashboard = useMemo(
    () => buildChecklistDashboard(optimisticTasks),
    [optimisticTasks],
  );
  const inboxCount = useMemo(
    () =>
      optimisticTasks.filter(
        (t) =>
          !t.archived &&
          !t.completed &&
          (t.inbox ||
            (t.is_custom &&
              t.owner === "unassigned" &&
              (!t.due_date || t.date_source === "none") &&
              (t.category === "inbox" || t.category === "custom"))),
      ).length,
    [optimisticTasks],
  );

  const visible = useMemo(() => {
    let list = filterTasksByView(optimisticTasks, view, dueDate, {
      includePostBirth: settings.before_baby_include_post_birth !== false,
      hideCompleted: Boolean(settings.before_baby_hide_completed),
    });
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          t.category_label.toLowerCase().includes(q) ||
          CHECKLIST_OWNER_LABELS[t.owner]?.toLowerCase().includes(q) ||
          CHECKLIST_PRIORITY_LABELS[t.priority]?.toLowerCase().includes(q) ||
          (t.relative_timing_label ?? "").toLowerCase().includes(q) ||
          (t.created_from_label ?? "").toLowerCase().includes(q) ||
          (t.linked_question_ids ?? []).some((id) => id.toLowerCase().includes(q)) ||
          (t.linked_conversation_ids ?? []).some((id) =>
            id.toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [optimisticTasks, view, dueDate, settings, query]);

  const groups = useMemo(() => {
    if (view === "by_category") {
      const map = new Map<string, ChecklistTask[]>();
      for (const t of visible) {
        if (!map.has(t.category_label)) map.set(t.category_label, []);
        map.get(t.category_label)!.push(t);
      }
      return [...map.entries()].map(([label, items]) => ({
        group: label,
        label,
        tasks: items,
      }));
    }
    if (view === "by_owner") {
      const map = new Map<string, ChecklistTask[]>();
      for (const t of visible) {
        const label = CHECKLIST_OWNER_LABELS[t.owner];
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(t);
      }
      return [...map.entries()].map(([label, items]) => ({
        group: label,
        label,
        tasks: items,
      }));
    }
    return groupTasksForTimeline(visible, dueDate).map((g) => ({
      group: g.group,
      label: g.label,
      tasks: g.tasks,
    }));
  }, [visible, view, dueDate]);

  if (!checklistId) {
    return (
      <EmptyImport
        templateTaskCount={templateTaskCount}
        onError={setError}
      />
    );
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
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
              }
            : t,
        ),
      );
      setMessage(nextCompleted ? "Task complete." : "Marked incomplete.");
    });
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await actionGenerateBeforeBabySchedule(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Schedule generated — ${result.tasksUpdated} tasks updated.`);
      window.location.reload();
    });
  }

  function importMissing() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await actionImportBeforeBaby();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.added > 0) {
        setMessage(
          `Imported ${result.added} missing default task(s). Generate schedule to place dates.`,
        );
        window.location.reload();
        return;
      }
      setMessage(
        `All ${result.totalDefaults} default Before Baby tasks are already present.`,
      );
    });
  }

  const missingDefaults = Math.max(
    0,
    templateTaskCount -
      optimisticTasks.filter((t) => t.is_default && Boolean(t.template_task_slug))
        .length,
  );

  return (
    <div className="space-y-4">
      <DueDateHeader settings={settings} pregnancy={pregnancy} />

      <section className="surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
              Before Baby
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink sm:text-3xl">
              Checklist
            </h2>
            {missingDefaults > 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                {missingDefaults} seeded default task(s) not in your checklist yet.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {checklistId ? (
              <button
                type="button"
                className="btn btn-primary hidden sm:inline-flex"
                onClick={() => setAddOpen(true)}
              >
                + Add Task
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={importMissing}
            >
              {pending ? "Importing…" : "Import missing tasks"}
            </button>
            <Link href="/before-baby/assign" className="btn btn-secondary">
              Assign owners
            </Link>
            <Link href="/after-birth" className="btn btn-secondary">
              First Month
            </Link>
            <Link href="/before-baby/plan" className="btn btn-secondary">
              Plan
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSettings((v) => !v)}
            >
              Settings
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !dueDate}
              onClick={generate}
            >
              Generate my schedule
            </button>
          </div>
        </div>
        <div className="mt-4 max-w-xl">
          <ProgressBar
            value={dashboard.percent}
            label={`${dashboard.completed} / ${dashboard.total} complete`}
          />
        </div>
      </section>

      {showSettings ? <BeforeBabySchedulingSettings settings={settings} compact /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Remaining" value={dashboard.remaining} />
        <StatCard label="Inbox" value={inboxCount} />
        <StatCard label="Overdue" value={dashboard.overdue.length} />
        <StatCard label="This week" value={dashboard.dueThisWeek.length} />
        <StatCard
          label="High priority open"
          value={optimisticTasks.filter((t) => !t.completed && (t.priority === "high" || t.priority === "critical")).length}
        />
      </div>

      {(message || error) && (
        <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-accent-strong">{message}</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {BOARD_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx(
              "btn",
              boardMode === item.id ? "btn-primary" : "btn-ghost",
            )}
            onClick={() => {
              setBoardMode(item.id);
              if (item.id === "owner") setView("by_owner");
              if (item.id === "category") setView("by_category");
              if (item.id === "timeline") setView("recommended");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {boardMode === "milestones" ? (
        <MilestoneBoard tasks={optimisticTasks} settings={settings} />
      ) : (
        <>
      <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-bg/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={clsx(
                "badge shrink-0",
                view === item.id ? "badge-accent" : "",
              )}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
        />
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const key = group.group;
          const isCollapsed = collapsed[key];
          return (
            <section key={key} className="surface overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [key]: !c[key] }))
                }
              >
                <span className="font-medium">
                  {group.label}{" "}
                  <span className="text-ink-subtle">({group.tasks.length})</span>
                </span>
                <span className="text-ink-subtle">{isCollapsed ? "+" : "−"}</span>
              </button>
              {!isCollapsed ? (
                <ul className="divide-y divide-border border-t border-border">
                  {group.tasks.map((task) => (
                    <CompactTaskRow
                      key={task.id}
                      task={task}
                      dueDate={dueDate}
                      onToggle={() => toggleOne(task)}
                      onSave={async (patch) => {
                        const result = await actionUpdateChecklistTask(task.id, patch);
                        if (!result.ok) setError(result.error);
                        else window.location.reload();
                      }}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        {groups.length === 0 ? (
          <p className="text-sm text-ink-muted">No tasks in this view.</p>
        ) : null}
      </div>
        </>
      )}

      {checklistId ? (
        <>
          <div className="h-20 sm:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 p-3 backdrop-blur sm:hidden">
            <button
              type="button"
              className="btn btn-primary min-h-12 w-full"
              onClick={() => setAddOpen(true)}
            >
              + Add Task
            </button>
          </div>
          <QuickAddTaskSheet
            open={addOpen}
            onClose={() => setAddOpen(false)}
            checklistId={checklistId}
            existingTasks={optimisticTasks}
            dueDate={dueDate}
            onCreated={(task) => {
              setTasks((prev) => [...prev, task]);
              setMessage(`Added “${task.title}”.`);
              if (task.inbox) setView("inbox");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function CompactTaskRow({
  task,
  dueDate,
  onToggle,
  onSave,
}: {
  task: ChecklistTask;
  dueDate: string | null;
  onToggle: () => void;
  onSave: (patch: {
    title?: string;
    notes?: string | null;
    due_date?: string | null;
    owner?: ChecklistOwner;
    priority?: ChecklistPriority;
    manual_timing?: { mode: "remove" } | { mode: "exact"; date: string };
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const badge = getTimelineBadge(task, dueDate);
  const due = effectiveDueDate(task);
  const why = task.timing_reason;
  const recommended = recommendedByLabel(task);

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition",
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
              "text-left font-medium",
              task.completed ? "text-ink-subtle line-through" : "text-ink",
            )}
            onClick={() => setOpen((v) => !v)}
          >
            {task.title}
          </button>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {taskOriginBadge(task) ? (
              <span
                className={clsx(
                  "badge",
                  taskOriginBadge(task) === "Manual" && "badge-accent",
                )}
              >
                {taskOriginBadge(task)}
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
            {task.date_estimated ? (
              <span className="badge">Estimated</span>
            ) : null}
          </div>
          {task.created_from_label ? (
            <p className="mt-1 text-xs text-ink-subtle">
              Created from: {task.created_from_label}
            </p>
          ) : null}
          {task.dependency_reason ? (
            <p className="mt-1 text-xs text-amber-800">{task.dependency_reason}</p>
          ) : null}
          {why ? (
            <p className="mt-1 text-xs text-ink-subtle">
              Why: {why}
            </p>
          ) : null}
          {open ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const nextDue = String(form.get("due_date") || "");
                const nextOwner = String(form.get("owner") || task.owner) as ChecklistOwner;
                const nextPriority = String(
                  form.get("priority") || task.priority,
                ) as ChecklistPriority;
                const nextTitle = String(form.get("title") || task.title);
                const nextNotes = String(form.get("notes") || "");
                startTransition(async () => {
                  await onSave({
                    title: nextTitle,
                    notes: nextNotes || null,
                    owner: nextOwner,
                    priority: nextPriority,
                    ...(nextDue
                      ? { manual_timing: { mode: "exact", date: nextDue } }
                      : {}),
                  });
                });
              }}
            >
              <label className="field">
                <span>Title</span>
                <input
                  name="title"
                  className="input"
                  defaultValue={task.title}
                />
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
                  {(["unassigned", "sam", "michelle", "both"] as const).map(
                    (o) => (
                      <option key={o} value={o}>
                        {CHECKLIST_OWNER_LABELS[o]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  name="priority"
                  className="input"
                  defaultValue={task.priority}
                >
                  {(
                    ["low", "medium", "high", "critical"] as ChecklistPriority[]
                  ).map((p) => (
                    <option key={p} value={p}>
                      {CHECKLIST_PRIORITY_LABELS[p]}
                    </option>
                  ))}
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
              {task.subtasks && task.subtasks.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {task.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span>{s.completed ? "✓" : "□"}</span>
                      <span>{s.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await onSave({ manual_timing: { mode: "remove" } });
                    })
                  }
                >
                  Remove date
                </button>
                {task.is_custom ? (
                  <button
                    type="button"
                    className="btn btn-ghost text-danger"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await actionArchiveChecklistTask(task.id);
                        window.location.reload();
                      })
                    }
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

function EmptyImport({
  templateTaskCount,
  onError,
}: {
  templateTaskCount: number;
  onError: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="surface space-y-4 p-6">
      <h2 className="font-display text-2xl">Start Before Baby</h2>
      <p className="text-ink-muted">
        Import {templateTaskCount} default prep tasks, then set your due date to
        build a timeline.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await actionImportBeforeBaby();
            if (!result.ok) {
              onError(result.error);
              return;
            }
            window.location.href = "/before-baby";
          });
        }}
      >
        {pending ? "Importing…" : "Import Before Baby checklist"}
      </button>
    </section>
  );
}
