"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  actionPreviewDueDateChange,
  actionUpdateBeforeBabyScheduling,
} from "@/lib/actions/checklists";
import type { FamilySettings } from "@/lib/types/models";
import type { PregnancyProgress } from "@/lib/checklists/date-math";
import { formatShortDate } from "@/lib/checklists/date-math";

export function DueDateHeader({
  settings,
  pregnancy,
}: {
  settings: FamilySettings;
  pregnancy: PregnancyProgress | null;
}) {
  const [pending, startTransition] = useTransition();
  const [due, setDue] = useState(settings.expected_due_date ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    moving: number;
    manualKept: number;
  } | null>(null);

  function save(apply: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (due && due !== settings.expected_due_date) {
        const prev = await actionPreviewDueDateChange(due);
        if (prev.ok) setPreview(prev.preview);
      }
      const result = await actionUpdateBeforeBabyScheduling(
        { expected_due_date: due || null },
        { applySchedule: apply, keepManualDates: true },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        apply
          ? `Due date saved. ${result.tasksUpdated} task date${result.tasksUpdated === 1 ? "" : "s"} updated.`
          : "Due date saved.",
      );
      setPreview(null);
    });
  }

  return (
    <section className="surface mb-4 space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Expected due date</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Date math only — not medical advice. Used to recommend when tasks
            should be done.
          </p>
        </div>
        <Link href="/before-baby/plan" className="btn btn-secondary">
          Planning view
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="field">
          <label htmlFor="expected-due-date">Due date</label>
          <input
            id="expected-due-date"
            type="date"
            className="input"
            value={due}
            onChange={(e) => {
              setDue(e.target.value);
              setPreview(null);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => save(true)}
          >
            {pending ? "Saving…" : "Save & update schedule"}
          </button>
        </div>
      </div>

      {pregnancy ? (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-subtle">Due date</dt>
            <dd>{formatShortDate(pregnancy.due_date)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Days remaining</dt>
            <dd>{pregnancy.days_remaining}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Pregnancy week</dt>
            <dd>~{pregnancy.pregnancy_week}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Trimester</dt>
            <dd>{pregnancy.trimester ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">
          Set a due date to unlock recommended task timing.
        </p>
      )}

      {preview && preview.moving > 0 ? (
        <p className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-ink-muted">
          {preview.moving} calculated task{preview.moving === 1 ? "" : "s"} will
          move. {preview.manualKept} manual date
          {preview.manualKept === 1 ? "" : "s"} kept.
        </p>
      ) : null}
      {message ? <p className="text-sm text-accent-strong">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
