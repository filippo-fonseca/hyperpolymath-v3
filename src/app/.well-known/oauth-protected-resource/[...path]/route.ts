import { MCP_PATH, protectedResourceMetadata } from "@/lib/oauth";
import { json, preflight, requestOrigin } from "@/server/oauth-http";

// The path-suffixed form (RFC 9728 section 3.1): /.well-known/oauth-protected-resource/api/mcp.

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (`/${path.join("/")}` !== MCP_PATH) return json({ error: "not_found" }, { status: 404 });
  return json(protectedResourceMetadata(requestOrigin(req)), { cache: true });
}

export const OPTIONS = preflight;
