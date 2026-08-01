"use client";

import { useState, useTransition } from "react";
import { actionCreateSignedResearchFileUrl } from "@/lib/research/actions";

export function ResearchFileDownloadButton({
  sourceId,
  fileId,
}: {
  sourceId: string;
  fileId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await actionCreateSignedResearchFileUrl(sourceId, fileId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          });
        }}
      >
        {pending ? "Preparing…" : "Private download"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
