import { protectedResourceMetadata } from "@/lib/oauth";
import { json, preflight, requestOrigin } from "@/server/oauth-http";

// RFC 9728 protected resource metadata: tells MCP clients that /api/mcp is
// protected by this app's own authorization server.

export function GET(req: Request) {
  return json(protectedResourceMetadata(requestOrigin(req)), { cache: true });
}

export const OPTIONS = preflight;
