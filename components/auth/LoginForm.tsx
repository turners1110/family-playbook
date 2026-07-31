"use client";

import { useState, useTransition } from "react";
import { requestMagicLink } from "@/lib/auth/actions";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await requestMagicLink(email);
          if (result.ok) {
            setMessage(result.message);
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending link…" : "Email me a magic link"}
      </button>

      {message && (
        <p className="rounded-xl border border-border bg-accent-soft/50 px-3 py-2 text-sm text-accent-strong" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-border bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
