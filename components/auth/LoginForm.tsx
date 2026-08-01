"use client";

import { useEffect, useState, useTransition } from "react";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import {
  createClient,
  getBrowserSupabasePublicEnvDiagnostics,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";
import { SUPABASE_CONFIG_USER_MESSAGE } from "@/lib/supabase/config-errors";

const GENERIC_SUCCESS =
  "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox and spam folder.";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Temporary Preview diagnostic — booleans only, never values.
    console.info(
      "[auth] supabase public env diagnostic",
      getBrowserSupabasePublicEnvDiagnostics(),
    );
  }, []);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          try {
            const diagnostics = getBrowserSupabasePublicEnvDiagnostics();
            console.info("[auth] supabase public env diagnostic", diagnostics);

            if (!hasSupabaseBrowserConfig()) {
              console.error("[auth] sign-in blocked", {
                gate: "missing_supabase_browser_config",
                diagnostics,
              });
              setError(SUPABASE_CONFIG_USER_MESSAGE);
              return;
            }

            let emailRedirectTo: string;
            try {
              emailRedirectTo = getMagicLinkRedirectTo();
            } catch {
              console.error("[auth] sign-in blocked", {
                gate: "invalid_app_url",
                diagnostics,
              });
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

            // Instrumentation only — hashes / counts, never raw secrets.
            try {
              const { collectBrowserPkceInstrumentation } = await import(
                "@/lib/auth/pkce-instrumentation"
              );
              const { resolveBrowserSupabaseUrl } = await import(
                "@/lib/supabase/browser-env"
              );
              console.info(
                "[auth] pkce instrumentation",
                await collectBrowserPkceInstrumentation(
                  resolveBrowserSupabaseUrl(),
                ),
              );
            } catch (instrumentationError) {
              console.error("[auth] pkce instrumentation failed", {
                message:
                  instrumentationError instanceof Error
                    ? instrumentationError.message
                    : String(instrumentationError),
              });
            }

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
