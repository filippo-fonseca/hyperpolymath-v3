import "server-only";
import type { DB } from "./ctx";
import { OAuthError, checkRedirect, resolveClient, type OAuthClient } from "./oauth";
import { grantedScope, isPkceChallenge, matchResource, withParams } from "@/lib/oauth";
import { AUTHORIZE_FIELDS, type AuthorizeParams } from "@/lib/oauth-fields";

// Validation for /oauth/authorize, shared by the consent page (to render it)
// and the approve/deny Server Actions (which re-check everything, since the
// form fields come back from the browser).
//
// Order matters (RFC 6749 section 4.1.2.1): until the client and redirect_uri
// are known good, errors are shown on our page and never redirected, so this
// can't be used as an open redirect.

export { AUTHORIZE_FIELDS, type AuthorizeParams };

export type AuthorizeCheck =
  | { kind: "fatal"; title: string; detail: string }
  | { kind: "redirect"; url: string }
  | {
      kind: "ok";
      client: OAuthClient;
      redirectUri: string;
      codeChallenge: string;
      scope: string;
      resource: string;
      state: string | undefined;
      issuer: string;
    };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Pick the known authorize params out of a searchParams object or FormData. */
export function pickParams(source: Record<string, string | string[] | undefined> | FormData): AuthorizeParams {
  const out: AuthorizeParams = {};
  for (const k of AUTHORIZE_FIELDS) {
    const v = source instanceof FormData ? source.get(k) : first(source[k]);
    if (typeof v === "string" && v.length > 0 && v.length <= 2048) out[k] = v;
  }
  return out;
}

/** The authorization response URL for an error, with state and iss (RFC 9207). */
export function errorRedirect(redirectUri: string, issuer: string, state: string | undefined, error: string, description: string) {
  return withParams(redirectUri, { error, error_description: description, state, iss: issuer });
}

export async function checkAuthorize(db: DB, p: AuthorizeParams, issuer: string): Promise<AuthorizeCheck> {
  let client: OAuthClient;
  try {
    client = await resolveClient(db, p.client_id);
  } catch (e) {
    return {
      kind: "fatal",
      title: "This app couldn't be identified",
      detail: e instanceof OAuthError ? e.message : "The app's details couldn't be loaded. Try connecting again from the app.",
    };
  }
  let redirectUri: string;
  try {
    redirectUri = checkRedirect(client, p.redirect_uri);
  } catch (e) {
    return {
      kind: "fatal",
      title: "This sign-in link doesn't look right",
      detail: e instanceof OAuthError ? e.message : "The return address doesn't match the app.",
    };
  }

  const fail = (error: string, description: string): AuthorizeCheck => ({
    kind: "redirect",
    url: errorRedirect(redirectUri, issuer, p.state, error, description),
  });
  if (p.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (!p.code_challenge || !isPkceChallenge(p.code_challenge)) return fail("invalid_request", "A PKCE code_challenge is required.");
  if ((p.code_challenge_method ?? "plain") !== "S256") return fail("invalid_request", "code_challenge_method must be S256.");
  const resource = matchResource(p.resource, issuer);
  if (!resource) return fail("invalid_target", "resource must be this server's MCP URL.");

  return {
    kind: "ok",
    client,
    redirectUri,
    codeChallenge: p.code_challenge,
    scope: grantedScope(p.scope),
    resource,
    state: p.state,
    issuer,
  };
}
