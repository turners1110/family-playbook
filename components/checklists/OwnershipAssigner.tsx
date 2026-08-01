"use client";

import { useMemo, useState, useTransition } from "react";
import type { ChecklistTask } from "@/lib/types/models";
import { ownershipForSlug } from "@/lib/checklists/ownership";
import {
  actionAssignChecklistOwner,
  actionBulkAssignOwners,
} from "@/lib/actions/checklists";
import type { ChecklistOwner } from "@/lib/checklists";

type HistoryEntry = {
  taskId: string;
  prevOwner: ChecklistOwner;
  prevSource: ChecklistTask["ownership_source"];
};

export function OwnershipAssigner({
  initialTasks,
}: {
  initialTasks: ChecklistTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [index, setIndex] = useState(0);
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const queue = useMemo(() => {
    return tasks.filter((t) => {
      if (t.archived) return false;
      if (skipCompleted && t.completed) return false;
      if (!unassignedOnly) return true;
      return (
        !t.ownership_source ||
        t.ownership_source === "default" ||
        t.ownership_source === "decide_later" ||
        (t.owner === "both" && t.ownership_source !== "explicit")
      );
    });
  }, [tasks, unassignedOnly, skipCompleted]);

  const current = queue[Math.min(index, Math.max(queue.length - 1, 0))] ?? null;
  const suggestion = current
    ? ownershipForSlug(current.template_task_slug)
    : null;

  const counts = useMemo(() => {
    const active = tasks.filter((t) => !t.archived);
    const assigned = active.filter(
      (t) =>
        t.ownership_source === "explicit" ||
        t.ownership_source === "bulk" ||
        t.ownership_source === "suggested",
    ).length;
    const unassigned = active.length - assigned;
    const joint = active.filter((t) => t.joint_approval_required).length;
    const waiting = active.filter(
      (t) => t.ownership_source === "decide_later",
    ).length;
    return { assigned, unassigned, joint, waiting, total: active.length };
  }, [tasks]);

  function applyLocal(
    taskId: string,
    owner: ChecklistOwner | "decide_later",
    source: ChecklistTask["ownership_source"],
  ) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (owner === "decide_later") {
          return { ...t, ownership_source: "decide_later" };
        }
        return {
          ...t,
          owner,
          ownership_source: source,
          contributor:
            owner === "both" ? null : owner === "sam" ? "michelle" : "sam",
        };
      }),
    );
  }

  function assign(owner: ChecklistOwner | "decide_later", source: "explicit" | "suggested" = "explicit") {
    if (!current) return;
    const prev = {
      taskId: current.id,
      prevOwner: current.owner,
      prevSource: current.ownership_source,
    };
    setHistory((h) => [...h, prev]);
    applyLocal(current.id, owner, owner === "decide_later" ? "decide_later" : source);
    startTransition(async () => {
      const result = await actionAssignChecklistOwner(current.id, owner, source);
      if (!result.ok) setMessage(result.error);
      else setMessage(null);
      setIndex((i) => Math.min(i + 1, Math.max(queue.length - 1, 0)));
    });
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    applyLocal(last.taskId, last.prevOwner, last.prevSource ?? "default");
    startTransition(async () => {
      await actionAssignChecklistOwner(last.taskId, last.prevOwner, "explicit");
    });
    setIndex((i) => Math.max(0, i - 1));
  }

  function bulkSuggestions() {
    startTransition(async () => {
      const result = await actionBulkAssignOwners({
        applySuggestions: true,
        owner: "both",
        onlyUnassigned: true,
      });
      if (result.ok) {
        setMessage(`Applied ${result.count} suggestions.`);
        // Refresh from suggestions locally for still-both tasks
        setTasks((prev) =>
          prev.map((t) => {
            if (t.completed && skipCompleted) return t;
            if (t.ownership_source === "explicit" || t.ownership_source === "bulk") {
              return t;
            }
            const s = ownershipForSlug(t.template_task_slug);
            if (!s) return t;
            return {
              ...t,
              owner: s.primary_owner,
              contributor: s.contributor,
              joint_approval_required: s.joint_approval_required,
              ownership_source: "suggested",
            };
          }),
        );
      } else setMessage(result.error);
    });
  }

  const categories = useMemo(() => {
    return [...new Set(tasks.map((t) => t.category))].sort();
  }, [tasks]);

  return (
    <div className="space-y-4">
      <section className="surface grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Stat label="Assigned" value={counts.assigned} />
        <Stat label="Unassigned" value={counts.unassigned} />
        <Stat label="Joint approval" value={counts.joint} />
        <Stat label="Decide later" value={counts.waiting} />
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={unassignedOnly}
            onChange={(e) => {
              setUnassignedOnly(e.target.checked);
              setIndex(0);
            }}
          />
          Unassigned only
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={skipCompleted}
            onChange={(e) => {
              setSkipCompleted(e.target.checked);
              setIndex(0);
            }}
          />
          Skip completed
        </label>
        <button type="button" className="btn btn-ghost" onClick={bulkSuggestions} disabled={pending}>
          Apply all suggestions
        </button>
        <button type="button" className="btn btn-ghost" onClick={undo} disabled={!history.length || pending}>
          Undo last
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className="btn btn-ghost text-xs"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await actionBulkAssignOwners({
                  category: cat,
                  owner: "both",
                  onlyUnassigned: true,
                });
                if (result.ok) setMessage(`Bulk updated ${result.count} in ${cat}.`);
              })
            }
          >
            Bulk Both · {cat}
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}

      {current ? (
        <section className="surface p-5">
          <p className="text-xs text-ink-subtle">
            Card {Math.min(index + 1, queue.length)} of {queue.length}
          </p>
          <h2 className="mt-2 font-display text-2xl">{current.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {current.category_label}
            {current.completed ? " · Completed" : ""}
          </p>
          {suggestion ? (
            <p className="mt-3 text-sm text-ink-muted">
              Suggested: {suggestion.primary_owner}
              {suggestion.contributor ? ` (contributor ${suggestion.contributor})` : ""}
              {" — "}
              {suggestion.reason}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(["sam", "michelle", "both"] as const).map((owner) => (
              <button
                key={owner}
                type="button"
                className="btn btn-primary min-h-12"
                disabled={pending}
                onClick={() => assign(owner)}
              >
                {owner === "sam" ? "Sam" : owner === "michelle" ? "Michelle" : "Both"}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost min-h-12"
              disabled={pending}
              onClick={() => assign("decide_later")}
            >
              Decide later
            </button>
            {suggestion ? (
              <button
                type="button"
                className="btn btn-ghost min-h-12 sm:col-span-2"
                disabled={pending}
                onClick={() => assign(suggestion.primary_owner, "suggested")}
              >
                Use suggested owner
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="surface p-5 text-sm text-ink-muted">
          No tasks match this filter. Turn off “Unassigned only” to review all.
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-ink-subtle">{label}</div>
    </div>
  );
}
