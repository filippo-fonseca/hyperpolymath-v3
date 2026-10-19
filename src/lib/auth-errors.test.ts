import { describe, expect, it } from "vitest";
import {
  asLoginError,
  isRateLimited,
  passwordProblem,
  reasonFromAuthError,
  reasonFromParams,
  retryAfterSeconds,
  safeNextPath,
} from "./auth-errors";

describe("reasonFromParams", () => {
  it("is null without error params", () => {
    expect(reasonFromParams(new URLSearchParams("code=abc"))).toBeNull();
  });
  it("maps an expired email link", () => {
    const p = new URLSearchParams("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(reasonFromParams(p)).toBe("link_expired");
  });
  it("maps server errors", () => {
    expect(reasonFromParams(new URLSearchParams("error=server_error"))).toBe("auth_unavailable");
  });
  it("falls back on the description", () => {
    expect(reasonFromParams(new URLSearchParams("error=access_denied&error_description=Link+expired"))).toBe("link_expired");
    expect(reasonFromParams(new URLSearchParams("error=weird"))).toBe("unknown");
  });
});

describe("reasonFromAuthError", () => {
  it("spots a link opened in another browser", () => {
    expect(reasonFromAuthError({ name: "AuthPKCECodeVerifierMissingError", message: "x" })).toBe("link_other_browser");
    expect(reasonFromAuthError({ code: "flow_state_not_found", status: 404, message: "invalid flow state" })).toBe("link_other_browser");
  });
  it("maps expiry, outages and everything else", () => {
    expect(reasonFromAuthError({ code: "otp_expired", status: 403, message: "Token has expired" })).toBe("link_expired");
    expect(reasonFromAuthError({ status: 503, message: "down" })).toBe("auth_unavailable");
    expect(reasonFromAuthError({ status: 400, message: "nope" })).toBe("link_invalid");
  });
});

describe("rate limits", () => {
  it("detects 429s and parses the wait", () => {
    const err = { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 42 seconds." };
    expect(isRateLimited(err)).toBe(true);
    expect(retryAfterSeconds(err)).toBe(42);
    expect(retryAfterSeconds({ message: "Email rate limit exceeded" })).toBe(60);
    expect(isRateLimited({ status: 400 })).toBe(false);
  });
});

describe("asLoginError", () => {
  it("narrows untrusted values", () => {
    expect(asLoginError(null)).toBeNull();
    expect(asLoginError("link_expired")).toBe("link_expired");
    expect(asLoginError("<script>")).toBe("unknown");
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/?view=week#x")).toBe("/?view=week#x");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/%0d%0aLocation:x", "/\tx", "evil"]) {
      const out = safeNextPath(bad);
      expect(out.startsWith("/") && !out.startsWith("//")).toBe(true);
      expect(out).not.toContain("evil.example");
    }
  });
  it("never loops back into the auth routes", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/auth/callback?code=1")).toBe("/");
  });
});

describe("passwordProblem", () => {
  it("wants at least 8 characters", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("long enough")).toBeNull();
  });
  it("rejects blank and over-long passwords", () => {
    expect(passwordProblem("        ")).toMatch(/spaces/);
    expect(passwordProblem("é".repeat(40))).toMatch(/too long/);
  });
});
