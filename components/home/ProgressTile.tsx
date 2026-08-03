import Link from "next/link";

/** Clickable Home progress tile — entire surface is the link. */
export function ProgressTile({
  href,
  label,
  value,
  explanation,
  hint,
}: {
  href: string;
  label: string;
  value: string | number;
  explanation: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="surface group block min-h-[7.5rem] p-4 transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      aria-label={`${label}: ${value}. ${explanation}. Open details.`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-ink-muted">{label}</div>
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-xs text-ink-subtle group-hover:border-accent group-hover:text-accent"
          title={explanation}
          aria-hidden
        >
          i
        </span>
      </div>
      <div className="mt-1 font-display text-3xl text-ink">{value}</div>
      <p className="mt-1 text-xs text-ink-subtle">{explanation}</p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      <p className="mt-2 text-xs font-medium text-accent opacity-90 group-hover:opacity-100">
        View details →
      </p>
    </Link>
  );
}
