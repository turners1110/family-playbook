"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSavePlaybook, actionGenerateAiSection } from "@/lib/actions";

export function PlaybookControls({ includeHistory }: { includeHistory: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => {
          const next = includeHistory ? "/playbook" : "/playbook?history=1";
          router.push(next);
        }}
      >
        {includeHistory ? "Hide perspective history" : "Include perspective history"}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await actionSavePlaybook(includeHistory);
            router.refresh();
          })
        }
      >
        Save snapshot
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await actionGenerateAiSection("family-constitution", "Family Constitution");
            alert("AI draft stored separately and labeled. Approval required before use.");
            router.refresh();
          })
        }
      >
        Draft AI section (mock)
      </button>
    </div>
  );
}
