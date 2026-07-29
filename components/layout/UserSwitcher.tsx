"use client";

import { useTransition } from "react";
import { actionSwitchUser } from "@/lib/actions";

export function UserSwitcher({
  users,
  currentUserId,
}: {
  users: Array<{ id: string; display_name: string }>;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="hidden sm:inline">Signed in as</span>
      <select
        className="select min-h-10 w-auto py-1"
        value={currentUserId}
        disabled={pending}
        aria-label="Switch family member"
        onChange={(e) => {
          const value = e.target.value;
          startTransition(async () => {
            await actionSwitchUser(value);
          });
        }}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
