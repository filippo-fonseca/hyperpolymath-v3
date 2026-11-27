import { adminDb } from "@/server/ctx";
import { OAuthError, registerClient } from "@/server/oauth";
import { json, oauthError, preflight } from "@/server/oauth-http";

// RFC 7591 dynamic client registration. Open by design (MCP clients register
// themselves); clients are public, and nobody gets a token without the
// account owner approving on the consent screen. Unused registrations are
// cleaned up daily (oauth_gc).

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 16_384) throw new OAuthError("invalid_client_metadata", "Registration body too large.");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new OAuthError("invalid_client_metadata", "Body must be JSON.");
    }
    return json(await registerClient(adminDb(), body), { status: 201 });
  } catch (e) {
    return oauthError(e);
  }
}

export const OPTIONS = preflight;
