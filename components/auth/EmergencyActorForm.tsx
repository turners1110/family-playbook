"use client";

import { useState, useTransition } from "react";
import { selectEmergencyActor } from "@/lib/auth/emergency-actions";

export function EmergencyActorForm({
  samLabel,
  michelleLabel,
}: {
  samLabel: string;
  michelleLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await selectEmergencyActor(formData);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <button
        type="submit"
        name="actor"
        value="sam"
        className="btn btn-primary w-full"
        disabled={pending}
      >
        Continue as {samLabel}
      </button>
      <button
        type="submit"
        name="actor"
        value="michelle"
        className="btn btn-secondary w-full"
        disabled={pending}
      >
        Continue as {michelleLabel}
      </button>
      {error && (
        <p
          className="rounded-xl border border-border bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-ink-subtle">
        This temporary selector is only for Trip Mode. Magic-link identity stays
        separate when Supabase Auth is used.
      </p>
    </form>
  );
}
