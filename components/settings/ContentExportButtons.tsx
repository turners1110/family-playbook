"use client";

import { useState, useTransition } from "react";
import {
  exportBeforeBabyChecklistAction,
  exportQuestionsAction,
} from "@/lib/actions/content-export";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Action = (format: "markdown" | "json") => Promise<
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string }
>;

function ExportRow({
  label,
  action,
}: {
  label: string;
  action: Action;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(format: "markdown" | "json") {
    setError(null);
    startTransition(async () => {
      const result = await action(format);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      download(
        result.filename,
        result.content,
        format === "markdown" ? "text/markdown" : "application/json",
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-40 text-sm font-medium text-ink">{label}</span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => run("markdown")}
      >
        {pending ? "Preparing…" : "Markdown (readable)"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => run("json")}
      >
        {pending ? "Preparing…" : "JSON (raw)"}
      </button>
      {error && (
        <p className="w-full text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContentExportButtons() {
  return (
    <div className="surface space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl text-ink">Content exports</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Full detail for everything currently in your live data — every
          question&apos;s text, guidance, and options, or the full Before Baby
          checklist with timing and ownership.
        </p>
      </div>
      <ExportRow label="Question bank" action={exportQuestionsAction} />
      <ExportRow
        label="Before Baby checklist"
        action={exportBeforeBabyChecklistAction}
      />
    </div>
  );
}
