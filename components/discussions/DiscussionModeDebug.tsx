/** Dev / Storage Debug discussion-mode diagnostics — never shows answer text. */
export function DiscussionModeDebug({
  questionId,
  storedMode,
  resolvedMode,
  source,
  surface,
}: {
  questionId: string;
  storedMode: string | null;
  resolvedMode: string;
  source: string;
  surface: string;
}) {
  const show =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DISCUSSION_MODE_DEBUG === "1";
  if (!show) return null;
  return (
    <div
      className="mb-3 rounded-lg border border-dashed border-border bg-bg-muted/40 px-3 py-2 font-mono text-xs text-ink-subtle"
      data-testid="discussion-mode-debug"
    >
      <div>question: {questionId}</div>
      <div>stored: {storedMode ?? "missing"}</div>
      <div>resolved: {resolvedMode}</div>
      <div>source: {source}</div>
      <div>surface: {surface}</div>
    </div>
  );
}
