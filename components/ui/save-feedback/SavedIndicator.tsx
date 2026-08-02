export function SavedIndicator({ label = "Saved" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-live="polite">
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white"
      >
        ✓
      </span>
      <span>{label}</span>
    </span>
  );
}
