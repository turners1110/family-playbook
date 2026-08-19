export type UserErrorKind =
  | "network"
  | "save"
  | "not_found"
  | "auth"
  | "conflict"
  | "system";

export function classifyUserError(error: unknown): {
  kind: UserErrorKind;
  title: string;
  body: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (
    /unauthenticated|session expired|sign in|jwt|auth/i.test(message) ||
    lower.includes("unauthorized")
  ) {
    return {
      kind: "auth",
      title: "Your session expired",
      body: "Sign in again to continue.",
    };
  }
  if (
    /failed to fetch|networkerror|offline|econn|connection lost|load failed/i.test(
      message,
    )
  ) {
    return {
      kind: "network",
      title: "Connection lost",
      body: "Retry when you're back online.",
    };
  }
  if (/version conflict|another update was saved/i.test(message)) {
    return {
      kind: "conflict",
      title: "Another update was saved first",
      body: "Retry your changes. Your entry is still here.",
    };
  }
  if (/not found|no longer available/i.test(message)) {
    return {
      kind: "not_found",
      title: "This page isn't available",
      body: "It may have been moved or is no longer available.",
    };
  }
  if (/couldn.?t save|could not save|save failed/i.test(message)) {
    return {
      kind: "save",
      title: "We couldn't save this yet",
      body: "Your entry is still here.",
    };
  }
  return {
    kind: "system",
    title: "Something went wrong",
    body: "You can retry this page or go back to Home.",
  };
}

export function logRouteError(entry: {
  route?: string;
  operation?: string;
  digest?: string;
  kind?: UserErrorKind;
}) {
  console.info("[route_error]", {
    route: entry.route ?? null,
    operation: entry.operation ?? "render",
    digest: entry.digest ?? null,
    kind: entry.kind ?? "system",
  });
}
