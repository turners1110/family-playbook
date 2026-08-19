"use client";

import { Suspense, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ChecklistTask, FamilySettings } from "@/lib/types/models";
import type { PregnancyProgress } from "@/lib/checklists/date-math";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
} from "@/lib/checklists";
import {
  actionGenerateBeforeBabySchedule,
  actionImportBeforeBaby,
  actionToggleChecklistTask,
} from "@/lib/actions/checklists";
import { ProgressBar, StatCard } from "@/components/shared/ui";
import { buildChecklistDashboard } from "@/lib/checklists/dashboard";
import {
  filterTasksByView,
  groupTasksForTimeline,
} from "@/lib/checklists/scheduling";
import {
  buildBeforeBabyAttention,
  type AttentionTask,
} from "@/lib/checklists/attention";
import { ADVANCED_FILTERS } from "@/lib/checklists/view-state";
import { DueDateHeader } from "@/components/checklists/DueDateHeader";
import { BeforeBabySchedulingSettings } from "@/components/checklists/BeforeBabySchedulingSettings";
import { MilestoneBoard } from "@/components/checklists/MilestoneBoard";
import { QuickAddTaskSheet } from "@/components/checklists/QuickAddTaskSheet";
import { BeforeBabyTaskCard } from "@/components/checklists/BeforeBabyTaskCard";
import {
  BeforeBabyAttentionSummary,
  BeforeBabyCaughtUp,
} from "@/components/checklists/BeforeBabyAttentionSummary";
import { useBeforeBabyViewState } from "@/hooks/useBeforeBabyViewState";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import { SaveStatus } from "@/components/ui/save-feedback";
import { saveButtonIdleLabel } from "@/lib/ui/save-feedback";

export function BeforeBabyScheduler(props: {
  checklistId: string | null;
  initialTasks: ChecklistTask[];
  templateTaskCount: number;
  settings: FamilySettings;
  pregnancy: PregnancyProgress | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading checklist…</p>}>
      <BeforeBabySchedulerInner {...props} />
    </Suspense>
  );
}

