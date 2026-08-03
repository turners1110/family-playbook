"use client";

import { useState, useTransition } from "react";
import {
  QuickAddTaskSheet,
  type QuickAddDefaults,
} from "@/components/checklists/QuickAddTaskSheet";
import { getBeforeBabyChecklistIdAction } from "@/lib/actions/checklists";
import type { ChecklistTask } from "@/lib/types/models";

/**
 * Lightweight “Create task” entry from questions / conversations.
 * Opens the same quick-add sheet used on Before Baby.
 */
export function CreateChecklistTaskButton({
  label = "Create task",
  defaults,
  className = "btn btn-ghost",
}: {
  label?: string;
  defaults: QuickAddDefaults;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openSheet() {
    setError(null);
    if (checklistId) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const result = await getBeforeBabyChecklistIdAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setChecklistId(result.checklistId);
      setTasks(result.tasks);
      setDueDate(result.dueDate);
      setOpen(true);
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={openSheet}
      >
        {pending ? "Opening…" : label}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {checklistId ? (
        <QuickAddTaskSheet
          open={open}
          onClose={() => setOpen(false)}
          checklistId={checklistId}
          existingTasks={tasks}
          dueDate={dueDate}
          defaults={defaults}
          onCreated={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
