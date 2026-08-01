"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionGenerateBeforeBabySchedule } from "@/lib/actions/checklists";

export function GenerateScheduleButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {!preview ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || pending}
          onClick={() => setPreview("Ready to apply recommended dates to open tasks. Manual dates stay.")}
        >
          Generate my schedule
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await actionGenerateBeforeBabySchedule(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setPreview(null);
                router.refresh();
              });
            }}
          >
            {pending ? "Applying…" : "Apply schedule"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPreview(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {preview ? <p className="text-sm text-ink-muted">{preview}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
