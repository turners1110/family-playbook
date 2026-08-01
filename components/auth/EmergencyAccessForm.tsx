"use client";

import { useState, useTransition } from "react";
import { submitEmergencyAccessCode } from "@/lib/auth/emergency-actions";

export function EmergencyAccessForm({
  initialError,
}: {
  initialError?: string | null;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await submitEmergencyAccessCode(formData);
          if (!result.ok) {
            setError(result.message);
          }
        });
      }}
    >
      <div className="field">
        <label htmlFor="code">Family access code</label>
        <input
          id="code"
          name="code"
          type="password"
          autoComplete="one-time-code"
          required
          className="input"
          placeholder="Enter access code"
          disabled={pending}
          inputMode="text"
        />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
      {error && (
        <p
          className="rounded-xl border border-border bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
