import { createHash, timingSafeEqual } from "node:crypto";

// Pure OAuth 2.1 helpers shared by the authorization server routes and the
// consent page. No database or request access here, so it is unit tested
// directly (src/lib/oauth.test.ts).

/** The only access scope: full access to this account's dashboard through MCP. */
export const SCOPE = "mcp";
/** offline_access is listed so Claude and ChatGPT ask for (and keep) refresh tokens. */
export const SCOPES_SUPPORTED = [SCOPE, "offline_access"];

/**
 * The scope string to grant for a requested one. Unknown scopes (openid,
 * email...) are dropped rather than refused, and `mcp` is always granted.
 */
export function grantedScope(requested: string | null | undefined): string {
  const asked = new Set((requested ?? "").split(/\s+/).filter(Boolean));
  return SCOPES_SUPPORTED.filter((s) => s === SCOPE || asked.has(s)).join(" ");
}
export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_S = 60 * 60 * 24 * 60;
export const CODE_TTL_S = 5 * 60;

export const MCP_PATH = "/api/mcp";
export const ENDPOINTS = {
  authorize: "/oauth/authorize",
  token: "/api/oauth/token",
  register: "/api/oauth/register",
  revoke: "/api/oauth/revoke",
  protectedResource: "/.well-known/oauth-protected-resource",
  authServer: "/.well-known/oauth-authorization-server",
} as const;

export const DOCS_URL = "https://github.com/filippo-fonseca/hyperpolymath-v3/blob/HEAD/docs/connect/README.md";

/* ---------------- metadata ---------------- */

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: origin + MCP_PATH,
    authorization_servers: [origin],
    scopes_supported: SCOPES_SUPPORTED,
    bearer_methods_supported: ["header"],
    resource_name: "Hyperpolymath",
    resource_documentation: DOCS_URL,
  };
}

/** RFC 8414 authorization server metadata. Public clients with PKCE only. */
export function authServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: origin + ENDPOINTS.authorize,
    token_endpoint: origin + ENDPOINTS.token,
    registration_endpoint: origin + ENDPOINTS.register,
    revocation_endpoint: origin + ENDPOINTS.revoke,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES_SUPPORTED,
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: DOCS_URL,
  };
}

/** The `WWW-Authenticate` challenge on a 401 from the MCP endpoint. */
export function bearerChallenge(origin: string, error?: "invalid_token") {
  const parts = [`resource_metadata="${origin}${ENDPOINTS.protectedResource}${MCP_PATH}"`, `scope="${SCOPE}"`];
  if (error) parts.push(`error="${error}"`);
  return `Bearer ${parts.join(", ")}`;
}

/* ---------------- tokens and PKCE ---------------- */

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const b64url = (buf: Buffer) => buf.toString("base64url");

/** RFC 7636 S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const expected = Buffer.from(b64url(createHash("sha256").update(verifier).digest()));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const isPkceChallenge = (c: string) => /^[A-Za-z0-9\-_]{43}$/.test(c);

/* ---------------- resource indicators (RFC 8707) ---------------- */

/** The canonical MCP resource for this origin, or null if `resource` names something else. */
export function matchResource(resource: string | null | undefined, origin: string): string | null {
  const canonical = origin + MCP_PATH;
  if (!resource) return canonical;
  try {
    const u = new URL(resource);
    if (u.hash || u.search) return null;
    const path = u.pathname.replace(/\/+$/, "");
    if (u.origin === origin && (path === MCP_PATH || path === "")) return canonical;
  } catch {
    /* fall through */
  }
  return null;
}

/* ---------------- redirect URIs ---------------- */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"]);

/**
 * A redirect URI a client may register: absolute, no fragment, and https, an
 * http loopback address (RFC 8252 native apps), or a private-use app scheme
 * like `cursor://...`.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || raw.includes("#")) return false;
  if (u.username || u.password) return false;
  if (BLOCKED_SCHEMES.has(u.protocol)) return false;
  if (u.protocol === "https:") return !!u.hostname;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
  // Private-use scheme: letters, digits, + - . only (RFC 3986).
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol);
}

/**
 * Does the redirect_uri in a request match one the client registered? Exact
 * string match, except loopback URIs ignore the port (RFC 8252 section 7.3),
 * since native clients pick a free port at sign-in time.
 */
export function redirectMatches(requested: string, registered: readonly string[]): boolean {
  if (registered.includes(requested)) return true;
  let r: URL;
  try {
    r = new URL(requested);
  } catch {
    return false;
  }
  if (r.protocol !== "http:" || !LOOPBACK.has(r.hostname)) return false;
  return registered.some((reg) => {
    try {
      const g = new URL(reg);
      return (
        g.protocol === "http:" &&
        g.hostname === r.hostname &&
        g.pathname === r.pathname &&
        g.search === r.search
      );
    } catch {
      return false;
    }
  });
}

