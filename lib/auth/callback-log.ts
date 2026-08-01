/**
 * Safe request metadata for auth callback diagnostics.
 * Never includes query values, tokens, codes, or cookie values.
 */

export type QueryParamPresence = {
  key: string;
  value_present: true;
};

export type SafeCallbackRequestLog = {
  method: string;
  hostname: string;
  pathname: string;
  /** Full request URL with every query value replaced by "***". */
  redactedUrl: string;
  /** Raw query parameter names (including duplicates order as first-seen). */
  queryParamNames: string[];
  /** Per-parameter presence only — never values. */
  queryParams: QueryParamPresence[];
  hasCode: boolean;
  hasTokenHash: boolean;
  hasType: boolean;
  hasError: boolean;
  hasErrorCode: boolean;
  hasErrorDescription: boolean;
  hasPkceCodeVerifier: boolean;
  hasAnyCookies: boolean;
  authCookieNames: string[];
  userAgent: string | null;
  /** Referer with query values redacted when present. */
  referer: string | null;
  refererHost: string | null;
};

/** Replace every query/hash value with "***"; keep keys and structure. */
export function redactUrlForLog(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.search) {
    const redacted = new URLSearchParams();
    for (const key of parsed.searchParams.keys()) {
      // Preserve duplicate keys; always mark presence without the value.
      const count = parsed.searchParams.getAll(key).length;
      for (let i = 0; i < count; i += 1) {
        redacted.append(key, "***");
      }
    }
    parsed.search = redacted.toString();
  }

  if (parsed.hash) {
    // Hash may contain implicit-flow tokens — never log fragment contents.
    parsed.hash = "#***";
  }

  return parsed.toString();
}

function refererFromHeader(referer: string | null): {
  referer: string | null;
  refererHost: string | null;
} {
  if (!referer) return { referer: null, refererHost: null };
  try {
    const parsed = new URL(referer);
    return {
      referer: redactUrlForLog(parsed),
      refererHost: parsed.host,
    };
  } catch {
    // Non-URL referer — log presence only, not the raw string (may contain secrets).
    return { referer: "[unparseable]", refererHost: null };
  }
}

export function buildSafeCallbackRequestLog(input: {
  url: string | URL;
  method?: string;
  headers: Headers | { get(name: string): string | null };
  hasPkceCodeVerifier: boolean;
  hasAnyCookies: boolean;
  authCookieNames: string[];
}): SafeCallbackRequestLog {
  const parsed = typeof input.url === "string" ? new URL(input.url) : input.url;

  // Preserve first-seen order for raw names; also build presence rows.
  const queryParamNames: string[] = [];
  const queryParams: QueryParamPresence[] = [];
  const seen = new Set<string>();
  for (const key of parsed.searchParams.keys()) {
    queryParams.push({ key, value_present: true });
    if (!seen.has(key)) {
      seen.add(key);
      queryParamNames.push(key);
    }
  }

  const { referer, refererHost } = refererFromHeader(input.headers.get("referer"));

  return {
    method: (input.method ?? "GET").toUpperCase(),
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    redactedUrl: redactUrlForLog(parsed),
    queryParamNames,
    queryParams,
    hasCode: parsed.searchParams.has("code"),
    hasTokenHash: parsed.searchParams.has("token_hash"),
    hasType: parsed.searchParams.has("type"),
    hasError: parsed.searchParams.has("error"),
    hasErrorCode: parsed.searchParams.has("error_code"),
    hasErrorDescription: parsed.searchParams.has("error_description"),
    hasPkceCodeVerifier: input.hasPkceCodeVerifier,
    hasAnyCookies: input.hasAnyCookies,
    authCookieNames: [...input.authCookieNames].sort(),
    userAgent: input.headers.get("user-agent"),
    referer,
    refererHost,
  };
}

/** Safe redirect target for logs: path + redacted query, never secrets. */
export function redactRedirectTargetForLog(target: string, fallbackOrigin: string): string {
  try {
    const absolute = target.startsWith("http")
      ? target
      : new URL(target, fallbackOrigin).toString();
    return redactUrlForLog(absolute);
  } catch {
    return "[unparseable-redirect]";
  }
}
