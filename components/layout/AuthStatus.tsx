"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { emergencyLogoutAction } from "@/lib/auth/emergency-actions";

export function AuthStatus({
  displayName,
  email,
  mode = "supabase",
}: {
  displayName: string;
  email: string;
  mode?: "supabase" | "emergency";
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
            if (mode === "emergency") {
              await emergencyLogoutAction();
            } else {
              await logoutAction();
            }
          });
        }}
      >
        {pending
          ? "Signing out…"
          : mode === "emergency"
            ? "End trip session"
            : "Sign out"}
      </button>
    </div>
  );
}
