"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actionCancelPublicOverview,
  actionGeneratePublicOverview,
  actionGeneratePublicOverviewsBulk,
} from "@/lib/research/actions";

export function GeneratePublicOverviewButton({
  sourceId,
  label = "Generate public overview",
  force = false,
}: {
  sourceId: string;
  label?: string;
  force?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await actionGeneratePublicOverview(sourceId, force);
            if (!result.ok) {
              setMessage(result.error);
              return;
            }
            setMessage(
              result.status === "completed"
                ? "Public overview ready for review."
                : "Public research queued.",
            );
            router.refresh();
          })
        }
      >
        {pending ? "Working…" : label}
      </button>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </div>
  );
}

export function CancelPublicOverviewButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await actionCancelPublicOverview(sourceId);
          router.refresh();
        })
      }
    >
      Pause / cancel
    </button>
  );
}

export function BulkGeneratePublicOverviewsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await actionGeneratePublicOverviewsBulk();
            if (!result.ok) {
              setMessage(result.error);
              return;
            }
            setMessage(
              `Queued ${result.queued} of ${result.total} recommended books (concurrency limited).`,
            );
            router.refresh();
          })
        }
      >
        {pending ? "Queueing…" : "Generate public overviews for all books"}
      </button>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </div>
  );
}
