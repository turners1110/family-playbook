"use client";

import { useState, useTransition } from "react";
import { downloadStoreBackupAction } from "@/lib/actions/backup";

export function BackupDownloadButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await downloadStoreBackupAction();
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const blob = new Blob([result.json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
          });
        }}
      >
        {pending ? "Preparing backup…" : "Download full JSON backup"}
      </button>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
