import { MCP_PATH, authServerMetadata } from "@/lib/oauth";
import { json, preflight, requestOrigin } from "@/server/oauth-http";

// Some clients probe the path-suffixed form using the MCP path; answer it with
// the same document (the issuer is still the bare origin).

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (`/${path.join("/")}` !== MCP_PATH) return json({ error: "not_found" }, { status: 404 });
  return json(authServerMetadata(requestOrigin(req)), { cache: true });
}

export const OPTIONS = preflight;
