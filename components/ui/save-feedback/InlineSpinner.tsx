import { clsx } from "clsx";

export function InlineSpinner({
  label = "Saving",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
