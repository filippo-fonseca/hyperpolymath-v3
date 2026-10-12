// Sign-in error handling shared by the auth callback, the login action and the
// login form. Pure functions so they are easy to test.

/** Reasons the callback can send back to /login as `?error=<reason>`. */
export type LoginErrorReason =
  | "link_expired"
  | "link_invalid"
  | "link_other_browser"
  | "not_allowed"
  | "auth_unavailable"
  | "unknown";

export const LOGIN_ERROR_TEXT: Record<LoginErrorReason, { title: string; body: string }> = {
  link_expired: {
    title: "That link has expired",
    body: "Sign-in links work once, for a limited time. Request a fresh one below.",
  },
  link_invalid: {
    title: "That link didn't work",
    body: "It may have been used already or copied incompletely. Request a fresh one below.",
  },
  link_other_browser: {
    title: "Open the link in this browser",
    body: "Sign-in links only work in the browser that requested them. Request a new one here, or open the email on the device you used.",
  },
  not_allowed: {
    title: "That account can't sign in here",
    body: "This dashboard is private to its owner.",
  },
  auth_unavailable: {
    title: "Sign-in is having a moment",
    body: "The sign-in service didn't respond. Wait a minute and try again.",
  },
  unknown: {
    title: "Something went wrong",
    body: "Request a fresh sign-in link and try again.",
  },
};

const REASONS = new Set<string>(Object.keys(LOGIN_ERROR_TEXT));

/** Narrow an untrusted `?error=` value to a known reason (or null). */
export function asLoginError(value: string | null | undefined): LoginErrorReason | null {
  if (!value) return null;
  if (REASONS.has(value)) return value as LoginErrorReason;
  return "unknown";
}

type ErrorLike = { code?: string | null; name?: string | null; status?: number | null; message?: string | null };

/** Map a Supabase error code (from a query/hash param or an AuthError) to a reason. */
export function reasonFromCode(code: string | null | undefined, description?: string | null): LoginErrorReason {
  switch (code) {
    case "otp_expired":
    case "flow_state_expired":
      return "link_expired";
    case "flow_state_not_found":
    case "bad_code_verifier":
    case "pkce_code_verifier_not_found":
      return "link_other_browser";
    case "otp_disabled":
    case "bad_jwt":
    case "validation_failed":
    case "invalid_request":
    case "invalid_credentials":
      return "link_invalid";
    case "signup_disabled":
    case "user_banned":
    case "email_address_not_authorized":
    case "unauthorized_client":
      return "not_allowed";
    case "server_error":
    case "temporarily_unavailable":
    case "unexpected_failure":
    case "request_timeout":
      return "auth_unavailable";
  }
  const d = (description ?? "").toLowerCase();
  if (d.includes("expired")) return "link_expired";
  if (d.includes("code verifier") || d.includes("flow state")) return "link_other_browser";
  if (d.includes("invalid")) return "link_invalid";
  return "unknown";
}

/**
 * Error params Supabase puts on the redirect when a link fails before it
 * reaches us, e.g. `?error=access_denied&error_code=otp_expired&error_description=...`.
 * Returns null when there's no error.
 */
export function reasonFromParams(params: URLSearchParams): LoginErrorReason | null {
  const error = params.get("error");
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!error && !code && !description) return null;
  // `access_denied` alone is generic; the code says why.
  return reasonFromCode(code ?? (error === "access_denied" ? null : error), description);
}

/** Map a thrown or returned Supabase AuthError from code exchange / OTP verify. */
export function reasonFromAuthError(err: ErrorLike): LoginErrorReason {
  if (err.name === "AuthPKCECodeVerifierMissingError") return "link_other_browser";
  if (err.name === "AuthRetryableFetchError" || (err.status ?? 0) >= 500) return "auth_unavailable";
  const r = reasonFromCode(err.code, err.message);
  return r === "unknown" ? "link_invalid" : r;
}

/** True when signInWithOtp was refused for sending too often. */
export function isRateLimited(err: ErrorLike): boolean {
  return err.status === 429 || err.code === "over_email_send_rate_limit" || err.code === "over_request_rate_limit";
}

/** Seconds to wait from a rate-limit error ("...only request this after 42 seconds."), default 60. */
export function retryAfterSeconds(err: ErrorLike, fallback = 60): number {
  const m = /after (\d+) seconds?/i.exec(err.message ?? "");
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 3600 ? n : fallback;
}

/**
 * Only same-origin relative paths are allowed as a post-login destination.
 * Anything else (absolute URLs, protocol-relative `//host`, backslash tricks,
 * the auth routes themselves) falls back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\\]/.test(next)) return "/";
  if (next.startsWith("/auth/") || next === "/login" || next.startsWith("/login?") || next.startsWith("/api/")) return "/";
  try {
    const u = new URL(next, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
