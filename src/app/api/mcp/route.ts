import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { adminDb } from "@/server/ctx";
import { buildMcpServer } from "@/server/mcp";
import { verifyToken } from "@/server/tokens";

// Stateless Streamable HTTP MCP endpoint. Auth: `Authorization: Bearer hpm_...`
// (or `x-api-key: hpm_...` for clients that only support custom headers).

function bearer(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() ?? null;
}

async function handle(req: Request) {
  const token = bearer(req);
  const userId = token ? await verifyToken(adminDb(), token) : null;
  if (!userId) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid Hyperpolymath token" }, id: null },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="hyperpolymath"' } },
    );
  }
  const server = buildMcpServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
