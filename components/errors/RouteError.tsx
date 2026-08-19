"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { classifyUserError, logRouteError } from "@/lib/errors/user-facing";

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const classified = classifyUserError(error);

  useEffect(() => {
    logRouteError({
      route: pathname ?? undefined,
      digest: error.digest,
      kind: classified.kind,
      operation: "render",
    });
  }, [classified.kind, error.digest, pathname]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-subtle">
        Turner Family Playbook
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">{classified.title}</h1>
      <p className="mt-3 text-ink-muted">{classified.body}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-ink-subtle">Reference {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary min-h-11" onClick={reset}>
          Retry
        </button>
        <Link href="/home" className="btn btn-secondary min-h-11">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
