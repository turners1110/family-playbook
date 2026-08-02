export function CardSkeleton() {
  return (
    <div
      className="surface animate-pulse space-y-4 p-5"
      aria-busy="true"
      aria-label="Loading next question"
    >
      <div className="h-3 w-24 rounded bg-bg-muted" />
      <div className="h-8 w-4/5 rounded bg-bg-muted" />
      <div className="h-4 w-full rounded bg-bg-muted" />
      <div className="space-y-2 pt-2">
        <div className="h-12 w-full rounded-xl bg-bg-muted" />
        <div className="h-12 w-full rounded-xl bg-bg-muted" />
        <div className="h-12 w-full rounded-xl bg-bg-muted" />
      </div>
    </div>
  );
}
