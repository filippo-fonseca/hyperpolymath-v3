import { authServerMetadata } from "@/lib/oauth";
import { json, preflight, requestOrigin } from "@/server/oauth-http";

// RFC 8414 authorization server metadata.

export function GET(req: Request) {
  return json(authServerMetadata(requestOrigin(req)), { cache: true });
}

export const OPTIONS = preflight;
