"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/auth/actions";

export function AuthStatus({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <div className="hidden min-w-0 text-right sm:block">
        <div className="truncate font-medium text-ink">{displayName}</div>
        <div className="truncate text-xs text-ink-subtle">{email}</div>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await logoutAction();
          });
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
