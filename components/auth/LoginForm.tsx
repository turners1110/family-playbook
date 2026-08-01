"use client";

import { useState, useTransition } from "react";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";
import {
  SUPABASE_CONFIG_USER_MESSAGE,
  requireSupabasePublicConfig,
} from "@/lib/supabase/env";

const GENERIC_SUCCESS =
  "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox and spam folder.";

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
          try {
            if (!hasSupabaseBrowserConfig()) {
              // Logs missing_url vs missing_public_key for operators.
              try {
                requireSupabasePublicConfig();
              } catch {
                /* already logged */
              }
              setError(SUPABASE_CONFIG_USER_MESSAGE);
              return;
            }

            let emailRedirectTo: string;
            try {
              emailRedirectTo = getMagicLinkRedirectTo();
            } catch {
              // getAppOrigin already logged invalid_app_url.
              setError(SUPABASE_CONFIG_USER_MESSAGE);
              return;
            }

            const supabase = createClient();
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email: email.trim().toLowerCase(),
              options: {
                shouldCreateUser: false,
                emailRedirectTo,
              },
            });

            // Intentionally do not reveal whether the email exists or rate limits.
            if (otpError) {
              console.error("[auth] browser magic link request failed", {
                message: otpError.message,
                status: otpError.status,
                code: otpError.code,
              });
            }

            setMessage(GENERIC_SUCCESS);
          } catch {
            setError("Something went wrong. Please try again.");
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
        <p
          className="rounded-xl border border-border bg-accent-soft/50 px-3 py-2 text-sm text-accent-strong"
          role="status"
        >
          {message}
        </p>
      )}
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
