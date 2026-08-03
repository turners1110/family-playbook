"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { ChecklistTask } from "@/lib/types/models";
import type {
  ChecklistOwner,
  ChecklistPriority,
} from "@/lib/checklists";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
} from "@/lib/checklists";
import {
  EFFORT_OPTIONS,
  MANUAL_CATEGORY_SUGGESTIONS,
  RELATIVE_TIMING_OPTIONS,
  findSimilarChecklistTasks,
  resolveManualTiming,
  suggestCategoriesForTitle,
} from "@/lib/checklists/manual-tasks";
import type { ChecklistRelativeTimingPreset } from "@/lib/types/models";
import {
  actionAddCustomChecklistTask,
  actionUpdateChecklistTask,
} from "@/lib/actions/checklists";

export type QuickAddDefaults = {
  title?: string;
  notes?: string;
  source?: string;
  created_from_label?: string;
  linked_question_ids?: string[];
  linked_conversation_ids?: string[];
  linked_research_ids?: string[];
};

function QuickAddTaskSheetInner({
  onClose,
  checklistId,
  existingTasks,
  dueDate,
  defaults,
  onCreated,
}: {
  onClose: () => void;
  checklistId: string;
  existingTasks: ChecklistTask[];
  dueDate: string | null;
  defaults?: QuickAddDefaults;
  onCreated: (task: ChecklistTask) => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [notes, setNotes] = useState(defaults?.notes ?? "");
  const [owner, setOwner] = useState<ChecklistOwner>("unassigned");
  const [priority, setPriority] = useState<ChecklistPriority>("medium");
  const [categorySlug, setCategorySlug] = useState("");
  const [timing, setTiming] = useState<ChecklistRelativeTimingPreset | "">("");
  const [chooseDate, setChooseDate] = useState("");
  const [effortMinutes, setEffortMinutes] = useState<number | "">("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarDecision, setSimilarDecision] = useState<
    null | "pending" | "keep"
  >(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [categoryPrompt, setCategoryPrompt] = useState<
    Array<{ slug: string; label: string }> | null
  >(null);

  const timingPreview = useMemo(() => {
    if (!timing) return null;
    return resolveManualTiming(timing, {
      dueDate,
      chooseDate: chooseDate || null,
    });
  }, [timing, dueDate, chooseDate]);

  const similar = useMemo(
    () => findSimilarChecklistTasks(title, existingTasks),
    [title, existingTasks],
  );

  const categorySuggestions = useMemo(
    () => suggestCategoriesForTitle(title),
    [title],
  );

  function submit(forceKeepBoth = false) {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Task title is required.");
      return;
    }
    if (similar.length > 0 && similarDecision !== "keep" && !forceKeepBoth) {
      setSimilarDecision("pending");
      return;
    }

    const cat = MANUAL_CATEGORY_SUGGESTIONS.find((c) => c.slug === categorySlug);
    const isInbox =
      !categorySlug && owner === "unassigned" && !timing && !notes.trim();

    startTransition(async () => {
      setError(null);
      const result = await actionAddCustomChecklistTask({
        checklistId,
        title: trimmed,
        notes: notes.trim() || null,
        owner,
        priority,
        category: cat?.slug ?? (isInbox ? "inbox" : undefined),
        category_label: cat?.label ?? (isInbox ? "Inbox" : undefined),
        relative_timing_preset: timing || null,
        choose_date: chooseDate || null,
        estimated_minutes:
          typeof effortMinutes === "number" ? effortMinutes : null,
        inbox: isInbox,
        source: defaults?.source ?? "manual",
        created_from_label: defaults?.created_from_label ?? null,
        linked_question_ids: defaults?.linked_question_ids,
        linked_conversation_ids: defaults?.linked_conversation_ids,
        linked_research_ids: defaults?.linked_research_ids,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.task) onCreated(result.task);
      const suggestions = categorySuggestions.filter(
        (s) => s.slug !== cat?.slug,
      );
      if (!cat && suggestions.length > 0 && result.taskId) {
        setCreatedTaskId(result.taskId);
        setCategoryPrompt(suggestions.slice(0, 3));
        return;
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add task"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg p-4 shadow-xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">Add task</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {defaults?.created_from_label ? (
          <p className="mb-3 text-sm text-ink-muted">
            Created from: {defaults.created_from_label}
          </p>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>Task title</span>
            <input
              ref={titleRef}
              className="input min-h-12 text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Buy newborn diapers"
              required
              autoFocus
              enterKeyHint="done"
            />
          </label>

          <label className="field">
            <span>Owner</span>
            <select
              className="input min-h-12"
              value={owner}
              onChange={(e) => setOwner(e.target.value as ChecklistOwner)}
            >
              {(["unassigned", "sam", "michelle", "both"] as const).map((o) => (
                <option key={o} value={o}>
                  {CHECKLIST_OWNER_LABELS[o]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Timing (optional)</span>
            <select
              className="input min-h-12"
              value={timing}
              onChange={(e) =>
                setTiming(e.target.value as ChecklistRelativeTimingPreset | "")
              }
            >
              <option value="">No timing yet</option>
              {RELATIVE_TIMING_OPTIONS.map((o) => (
                <option key={o.preset} value={o.preset}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {timing === "choose_date" || timing === "custom" ? (
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                className="input min-h-12"
                value={chooseDate}
                onChange={(e) => setChooseDate(e.target.value)}
              />
            </label>
          ) : null}

          {timingPreview?.kind === "relative" && timingPreview.absoluteDate ? (
            <p className="text-sm text-ink-muted">
              {timingPreview.label} · {timingPreview.absoluteDate}
            </p>
          ) : null}
          {timingPreview?.kind === "absolute" ? (
            <p className="text-sm text-ink-muted">
              {timingPreview.label} · {timingPreview.date}
            </p>
          ) : null}
          {timingPreview?.kind === "relative" &&
          !timingPreview.absoluteDate &&
          dueDate === null ? (
            <p className="text-sm text-amber-800">
              Due date not set yet — timing will calculate when you add one.
            </p>
          ) : null}

          <button
            type="button"
            className="text-sm text-accent-strong"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? "Hide details" : "More options"}
          </button>

          {showMore ? (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <label className="field">
                <span>Description</span>
                <textarea
                  className="input min-h-20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details"
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  className="input min-h-12"
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                >
                  <option value="">None (Inbox)</option>
                  {MANUAL_CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  className="input min-h-12"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as ChecklistPriority)
                  }
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
                <span>Estimated effort</span>
                <select
                  className="input min-h-12"
                  value={effortMinutes === "" ? "" : String(effortMinutes)}
                  onChange={(e) =>
                    setEffortMinutes(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                >
                  <option value="">Optional</option>
                  {EFFORT_OPTIONS.map((o) => (
                    <option key={o.minutes} value={o.minutes}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {similarDecision === "pending" && similar.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-950">
                A similar checklist item already exists.
              </p>
              <ul className="mt-2 space-y-1 text-amber-900">
                {similar.map((s) => (
                  <li key={s.task.id}>• {s.task.title}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSimilarDecision(null);
                    onClose();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSimilarDecision("keep");
                    submit(true);
                  }}
                >
                  Keep both
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSimilarDecision(null);
                    onClose();
                  }}
                >
                  Use existing
                </button>
              </div>
            </div>
          ) : null}

          {categoryPrompt && createdTaskId ? (
            <div className="rounded-xl border border-border bg-bg-elevated p-3 text-sm">
              <p className="font-medium">Suggested category</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryPrompt.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    className="btn btn-secondary"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await actionUpdateChecklistTask(createdTaskId, {
                          category: c.slug,
                          category_label: c.label,
                          inbox: false,
                        });
                        onClose();
                      });
                    }}
                  >
                    Accept {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                >
                  Ignore
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {!categoryPrompt ? (
            <div className="sticky bottom-0 flex gap-2 bg-bg pt-2">
              <button
                type="submit"
                className={clsx("btn btn-primary min-h-12 flex-1")}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save task"}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function QuickAddTaskSheet({
  open,
  onClose,
  checklistId,
  existingTasks,
  dueDate,
  defaults,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  checklistId: string;
  existingTasks: ChecklistTask[];
  dueDate: string | null;
  defaults?: QuickAddDefaults;
  onCreated: (task: ChecklistTask) => void;
}) {
  if (!open) return null;
  const remountKey = [
    checklistId,
    defaults?.title ?? "",
    defaults?.created_from_label ?? "",
    defaults?.source ?? "manual",
  ].join(":");
  return (
    <QuickAddTaskSheetInner
      key={remountKey}
      onClose={onClose}
      checklistId={checklistId}
      existingTasks={existingTasks}
      dueDate={dueDate}
      defaults={defaults}
      onCreated={onCreated}
    />
  );
}
