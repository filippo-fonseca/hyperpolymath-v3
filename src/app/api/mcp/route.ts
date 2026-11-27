import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { adminDb } from "@/server/ctx";
import { buildMcpServer } from "@/server/mcp";
import { verifyToken } from "@/server/tokens";
import { coordinatorName } from "@/server/bots";
import { authFailures, clientIp, hit, limitHeaders, MCP_LIMIT, type Verdict } from "@/server/rate-limit";

// Stateless Streamable HTTP MCP endpoint. Auth: `Authorization: Bearer hpm_...`
// (or `x-api-key: hpm_...` for clients that only support custom headers).

function bearer(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() ?? null;
}

function tooMany(v: Verdict, message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32029, message }, id: null },
    { status: 429, headers: limitHeaders(v) },
  );
}

async function handle(req: Request) {
  const ip = clientIp(req);
  if (authFailures.blocked(ip)) {
    return tooMany(authFailures.peek(ip), "Too many invalid tokens from this address. Try again later.");
  }
  const token = bearer(req);
  const userId = token ? await verifyToken(adminDb(), token) : null;
  if (!userId) {
    authFailures.hit(ip);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid Hyperpolymath token" }, id: null },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="hyperpolymath"' } },
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
    const res = await transport.handleRequest(req);
    for (const [k, v] of Object.entries(limitHeaders(limit))) res.headers.set(k, v);
    return res;
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
