import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getMagicLinkRedirectTo } from "@/lib/auth/app-url";
import { summarizeAuthCookies } from "@/lib/auth/pkce-cookies";
import {
  applyPendingCookies,
  createRouteHandlerClient,
  type PendingCookie,
} from "@/lib/supabase/route";

import type { MagicLinkResult } from "@/lib/auth/magic-link-types";

const emailSchema = z.string().trim().email();

/**
 * Initiates PKCE magic-link sign-in.
 * Uses a Route Handler so the code-verifier cookie is written onto this
 * HTTP response via Set-Cookie (reliable on Vercel).
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

  const email = parsed.data.toLowerCase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  const successBody = {
    ok: true,
    message:
      "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox and spam folder.",
  } satisfies MagicLinkResult;

  const response = applyPendingCookies(
    NextResponse.json(successBody),
    pendingCookies,
  );

  const writtenNames = pendingCookies.map((c) => c.name);
  const cookieSummary = summarizeAuthCookies([
    ...request.cookies.getAll(),
    ...pendingCookies.map(({ name }) => ({ name })),
  ]);

  console.info("[auth] magic link otp cookie state", {
    hasCode: false,
    hasPkceCodeVerifier: cookieSummary.hasPkceCodeVerifier,
    authCookieNames: cookieSummary.authCookieNames,
    writtenCookieNames: writtenNames.filter((n) => n.startsWith("sb-")).sort(),
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
    });
  }

  if (!cookieSummary.hasPkceCodeVerifier && !error) {
    console.error(
      "[auth] PKCE code-verifier cookie was not written to the magic-link response",
      {
        authCookieNames: cookieSummary.authCookieNames,
        writtenCookieNames: writtenNames.filter((n) => n.startsWith("sb-")).sort(),
      },
    );
  }

  return response;
}
