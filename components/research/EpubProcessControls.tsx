"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionProcessExistingEpub,
  actionRetryEpubProcessing,
  actionRunNextEpubStep,
} from "@/lib/research/actions";

export function EpubProcessControls({
  sourceId,
  latestFileId,
  statusLabel,
  statusCode,
  active,
  writesAllowed = true,
  jobMessage = null,
}: {
  sourceId: string;
  latestFileId: string | null;
  statusLabel: string;
  statusCode: string;
  active: boolean;
  writesAllowed?: boolean;
  jobMessage?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [active, router]);

  function processUploaded() {
    startTransition(async () => {
      setMessage("");
      const result = await actionProcessExistingEpub(sourceId);
      setMessage(result.ok ? "Processing started." : result.error);
      router.refresh();
    });
  }

  function runNext() {
    startTransition(async () => {
      setMessage("");
      const result = await actionRunNextEpubStep(sourceId);
      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage(
          result.done
            ? `Done (${result.stage ?? "complete"}).`
            : `Advanced: ${(result.stagesRun ?? []).join(", ") || "step"}.`,
        );
      }
      router.refresh();
    });
  }

  function retry() {
    if (!latestFileId) {
      setMessage("No uploaded file to retry.");
      return;
    }
    startTransition(async () => {
      setMessage("");
      const result = await actionRetryEpubProcessing(sourceId, latestFileId);
      setMessage(result.ok ? "Retry queued." : result.error);
      router.refresh();
    });
  }

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">EPUB processing</h3>
        <span className="badge badge-info">{statusLabel}</span>
      </div>
      <p className="text-sm text-ink-muted">
        Process the already-uploaded EPUB without uploading again. Use Run next
        step while a background worker is not yet configured.
      </p>
      {statusCode === "drm_protected" ? (
        <div className="rounded-xl border border-border bg-warning-soft px-3 py-3 text-sm text-warning">
          This EPUB appears to be DRM-protected. The app cannot read its book
          text. Add Kobo highlights, notes, excerpts, or selected page scans
          instead.
        </div>
      ) : null}
      {jobMessage ? (
        <p className="text-sm text-ink-muted">{jobMessage}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !writesAllowed || !latestFileId}
          onClick={processUploaded}
        >
          Process uploaded book
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || !writesAllowed}
          onClick={runNext}
        >
          Run next step
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || !writesAllowed || !latestFileId}
          onClick={retry}
        >
          Retry
        </button>
      </div>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </section>
  );
}