/** Where the person will be sent back to, for the consent screen. */
export function redirectLabel(uri: string): string {
  try {
    const u = new URL(uri);
    if (u.protocol === "http:" && LOOPBACK.has(u.hostname)) return "an app on this computer";
    if (u.protocol === "https:") return u.hostname.replace(/^www\./, "");
    return `the ${u.protocol.slice(0, -1)} app`;
  } catch {
    return "the app";
  }
}

/** Add the authorization response params (RFC 6749 + RFC 9207 `iss`) to a redirect URI. */
export function withParams(uri: string, params: Record<string, string | undefined | null>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
  return u.toString();
}

/* ---------------- client metadata ---------------- */

/**
 * A Client ID Metadata Document URL: https, a real path, no fragment,
 * credentials, query or IP-literal / local host (we fetch it server side).
 */
export function isCimdUrl(raw: string): boolean {
  if (typeof raw !== "string" || raw.length > 500 || !raw.startsWith("https://")) return false;
  try {
    const u = new URL(raw);
    if (u.hash || u.search || u.username || u.password || u.port) return false;
    if (u.pathname === "/" || u.pathname === "") return false;
    return isPublicHostname(u.hostname);
  } catch {
    return false;
  }
}

/** Rejects IP literals and names that only resolve inside a private network. */
export function isPublicHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (!h.includes(".")) return false;
  if (/^\d+(\.\d+){3}$/.test(h) || h.startsWith("[")) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|test|invalid|example)$/.test(h);
}

/** Private, loopback, link-local and other non-routable IPs (v4 and v6). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff");
}

export type ClientMetadata = {
  name: string;
  client_uri: string | null;
  logo_uri: string | null;
  redirect_uris: string[];
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const httpsUrl = (v: unknown) => {
  const s = str(v, 500);
  if (!s) return null;
  try {
    return new URL(s).protocol === "https:" ? s : null;
  } catch {
    return null;
  }
};

/** A display name for a client that didn't give one. */
function fallbackName(redirects: string[], clientId?: string): string {
  const first = redirects[0] ? redirectLabel(redirects[0]) : null;
  if (clientId?.startsWith("https://")) return new URL(clientId).hostname.replace(/^www\./, "");
  return first && !first.startsWith("an app") && !first.startsWith("the ") ? first : "An MCP client";
}

/**
 * Validate client metadata from a registration request (RFC 7591) or a CIMD
 * document. Returns the cleaned fields or an error description.
 */
export function parseClientMetadata(
  body: unknown,
  opts: { clientId?: string } = {},
): { ok: true; value: ClientMetadata } | { ok: false; error: string; field: "redirect_uri" | "client_metadata" } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, field: "client_metadata", error: "Client metadata must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  if (opts.clientId !== undefined && b.client_id !== opts.clientId) {
    return { ok: false, field: "client_metadata", error: "client_id in the metadata document must equal its URL." };
  }
  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10) {
    return { ok: false, field: "redirect_uri", error: "redirect_uris must list 1 to 10 URIs." };
  }
  const bad = uris.find((u) => !isAllowedRedirectUri(u as string));
  if (bad !== undefined) {
    return { ok: false, field: "redirect_uri", error: `Redirect URI not allowed: ${String(bad).slice(0, 200)}` };
  }
  const grants = b.grant_types;
  if (grants !== undefined) {
    if (!Array.isArray(grants) || !grants.includes("authorization_code")) {
      return { ok: false, field: "client_metadata", error: "grant_types must include authorization_code." };
    }
  }
  const responses = b.response_types;
  if (responses !== undefined && (!Array.isArray(responses) || !responses.includes("code"))) {
    return { ok: false, field: "client_metadata", error: "response_types must include code." };
  }
  const redirect_uris = [...new Set(uris as string[])];
  return {
    ok: true,
    value: {
      name: str(b.client_name, 100) ?? fallbackName(redirect_uris, opts.clientId),
      client_uri: httpsUrl(b.client_uri),
      logo_uri: httpsUrl(b.logo_uri),
      redirect_uris,
    },
  };
}

/** Recognise well-known clients so the consent screen can show a friendly mark. */
export function knownClient(name: string, redirects: readonly string[]): "claude" | "chatgpt" | "grok" | null {
  const hay = `${name} ${redirects.join(" ")}`.toLowerCase();
  if (hay.includes("claude.ai") || /\bclaude\b/.test(hay)) return "claude";
  if (hay.includes("chatgpt.com") || hay.includes("openai") || /\bchatgpt\b/.test(hay)) return "chatgpt";
  if (hay.includes("grok") || hay.includes("cursor")) return "grok";
  return null;
}
