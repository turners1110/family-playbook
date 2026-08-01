"use client";

import { useState, useTransition } from "react";
import { actionUpdateBeforeBabyScheduling } from "@/lib/actions/checklists";
import type {
  BeforeBabySchedulingMode,
  FamilySettings,
} from "@/lib/types/models";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BeforeBabySchedulingSettings({
  settings,
  compact = false,
}: {
  settings: FamilySettings;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<BeforeBabySchedulingMode>(
    settings.before_baby_scheduling_mode ?? "recommended",
  );
  const [preferred, setPreferred] = useState<number[]>(
    settings.before_baby_preferred_task_days ?? [1, 2, 3, 4, 5],
  );
  const [maxPerWeek, setMaxPerWeek] = useState(
    settings.before_baby_max_tasks_per_week ?? 8,
  );
  const [weekendHeavy, setWeekendHeavy] = useState(
    Boolean(settings.before_baby_weekend_heavy),
  );
  const [includePostBirth, setIncludePostBirth] = useState(
    settings.before_baby_include_post_birth !== false,
  );
  const [hideCompleted, setHideCompleted] = useState(
    Boolean(settings.before_baby_hide_completed),
  );
  const [travel, setTravel] = useState(
    (settings.before_baby_avoid_travel_dates ?? []).join(", "),
  );
  const [due, setDue] = useState(settings.expected_due_date ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setPreferred((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const avoid = travel
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
      const result = await actionUpdateBeforeBabyScheduling(
        {
          expected_due_date: due || null,
          before_baby_scheduling_mode: mode,
          before_baby_preferred_task_days: preferred,
          before_baby_max_tasks_per_week: maxPerWeek,
          before_baby_weekend_heavy: weekendHeavy,
          before_baby_include_post_birth: includePostBirth,
          before_baby_hide_completed: hideCompleted,
          before_baby_avoid_travel_dates: avoid,
        },
        { applySchedule: true, keepManualDates: true },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Scheduling preferences saved. ${result.tasksUpdated} tasks updated.`);
    });
  }

  return (
    <section className={`surface space-y-4 ${compact ? "p-4" : "p-5"}`}>
      <div>
        <h2 className="font-display text-xl">Before Baby scheduling</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Recommended timing uses default offsets. Manual dates are never
          overwritten.
        </p>
      </div>

      <div className="field">
        <label htmlFor="bb-due">Expected due date</label>
        <input
          id="bb-due"
          type="date"
          className="input"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          Scheduling mode
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["recommended", "Recommended timing"],
              ["earlier", "Earlier preparation"],
              ["compact", "Compact preparation"],
              ["manual_only", "Manual only"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sched-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          Preferred task days
        </legend>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, day) => (
            <label key={label} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={preferred.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="max-week">Maximum tasks per week</label>
          <input
            id="max-week"
            type="number"
            min={1}
            max={40}
            className="input"
            value={maxPerWeek}
            onChange={(e) => setMaxPerWeek(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="travel">Avoid travel dates</label>
          <input
            id="travel"
            className="input"
            placeholder="2026-10-01, 2026-10-02"
            value={travel}
            onChange={(e) => setTravel(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={weekendHeavy}
            onChange={(e) => setWeekendHeavy(e.target.checked)}
          />
          Weekend-heavy planning
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includePostBirth}
            onChange={(e) => setIncludePostBirth(e.target.checked)}
          />
          Include post-birth tasks
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed tasks
        </label>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={save}
      >
        {pending ? "Saving…" : "Save scheduling"}
      </button>
      {message ? <p className="text-sm text-accent-strong">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
