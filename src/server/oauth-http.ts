import "server-only";
import { OAuthError } from "./oauth";

// HTTP plumbing for the OAuth routes and the MCP endpoint: the public origin,
// CORS for browser-based MCP clients (bearer tokens only, never cookies, so a
// wildcard origin is safe), and RFC 6749 style JSON errors.

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** The origin clients reached us on, from the proxy headers Vercel sets. */
export function originFrom(headers: Headers, fallbackUrl?: string): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0].trim();
  if (!host) return fallbackUrl ? new URL(fallbackUrl).origin : "http://localhost:3000";
  const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? (LOCAL.test(host) ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export const requestOrigin = (req: Request) => originFrom(req.headers, req.url);

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID, X-Api-Key",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

export function json(body: unknown, init: { status?: number; headers?: Record<string, string>; cache?: boolean } = {}) {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": init.cache ? "public, max-age=300" : "no-store",
      Pragma: "no-cache",
      ...init.headers,
    },
  });
}

export function oauthError(e: unknown) {
  if (e instanceof OAuthError) return json(e.json(), { status: e.status });
  console.error("[oauth]", e);
  return json({ error: "server_error", error_description: "Something went wrong. Try again." }, { status: 500 });
}

/** Token and revocation requests are form-encoded (RFC 6749); JSON is accepted too, leniently. */
export async function readParams(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 16_384) throw new OAuthError("invalid_request", "Request body too large.");
  if (type.includes("application/json")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      return new URLSearchParams(Object.entries(obj).filter(([, v]) => typeof v === "string") as [string, string][]);
    } catch {
      throw new OAuthError("invalid_request", "Body isn't valid JSON.");
    }
  }
  return new URLSearchParams(text);
}

/** client_id from the body, or from HTTP Basic auth for clients that send it there. */
export function clientIdFrom(req: Request, params: URLSearchParams): string | null {
  const fromBody = params.get("client_id");
  if (fromBody) return fromBody;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
      const id = decoded.slice(0, decoded.indexOf(":") >= 0 ? decoded.indexOf(":") : undefined);
      return decodeURIComponent(id) || null;
    } catch {
      return null;
    }
  }
  return null;
}
