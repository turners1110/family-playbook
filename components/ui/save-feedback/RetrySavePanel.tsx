import type { SaveUiState } from "@/lib/ui/save-feedback";

export function RetrySavePanel({
  state,
  message,
  onRetry,
  disabled,
}: {
  state: SaveUiState;
  message: string | null;
  onRetry: () => void;
  disabled?: boolean;
}) {
  if (state !== "failed" && state !== "conflict") return null;
  return (
    <div
      className="rounded-xl border border-danger/40 bg-danger-soft/50 p-3 text-sm"
      role="alert"
      aria-live="assertive"
    >
      <p className="font-medium text-danger">
        {state === "conflict" ? "Another update was saved first" : "Couldn’t save"}
      </p>
      <p className="mt-1 text-ink-muted">
        {message ?? "Your answer is still on this screen."}
      </p>
      <button
        type="button"
        className="btn btn-primary mt-3 min-h-11"
        onClick={onRetry}
        disabled={disabled}
      >
        Retry
      </button>
    </div>
  );
}
