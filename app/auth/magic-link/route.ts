import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import { summarizeAuthCookies } from "@/lib/auth/pkce-cookies";
import {
  applyPendingCookies,
  createRouteHandlerClient,
  pendingCookieNames,
  pendingCookiesForOtpResponse,
  type PendingCookie,
} from "@/lib/supabase/route";

import type { MagicLinkResult } from "@/lib/auth/magic-link-types";

const emailSchema = z.string().trim().email();

const GENERIC_SUCCESS: MagicLinkResult = {
  ok: true,
  message:
    "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox and spam folder.",
};

/**
 * Initiates PKCE magic-link sign-in.
 * Buffers cookies from signInWithOtp and only writes the PKCE verifier to the
 * response when OTP succeeds — failed/rate-limited requests must not overwrite
 * a verifier that matches an earlier successfully sent email.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_email",
        message: "Enter a valid email address.",
      } satisfies MagicLinkResult,
      { status: 400 },
    );
  }

  const emailRaw =
    typeof body === "object" && body && "email" in body
      ? String((body as { email: unknown }).email)
      : "";

  const parsed = emailSchema.safeParse(emailRaw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_email",
        message: "Enter a valid email address.",
      } satisfies MagicLinkResult,
      { status: 400 },
    );
  }

  let emailRedirectTo: string;
  try {
    emailRedirectTo = getMagicLinkRedirectTo();
  } catch (error) {
    console.error("[auth] NEXT_PUBLIC_APP_URL configuration error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        code: "config",
        message:
          "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.",
      } satisfies MagicLinkResult,
      { status: 503 },
    );
  }

  const pendingCookies: PendingCookie[] = [];

  let supabase;
  try {
    supabase = createRouteHandlerClient(request, pendingCookies);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "config",
        message:
          "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.",
      } satisfies MagicLinkResult,
      { status: 503 },
    );
  }

  const priorVerifier = summarizeAuthCookies(request.cookies.getAll());
  const email = parsed.data.toLowerCase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  // Buffer only — never flush verifier cookies on OTP failure (incl. rate limit).
  const cookiesToWrite = pendingCookiesForOtpResponse(pendingCookies, error);
  const response = applyPendingCookies(
    NextResponse.json(GENERIC_SUCCESS),
    cookiesToWrite,
  );

  console.info("[auth] magic link otp cookie state", {
    hasCode: false,
    otpSucceeded: !error,
    appliedPkceCookies: cookiesToWrite.length > 0,
    priorHadPkceCodeVerifier: priorVerifier.hasPkceCodeVerifier,
    priorAuthCookieNames: priorVerifier.authCookieNames,
    bufferedCookieNames: pendingCookieNames(pendingCookies),
    writtenCookieNames: pendingCookieNames(cookiesToWrite),
    emailRedirectToHost: (() => {
      try {
        return new URL(emailRedirectTo).host;
      } catch {
        return "invalid";
      }
    })(),
  });

  if (error) {
    console.error("[auth] magic link request failed", {
      message: error.message,
      status: error.status,
      code: error.code,
      discardedBufferedCookieNames: pendingCookieNames(pendingCookies),
    });
  }

  if (!error && cookiesToWrite.every((c) => !c.name.includes("-code-verifier"))) {
    console.error(
      "[auth] PKCE code-verifier cookie was not written to the magic-link response",
      {
        writtenCookieNames: pendingCookieNames(cookiesToWrite),
        bufferedCookieNames: pendingCookieNames(pendingCookies),
      },
    );
  }

  return response;
}
