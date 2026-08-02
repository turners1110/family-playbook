export function SlowSaveNotice({ tier }: { tier: 0 | 1 | 2 }) {
  if (tier === 0) return null;
  return (
    <p className="text-sm text-ink-muted" aria-live="polite">
      {tier === 1
        ? "Still saving securely…"
        : "This is taking longer than usual. Your answer is still on this screen."}
    </p>
  );
}
