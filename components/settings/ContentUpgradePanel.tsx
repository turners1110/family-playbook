"use client";

import { useState, useTransition } from "react";
import {
  actionApplyContentUpgrade,
  actionPreviewContentUpgrade,
} from "@/lib/actions/content-upgrade";
import type { ContentUpgradePreview } from "@/lib/content/upgrade";

export function ContentUpgradePanel({
  initialPreview,
}: {
  initialPreview: ContentUpgradePreview;
}) {
  const [preview, setPreview] = useState(initialPreview);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const change of initialPreview.changes) next[change.id] = change.safe;
    return next;
  });
  const [pending, startTransition] = useTransition();

  function load() {
    setError("");
    startTransition(async () => {
      const result = await actionPreviewContentUpgrade();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.preview);
      const next: Record<string, boolean> = {};
      for (const change of result.preview.changes) next[change.id] = change.safe;
      setSelected(next);
    });
  }

  function apply(ids: string[]) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await actionApplyContentUpgrade(ids);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Applied ${result.applied} change(s); skipped ${result.skipped}.`);
      load();
    });
  }

  const selectedIds = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([id]) => id);

  return (
    <section className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-display text-xl">Content upgrade preview</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Review seeded content changes before applying. Answers, completion,
          manual dates, custom titles, and notes are never overwritten.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-subtle">Template</dt>
            <dd>{preview.template_version}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Essentials path</dt>
            <dd>
              {preview.summary.questions_in_essentials} matched ·{" "}
              {preview.essentials_version}
            </dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Retitles</dt>
            <dd>{preview.summary.questions_retitled}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Reprioritized</dt>
            <dd>{preview.summary.questions_reprioritized}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Future-stage moves</dt>
            <dd>{preview.summary.future_stage_flags}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Ownership suggestions</dt>
            <dd>{preview.summary.ownership_suggestions}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Dependencies</dt>
            <dd>{preview.summary.dependencies_added}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Primary stages</dt>
            <dd>{preview.summary.primary_stages_set}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Helper updates</dt>
            <dd>{preview.summary.helper_updates}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Timing windows</dt>
            <dd>{preview.summary.timing_updates}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={load}>
            Refresh preview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || selectedIds.length === 0}
            onClick={() => apply(selectedIds)}
          >
            Apply selected safe changes
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending || !preview.changes.length}
            onClick={() => apply(["*"])}
          >
            Apply all safe changes
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-ink-muted">{message}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {preview.changes.slice(0, 80).map((change) => (
          <article key={change.id} className="surface p-4 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(selected[change.id])}
                disabled={!change.safe}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [change.id]: e.target.checked }))
                }
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">
                  {change.section ? `${change.section} · ` : ""}
                  {change.change_type} · {change.entity_type}
                  {change.safe ? "" : " · needs approval"}
                </span>
                <span className="mt-1 block text-ink-muted">{change.reason}</span>
                <span className="mt-2 block text-xs text-ink-subtle">
                  Before: {JSON.stringify(change.before)}
                </span>
                <span className="mt-1 block text-xs text-ink-subtle">
                  After: {JSON.stringify(change.after)}
                </span>
                <span className="mt-1 block text-xs text-accent">
                  Preserved: {change.data_preserved.join(", ")}
                  {change.user_data_exists ? " · user data present" : ""}
                </span>
              </span>
            </label>
          </article>
        ))}
        {preview.changes.length === 0 ? (
          <p className="text-sm text-ink-muted">No pending content changes.</p>
        ) : null}
      </div>
    </section>
  );
}
