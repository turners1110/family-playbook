import type { SaveUiState } from "@/lib/ui/save-feedback";
import { SaveStatusBanner } from "./SaveStatusBanner";
import { SlowSaveNotice } from "./SlowSaveNotice";
import { RetrySavePanel } from "./RetrySavePanel";

/** Canonical inline save feedback for durable writes. */
export function SaveStatus({
  state,
  message,
  slowTier = 0,
  onRetry,
}: {
  state: SaveUiState;
  message?: string | null;
  slowTier?: 0 | 1 | 2;
  onRetry?: () => void;
}) {
  if (state === "idle" && !message) return null;
  return (
    <div className="space-y-2">
      <SaveStatusBanner state={state} message={message} />
      <SlowSaveNotice tier={slowTier} />
      {onRetry ? (
        <RetrySavePanel
          state={state}
          message={message ?? null}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  );
}
