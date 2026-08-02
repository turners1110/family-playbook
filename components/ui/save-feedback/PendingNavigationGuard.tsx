export function PendingNavigationGuard({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-nav-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-bg-elevated p-5 shadow-lg">
        <h2 id="pending-nav-title" className="font-display text-xl">
          Your answer is still saving.
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Stay on this screen until saving finishes, or leave without waiting.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary min-h-11 flex-1" onClick={onStay}>
            Stay
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 flex-1"
            onClick={onLeave}
          >
            Leave without waiting
          </button>
        </div>
      </div>
    </div>
  );
}
