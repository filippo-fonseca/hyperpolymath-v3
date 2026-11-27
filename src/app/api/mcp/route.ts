import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { adminDb } from "@/server/ctx";
import { buildMcpServer } from "@/server/mcp";
import { verifyToken } from "@/server/tokens";
import { verifyAccessToken } from "@/server/oauth";
import { coordinatorName } from "@/server/bots";
import { authFailures, clientIp, hit, limitHeaders, MCP_LIMIT, type Verdict } from "@/server/rate-limit";
import { CORS_HEADERS, preflight, requestOrigin } from "@/server/oauth-http";
import { MCP_PATH, bearerChallenge } from "@/lib/oauth";

// Stateless Streamable HTTP MCP endpoint. Two ways in:
// - OAuth 2.1 (Claude, ChatGPT, Grok Bot sign-in): `Authorization: Bearer hpo_...`
//   from /api/oauth/token. A 401 points clients at the protected resource
//   metadata so they can discover the authorization server.
// - Personal tokens from Settings: `Authorization: Bearer hpm_...` (or
//   `x-api-key: hpm_...` for clients that only support custom headers).

function bearer(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() ?? null;
}

function tooMany(v: Verdict, message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32029, message }, id: null },
    { status: 429, headers: { ...CORS_HEADERS, ...limitHeaders(v) } },
  );
}

async function resolveUser(req: Request, origin: string): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  if (token.startsWith("hpo_")) return (await verifyAccessToken(adminDb(), token, origin + MCP_PATH))?.userId ?? null;
  return verifyToken(adminDb(), token);
}

function withCors(res: Response) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

async function handle(req: Request) {
  const ip = clientIp(req);
  if (authFailures.blocked(ip)) {
    return tooMany(authFailures.peek(ip), "Too many invalid tokens from this address. Try again later.");
  }
  const origin = requestOrigin(req);
  const userId = await resolveUser(req, origin);
  if (!userId) {
    const presented = !!bearer(req);
    if (presented) authFailures.hit(ip);
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: presented ? "Invalid or expired Hyperpolymath token" : "Sign in to Hyperpolymath to use this server" },
        id: null,
      },
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": bearerChallenge(origin, presented ? "invalid_token" : undefined) } },
    );
  }
  const limit = await hit(adminDb(), `mcp:${userId}`, MCP_LIMIT);
  if (!limit.ok) {
    return tooMany(limit, `Rate limit reached (${limit.limit} requests a minute). Retry in ${limit.resetIn}s.`);
  }
  const server = buildMcpServer(userId, await coordinatorName(adminDb(), userId));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const res = withCors(await transport.handleRequest(req));
    for (const [k, v] of Object.entries(limitHeaders(limit))) res.headers.set(k, v);
    return res;
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
