import { adminDb } from "@/server/ctx";
import { OAuthError, exchangeCode, refreshTokens } from "@/server/oauth";
import { clientIdFrom, json, oauthError, preflight, readParams, requestOrigin } from "@/server/oauth-http";
import { matchResource } from "@/lib/oauth";

// Token endpoint: authorization_code (with PKCE) and refresh_token grants.

export async function POST(req: Request) {
  try {
    const params = await readParams(req);
    const clientId = clientIdFrom(req, params);
    const grantType = params.get("grant_type");
    const rawResource = params.get("resource");
    const resource = rawResource ? matchResource(rawResource, requestOrigin(req)) : null;
    if (rawResource && !resource) throw new OAuthError("invalid_request", "resource must be this server's MCP URL.");

    if (grantType === "authorization_code") {
      if (!clientId) throw new OAuthError("invalid_request", "client_id is required.");
      const tokens = await exchangeCode(adminDb(), {
        code: params.get("code") ?? "",
        clientId,
        redirectUri: params.get("redirect_uri"),
        codeVerifier: params.get("code_verifier") ?? "",
        resource,
      });
      return json(tokens);
    }
    if (grantType === "refresh_token") {
      return json(await refreshTokens(adminDb(), { refreshToken: params.get("refresh_token") ?? "", clientId }));
    }
    throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (e) {
    return oauthError(e);
  }
}

export const OPTIONS = preflight;
