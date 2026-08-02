import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  saveButtonIdleLabel,
  type SaveUiState,
} from "@/lib/ui/save-feedback";
import { InlineSpinner } from "./InlineSpinner";
import { SavedIndicator } from "./SavedIndicator";

export function SaveButton({
  state,
  idleLabel = "Save and next",
  onClick,
  className,
  disabled,
}: {
  state: SaveUiState;
  idleLabel?: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const busy =
    state === "saving" || state === "saved" || state === "moving_to_next";
  const text = saveButtonIdleLabel(state, idleLabel);
  let label: ReactNode = text;
  if (state === "saving") {
    label = (
      <>
        <InlineSpinner label="Saving" />
        {text}
      </>
    );
  } else if (state === "saved") {
    label = <SavedIndicator />;
  } else if (state === "moving_to_next") {
    label = (
      <>
        <InlineSpinner label="Loading next question" />
        {text}
      </>
    );
  }

  return (
    <button
      type="button"
      className={clsx("btn btn-primary min-h-11", className)}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      aria-live="polite"
    >
      {label}
    </button>
  );
}
