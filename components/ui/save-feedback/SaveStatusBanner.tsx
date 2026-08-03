import { clsx } from "clsx";
import type { SaveUiState } from "@/lib/ui/save-feedback";
import { durableSaveStatusLabel } from "@/lib/ui/save-feedback";

export function SaveStatusBanner({
  state,
  message,
}: {
  state: SaveUiState;
  message?: string | null;
}) {
  const label = message || durableSaveStatusLabel(state);
  const tone =
    state === "failed" || state === "conflict"
      ? "danger"
      : state === "saving" ||
          state === "verifying" ||
          state === "retrying"
        ? "pending"
        : "ok";

  return (
    <p
      className={clsx(
        "flex items-center gap-2 text-sm",
        tone === "danger" && "text-danger",
        tone === "pending" && "text-ink-muted",
        tone === "ok" && "text-ink-muted",
      )}
      aria-live="polite"
      role="status"
    >
      <span aria-hidden>
        {tone === "danger" ? "●" : tone === "pending" ? "●" : "●"}
      </span>
      <span
        className={clsx(
          tone === "danger" && "font-medium",
          tone === "ok" && "text-accent-strong",
        )}
      >
        {label}
      </span>
    </p>
  );
}
