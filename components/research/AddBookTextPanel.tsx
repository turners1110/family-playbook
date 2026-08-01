"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionFinalizeResearchUpload,
  actionPrepareResearchUpload,
  actionRetryEpubProcessing,
} from "@/lib/research/actions";
import { RESEARCH_MAX_FILE_BYTES } from "@/lib/research/types";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type UploadMode =
  | "epub"
  | "pdf"
  | "txt"
  | "docx"
  | "scans"
  | "notes";

type ProgressState =
  | "idle"
  | "preparing"
  | "uploading"
  | "uploaded"
  | "validating"
  | "drm_protected"
  | "extracting"
  | "generating"
  | "needs_review"
  | "complete"
  | "failed";

const ACCEPT: Record<Exclude<UploadMode, "notes" | "scans">, string> = {
  epub: ".epub,application/epub+zip",
  pdf: ".pdf,application/pdf",
  txt: ".txt,text/plain",
  docx: ".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword",
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

export function AddBookTextPanel({
  sourceId,
  writesAllowed = true,
  latestFileId = null,
  initialStatus = null,
}: {
  sourceId: string;
  writesAllowed?: boolean;
  latestFileId?: string | null;
  initialStatus?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<UploadMode>("epub");
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<ProgressState>(
    initialStatus === "drm_protected"
      ? "drm_protected"
      : initialStatus === "source_grounded_analysis_ready"
        ? "complete"
        : "idle",
  );

  const accept = useMemo(() => {
    if (mode === "notes") return undefined;
    if (mode === "scans") return "image/*,.pdf";
    return ACCEPT[mode];
  }, [mode]);

  function onChooseFile(next: File | null) {
    setError("");
    setFile(next);
    setProgress(0);
    setState(next ? "idle" : "idle");
  }

  function upload() {
    if (!writesAllowed) {
      setError("Research storage unavailable.");
      return;
    }
    if (mode === "notes") {
      setError("Paste notes from the Notes tab for now, or upload an EPUB.");
      return;
    }
    if (mode === "scans") {
      setError(
        "Selected page scans will use the same private upload path; prefer PDF for now or upload an EPUB.",
      );
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!rights) {
      setError(
        "Confirm you have the right to upload and privately process this file.",
      );
      return;
    }
    if (file.size > RESEARCH_MAX_FILE_BYTES) {
      setError(
        `File exceeds the ${RESEARCH_MAX_FILE_BYTES / (1024 * 1024)} MiB limit.`,
      );
      return;
    }
    if (mode === "epub" && !file.name.toLowerCase().endsWith(".epub")) {
      setError("Accepted format: .epub");
      return;
    }

    startTransition(async () => {
      setError("");
      setState("preparing");
      setProgress(5);
      try {
        const fileHash = await sha256Hex(file);
        setProgress(15);
        const prepared = await actionPrepareResearchUpload({
          sourceId,
          filename: file.name,
          size: file.size,
          type: file.type,
          fileHash,
          rightsAttested: true,
        });
        if (!prepared.ok) {
          setState("failed");
          setError(prepared.error);
          return;
        }

        setState("uploading");
        setProgress(35);

        if (prepared.prepared.signedUrl.startsWith("local://")) {
          const body = new FormData();
          body.set("sourceId", sourceId);
          body.set("fileHash", fileHash);
          body.set("file", file);
          const response = await fetch("/api/research/upload", {
            method: "POST",
            body,
          });
          const json = (await response.json()) as { error?: string };
          if (!response.ok) {
            setState("failed");
            setError(json.error ?? "Local upload failed.");
            return;
          }
        } else {
          const uploadResponse = await fetch(prepared.prepared.signedUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || prepared.prepared.mimeType,
            },
            body: file,
          });
          if (!uploadResponse.ok) {
            setState("failed");
            setError("Could not upload file to private storage.");
            return;
          }
          setProgress(70);
          setState("uploaded");
          const finalized = await actionFinalizeResearchUpload({
            sourceId,
            storagePath: prepared.prepared.storagePath,
            originalFilename: prepared.prepared.originalFilename,
            mimeType: prepared.prepared.mimeType,
            fileSize: prepared.prepared.fileSize,
            fileHash: prepared.prepared.fileHash,
          });
          if (!finalized.ok) {
            setState("failed");
            setError(finalized.error);
            return;
          }
        }

        setProgress(90);
        setState(mode === "epub" ? "validating" : "uploaded");
        setProgress(100);
        router.refresh();
        setState(mode === "epub" ? "extracting" : "complete");
      } catch (err) {
        setState("failed");
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function retry() {
    if (!latestFileId) {
      setError("No uploaded file to retry.");
      return;
    }
    startTransition(async () => {
      setError("");
      setState("extracting");
      const result = await actionRetryEpubProcessing(sourceId, latestFileId);
      if (!result.ok) {
        setState("failed");
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="surface space-y-4 p-5">
      <h2 className="font-display text-xl">Add book text</h2>
      <p className="text-sm text-ink-muted">
        Upload privately owned book text to generate source-grounded insights.
        The public-source overview is preserved separately.
      </p>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["epub", "Upload EPUB"],
            ["pdf", "Upload PDF"],
            ["txt", "Upload TXT"],
            ["docx", "Upload DOCX"],
            ["scans", "Upload selected page scans"],
            ["notes", "Paste notes or excerpts"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`badge ${mode === value ? "badge-accent" : ""}`}
            onClick={() => {
              setMode(value);
              setFile(null);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "epub" ? (
        <div className="rounded-xl border border-border bg-bg-muted/40 px-3 py-3 text-sm text-ink-muted">
          <p>Accepted format: .epub</p>
          <p>Maximum size: 50 MiB</p>
          <p>The file stays private.</p>
          <p className="mt-2 text-xs text-ink-subtle">
            Kobo downloads may use DRM. If this EPUB cannot be read, import Kobo
            highlights, paste notes, or upload selected pages instead.
          </p>
        </div>
      ) : null}

      {mode === "notes" ? (
        <div className="field">
          <label htmlFor="paste-notes">Notes or excerpts</label>
          <textarea
            id="paste-notes"
            className="textarea"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste short notes or excerpts you have the right to store."
          />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="book-text-file">Choose file</label>
          <input
            id="book-text-file"
            type="file"
            accept={accept}
            onChange={(e) => onChooseFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {file ? (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-subtle">Filename</dt>
            <dd>{file.name}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Size</dt>
            <dd>{formatBytes(file.size)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Upload progress</dt>
            <dd>{progress}%</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Status</dt>
            <dd>{state.replaceAll("_", " ")}</dd>
          </div>
        </dl>
      ) : null}

      {state === "drm_protected" ? (
        <div className="rounded-xl border border-border bg-warning-soft px-3 py-3 text-sm text-warning">
          This EPUB appears to be DRM-protected. The app cannot read its book
          text. You can still add Kobo highlights, notes, excerpts, or selected
          page scans.
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-1"
        />
        <span>
          I have the right to upload and privately process this file.
        </span>
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !writesAllowed || mode === "notes"}
          onClick={upload}
        >
          {pending ? "Working…" : "Start upload"}
        </button>
        {state === "failed" || state === "drm_protected" ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || !latestFileId}
            onClick={retry}
          >
            Retry processing
          </button>
        ) : null}
      </div>
    </section>
  );
}