function BeforeBabySchedulerInner({
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
  const save = useSaveFeedback();
  const [, startTransition] = useTransition();
  const { state, setDisplayMode, setGroupBy, setFilter, setTimeline } =
    useBeforeBabyViewState();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const dueDate = settings.expected_due_date ?? null;

  const dashboard = useMemo(
    () => buildChecklistDashboard(optimisticTasks),
    [optimisticTasks],
  );
  const attention = useMemo(
    () => buildBeforeBabyAttention({ tasks: optimisticTasks, settings }),
    [optimisticTasks, settings],
  );

  const visible = useMemo(() => {
    if (state.displayMode === "attention") return optimisticTasks;
    let list = filterTasksByView(
      optimisticTasks,
      state.filter === "attention" ? "all" : state.filter,
      dueDate,
      {
        includePostBirth: settings.before_baby_include_post_birth !== false,
        hideCompleted: Boolean(settings.before_baby_hide_completed),
      },
    );
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((t) => matchesQuery(t, q));
    return list;
  }, [optimisticTasks, state, dueDate, settings, query]);

  const groups = useMemo(() => {
    if (state.displayMode === "attention") return [];
    if (state.groupBy === "category") {
      return groupByLabel(visible, (t) => t.category_label);
    }
    if (state.groupBy === "owner") {
      return groupByLabel(visible, (t) => CHECKLIST_OWNER_LABELS[t.owner]);
    }
    return groupTasksForTimeline(visible, dueDate).map((g) => ({
      group: g.group,
      label: g.label,
      tasks: g.tasks,
    }));
  }, [visible, state, dueDate]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return optimisticTasks.filter((t) => matchesQuery(t, q));
  }, [optimisticTasks, query]);

  if (!checklistId) {
    return (
      <EmptyImport
        templateTaskCount={templateTaskCount}
        onImported={(next) => setTasks(next)}
      />
    );
  }

  function reconcile(next: ChecklistTask[]) {
    setTasks(next);
  }

  function toggleOne(task: ChecklistTask) {
    const nextCompleted = !task.completed;
    startTransition(() => {
      applyOptimistic({ ids: [task.id], completed: nextCompleted });
    });
    void save.runSave(
      async () => {
        const result = await actionToggleChecklistTask(task.id, nextCompleted);
        if (!result.ok) throw new Error(result.error);
        return result;
      },
      {
        operation: "toggle_checklist_task",
        route: "/before-baby",
        onSuccess: async (result) => {
          const payload = result as { tasks?: ChecklistTask[] };
          if (payload.tasks) reconcile(payload.tasks);
        },
      },
    );
  }

  function generate() {
    void save.runSave(
      async () => {
        const result = await actionGenerateBeforeBabySchedule(false);
        if (!result.ok) throw new Error(result.error);
        return result;
      },
      {
        operation: "generate_before_baby_schedule",
        route: "/before-baby",
        onSuccess: async (result) => {
          const payload = result as { tasks?: ChecklistTask[] };
          if (payload.tasks) reconcile(payload.tasks);
        },
      },
    );
  }

  function importMissing() {
    void save.runSave(
      async () => {
        const result = await actionImportBeforeBaby();
        if (!result.ok) throw new Error(result.error);
        return result;
      },
      {
        operation: "import_before_baby",
        route: "/before-baby",
        onSuccess: async (result) => {
          const payload = result as { tasks?: ChecklistTask[] };
          if (payload.tasks) reconcile(payload.tasks);
        },
      },
    );
  }

  const missingDefaults = Math.max(
    0,
    templateTaskCount -
      optimisticTasks.filter((t) => t.is_default && Boolean(t.template_task_slug))
        .length,
  );
  const attentionEmpty =
    attention.overdue.length +
      attention.needsAttentionNow.length +
      attention.thisWeek.length ===
    0;

  return (
    <div className="space-y-4">
      <DueDateHeader settings={settings} pregnancy={pregnancy} />
      <BeforeBabyAttentionSummary attention={attention} />

      <section className="surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">Checklist</h2>
            {missingDefaults > 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                {missingDefaults} seeded default task(s) not in your checklist yet.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary hidden sm:inline-flex"
              onClick={() => setAddOpen(true)}
            >
              + Add Task
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={save.isBusy}
              onClick={importMissing}
            >
              {saveButtonIdleLabel(save.state, "Import missing tasks")}
            </button>
            <Link href="/before-baby/assign" className="btn btn-secondary">
              Assign owners
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
              disabled={save.isBusy || !dueDate}
              onClick={generate}
            >
              {saveButtonIdleLabel(save.state, "Generate my schedule")}
            </button>
          </div>
        </div>
        <div className="mt-4 max-w-xl">
          <ProgressBar
            value={dashboard.percent}
            label={`${dashboard.completed} / ${dashboard.total} complete`}
          />
        </div>
        <SaveStatus
          state={save.state}
          message={save.statusMessage}
          slowTier={save.slowTier}
          onRetry={() => void save.retry()}
        />
      </section>

      {showSettings ? (
        <BeforeBabySchedulingSettings
          settings={settings}
          compact
          onTasksUpdated={reconcile}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Remaining" value={dashboard.remaining} />
        <StatCard label="Overdue" value={attention.summary.overdueCount} />
        <StatCard label="This week" value={attention.summary.thisWeekCount} />
        <StatCard label="Coming next" value={attention.summary.comingNextCount} />
      </div>

      <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-bg/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx(
              "btn min-h-11",
              state.displayMode === "attention" ? "btn-primary" : "btn-ghost",
            )}
            onClick={() => setDisplayMode("attention")}
          >
            What needs attention
          </button>
          <button
            type="button"
            className={clsx(
              "btn min-h-11",
              state.displayMode === "milestones" ? "btn-primary" : "btn-ghost",
            )}
            onClick={() => setDisplayMode("milestones")}
          >
            Milestones
          </button>
          <button
            type="button"
            className={clsx(
              "btn min-h-11",
              state.displayMode === "timeline" && state.groupBy === "none"
                ? "btn-primary"
                : "btn-ghost",
            )}
            onClick={() => setTimeline("none")}
          >
            Timeline
          </button>
          <button
            type="button"
            className={clsx(
              "btn min-h-11",
              state.groupBy === "owner" ? "btn-primary" : "btn-ghost",
            )}
            onClick={() => setGroupBy("owner")}
          >
            Owner
          </button>
          <button
            type="button"
            className={clsx(
              "btn min-h-11",
              state.groupBy === "category" ? "btn-primary" : "btn-ghost",
            )}
            onClick={() => setGroupBy("category")}
          >
            Category
          </button>
        </div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />
        {query.trim() ? (
          <p className="text-xs text-ink-muted">
            Showing search results across the whole checklist.
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost min-h-11"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide filters" : "Filters"}
        </button>
        {showAdvanced ? (
          <div className="flex flex-wrap gap-2">
            {ADVANCED_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx(
                  "badge min-h-11 shrink-0 px-3",
                  state.displayMode === "timeline" && state.filter === item.id
                    ? "badge-accent"
                    : "",
                )}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {searchHits ? (
        <TaskGroupList
          groups={[{ group: "search", label: "Search results", tasks: searchHits }]}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          dueDate={dueDate}
          onToggle={toggleOne}
          onReconcile={reconcile}
        />
      ) : state.displayMode === "milestones" ? (
        <MilestoneBoard tasks={optimisticTasks} settings={settings} />
      ) : state.displayMode === "attention" ? (
        <AttentionLists
          attention={attention}
          empty={attentionEmpty}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          dueDate={dueDate}
          onToggle={toggleOne}
          onReconcile={reconcile}
        />
      ) : (
        <TaskGroupList
          groups={groups}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          dueDate={dueDate}
          onToggle={toggleOne}
          onReconcile={reconcile}
        />
      )}

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
        }}
      />
    </div>
  );
}

function AttentionLists({
  attention,
  empty,
  collapsed,
  setCollapsed,
  dueDate,
  onToggle,
  onReconcile,
}: {
  attention: ReturnType<typeof buildBeforeBabyAttention>;
  empty: boolean;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  dueDate: string | null;
  onToggle: (task: ChecklistTask) => void;
  onReconcile: (tasks: ChecklistTask[]) => void;
}) {
  if (attention.postBirth) {
    return (
      <TaskGroupList
        groups={[
          {
            group: "still",
            label: "Still worth finishing",
            tasks: attention.stillWorthFinishing.map((r) => r.task),
          },
          {
            group: "first",
            label: "First days",
            tasks: attention.firstDays.map((r) => r.task),
          },
          {
            group: "later",
            label: "Later",
            tasks: attention.later.map((r) => r.task),
          },
          {
            group: "done",
            label: "Recently completed",
            tasks: attention.recentlyCompleted,
          },
        ].filter((g) => g.tasks.length > 0)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        dueDate={dueDate}
        onToggle={onToggle}
        onReconcile={onReconcile}
      />
    );
  }

  if (empty) {
    const allComplete =
      attention.summary.remainingBeforeBirth === 0 &&
      attention.comingNext.length === 0 &&
      attention.firstDays.length === 0;
    return (
      <BeforeBabyCaughtUp
        nextTitle={attention.comingNext[0]?.task.title ?? null}
        allComplete={allComplete}
      />
    );
  }

  const sections: Array<{ id: string; label: string; rows: AttentionTask[] }> = [
    { id: "overdue", label: "Overdue", rows: attention.overdue },
    { id: "now", label: "Needs attention now", rows: attention.needsAttentionNow },
    { id: "week", label: "This week", rows: attention.thisWeek },
    { id: "next", label: "Coming next", rows: attention.comingNext },
    {
      id: "done",
      label: "Recently completed",
      rows: attention.recentlyCompleted.map((task) => ({
        task,
        group: "recently_completed",
        blocked: false,
        blockedReason: null,
      })),
    },
  ];

  return (
    <TaskGroupList
      groups={sections
        .filter((s) => s.rows.length > 0)
        .map((s) => ({
          group: s.id,
          label: s.label,
          tasks: s.rows.map((r) => r.task),
        }))}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      dueDate={dueDate}
      onToggle={onToggle}
      onReconcile={onReconcile}
    />
  );
}

function TaskGroupList({
  groups,
  collapsed,
  setCollapsed,
  dueDate,
  onToggle,
  onReconcile,
}: {
  groups: Array<{ group: string; label: string; tasks: ChecklistTask[] }>;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  dueDate: string | null;
  onToggle: (task: ChecklistTask) => void;
  onReconcile: (tasks: ChecklistTask[]) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-ink-muted">No tasks in this view.</p>;
  }
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.group];
        return (
          <section key={group.group} className="surface overflow-hidden">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [group.group]: !c[group.group] }))
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
                  <BeforeBabyTaskCard
                    key={task.id}
                    task={task}
                    dueDate={dueDate}
                    onToggle={() => onToggle(task)}
                    onReconcile={onReconcile}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function matchesQuery(task: ChecklistTask, q: string) {
  return (
    task.title.toLowerCase().includes(q) ||
    (task.notes ?? "").toLowerCase().includes(q) ||
    task.category_label.toLowerCase().includes(q) ||
    CHECKLIST_OWNER_LABELS[task.owner]?.toLowerCase().includes(q) ||
    CHECKLIST_PRIORITY_LABELS[task.priority]?.toLowerCase().includes(q)
  );
}

function groupByLabel(
  tasks: ChecklistTask[],
  labelFor: (task: ChecklistTask) => string,
) {
  const map = new Map<string, ChecklistTask[]>();
  for (const t of tasks) {
    const label = labelFor(t);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  return [...map.entries()].map(([label, items]) => ({
    group: label,
    label,
    tasks: items,
  }));
}

function EmptyImport({
  templateTaskCount,
  onImported,
}: {
  templateTaskCount: number;
  onImported: (tasks: ChecklistTask[]) => void;
}) {
  const router = useRouter();
  const save = useSaveFeedback();
  return (
    <section className="surface space-y-4 p-6">
      <h2 className="font-display text-2xl">Start Before Baby</h2>
      <p className="text-ink-muted">
        Import {templateTaskCount} default prep tasks, then set your due date to
        build a timeline.
      </p>
      <SaveStatus
        state={save.state}
        message={save.statusMessage}
        slowTier={save.slowTier}
        onRetry={() => void save.retry()}
      />
      <button
        type="button"
        className="btn btn-primary min-h-11"
        disabled={save.isBusy}
        onClick={() => {
          void save.runSave(
            async () => {
              const result = await actionImportBeforeBaby();
              if (!result.ok) throw new Error(result.error);
              return result;
            },
            {
              operation: "import_before_baby_bootstrap",
              route: "/before-baby",
              onSuccess: async (result) => {
                const payload = result as { tasks?: ChecklistTask[] };
                if (payload.tasks) onImported(payload.tasks);
                router.refresh();
              },
            },
          );
        }}
      >
        {saveButtonIdleLabel(save.state, "Import Before Baby checklist")}
      </button>
    </section>
  );
}
