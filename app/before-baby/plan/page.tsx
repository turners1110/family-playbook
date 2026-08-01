import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BeforeBabySchedulingSettings } from "@/components/checklists/BeforeBabySchedulingSettings";
import { DueDateHeader } from "@/components/checklists/DueDateHeader";
import { GenerateScheduleButton } from "@/components/checklists/GenerateScheduleButton";
import { getBeforeBabyChecklist } from "@/lib/services/checklists";
import {
  buildChecklistDashboard,
  groupTasksByCategory,
} from "@/lib/checklists/dashboard";
import {
  effectiveDueDate,
  filterTasksByView,
  groupTasksForTimeline,
  sortTasksForTimeline,
} from "@/lib/checklists/scheduling";
import { formatShortDate, startOfWeekMonday } from "@/lib/checklists/date-math";
import { CHECKLIST_OWNER_LABELS } from "@/lib/checklists";

export const dynamic = "force-dynamic";

export default async function BeforeBabyPlanPage() {
  const { instance, tasks, settings, pregnancy } = await getBeforeBabyChecklist();
  const due = settings.expected_due_date ?? null;
  const dashboard = buildChecklistDashboard(tasks);
  const timeline = groupTasksForTimeline(tasks, due);
  const thisWeek = filterTasksByView(tasks, "this_week", due, {
    hideCompleted: true,
  });
  const overdue = filterTasksByView(tasks, "overdue", due);
  const high = tasks.filter((t) => !t.completed && t.priority === "high");
  const unassigned = tasks.filter((t) => !t.completed && t.owner === "both");

  const byWeek = new Map<string, number>();
  for (const task of sortTasksForTimeline(tasks, due)) {
    const d = effectiveDueDate(task);
    if (!d || task.completed) continue;
    const week = startOfWeekMonday(d);
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  }

  const categories = groupTasksByCategory(tasks);

  return (
    <AppShell
      title="Before Baby plan"
      subtitle="Generate and review your due-date schedule."
      actions={
        <Link href="/before-baby" className="btn btn-ghost">
          Checklist
        </Link>
      }
    >
      <div className="space-y-4">
        <DueDateHeader settings={settings} pregnancy={pregnancy} />

        <section className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Due date" value={due ? formatShortDate(due) : "Not set"} />
          <Stat
            label="Days remaining"
            value={pregnancy ? String(pregnancy.days_remaining) : "—"}
          />
          <Stat label="Tasks remaining" value={String(dashboard.remaining)} />
          <Stat label="Due this week" value={String(thisWeek.length)} />
          <Stat label="Overdue" value={String(overdue.length)} />
          <Stat label="High priority open" value={String(high.length)} />
          <Stat label="Unassigned (both)" value={String(unassigned.length)} />
          <Stat
            label="Checklist"
            value={instance ? "Ready" : "Not imported"}
          />
        </section>

        <section className="surface space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">Generate my schedule</h2>
            <GenerateScheduleButton disabled={!due} />
          </div>
          <p className="text-sm text-ink-muted">
            Preview applies recommended offsets using your scheduling mode.
            Manual dates stay put.
          </p>
        </section>

        <BeforeBabySchedulingSettings settings={settings} />

        <section className="surface p-4">
          <h2 className="font-display text-xl">Timeline by week</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[...byWeek.entries()].slice(0, 12).map(([week, count]) => (
              <li
                key={week}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span>Week of {formatShortDate(week)}</span>
                <span className="badge">{count} tasks</span>
              </li>
            ))}
            {byWeek.size === 0 ? (
              <li className="text-ink-muted">
                No dated tasks yet. Set a due date and generate a schedule.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="surface p-4">
          <h2 className="font-display text-xl">Groups</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {timeline.map((g) => (
              <li
                key={g.group}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span>{g.label}</span>
                <span className="badge">{g.tasks.length}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-4">
          <h2 className="font-display text-xl">By category</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map((c) => (
              <li
                key={c.slug}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span>{c.label}</span>
                <span className="badge">
                  {c.completed}/{c.total}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-4">
          <h2 className="font-display text-xl">Owners</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(["sam", "michelle", "both"] as const).map((owner) => {
              const count = tasks.filter(
                (t) => !t.completed && t.owner === owner,
              ).length;
              return (
                <li
                  key={owner}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <span>{CHECKLIST_OWNER_LABELS[owner]}</span>
                  <span className="badge">{count} open</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <div className="text-xs text-ink-subtle">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}
